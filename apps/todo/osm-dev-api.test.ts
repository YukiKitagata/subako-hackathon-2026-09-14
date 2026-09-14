import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { type TestContext } from "node:test";
import { createOsmMiddleware, parseGyms } from "./osm-dev-api.ts";

type Call = { url: string; init?: RequestInit };

async function serve(
  t: TestContext,
  respond: (call: Call) => Response,
  snapshot?: NonNullable<Parameters<typeof createOsmMiddleware>[0]>["snapshot"],
) {
  const calls: Call[] = [];
  const middleware = createOsmMiddleware({
    minIntervalMs: 0,
    ...(snapshot ? { snapshot } : {}),
    fetch: async (url, init) => {
      calls.push({ url, init });
      return respond({ url, init });
    },
  });
  const server = createServer((req, res) => {
    void middleware(req, res, () => {
      res.writeHead(404);
      res.end("next");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { origin: `http://127.0.0.1:${address.port}`, calls };
}

const origin = { lat: 35.65718, lon: 139.698687 };
const gym = (id: number, lat: number, lon: number, tags: Record<string, string> = {}) => ({
  type: "node", id, lat, lon, tags: { name: "エニタイムフィットネス", ...tags },
});
const unexpected = (): Response => {
  throw new Error("想定外の外部呼び出し");
};

test("ジムを直線距離の近い順に最大5件へまとめ、wayは中心点を使う", () => {
  const far = gym(1, 35.67, 139.69);
  const near = gym(2, 35.6568, 139.702, { "addr:city": "渋谷区", "addr:neighbourhood": "桜丘町", "addr:block_number": "1", "addr:housenumber": "4", opening_hours: "24/7" });
  const way = { type: "way", id: 3, center: { lat: 35.658, lon: 139.699 }, tags: { name: "エニタイムフィットネス", branch: "道玄坂店" } };
  const many = Array.from({ length: 6 }, (_, i) => gym(10 + i, 35.7 + i * 0.01, 139.7));
  const gyms = parseGyms([far, near, way, { type: "node", id: 9 }, ...many], origin);
  assert.equal(gyms.length, 5);
  assert.deepEqual(gyms.slice(0, 3).map((entry) => entry.id), ["way/3", "node/2", "node/1"]);
  assert.equal(gyms[0].name, "エニタイムフィットネス 道玄坂店");
  assert.equal(gyms[1].address, "渋谷区桜丘町1-4");
  assert.equal(gyms[1].openingHours, "24/7");
  assert.ok(gyms[0].distanceMeters < gyms[1].distanceMeters);
});

test("ジム検索は保存済みの候補だけを使い、外部を呼ばない", async (t) => {
  const snapshot = { center: { lat: 35.658, lon: 139.7016 }, elements: [gym(8, 35.66, 139.7), gym(7, 35.6568, 139.702)] };
  const { origin: base, calls } = await serve(t, unexpected, snapshot);
  const response = await fetch(`${base}/__osm/gyms?lat=${origin.lat}&lon=${origin.lon}`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).gyms.map((entry: { id: string }) => entry.id), ["node/7", "node/8"]);
  const far = await fetch(`${base}/__osm/gyms?lat=35.68&lon=139.76`);
  assert.equal(far.status, 422);
  assert.match((await far.json()).error, /渋谷駅周辺/);
  assert.equal(calls.length, 0);
});

test("同梱の保存済み候補を読み込める", async (t) => {
  const { origin: base } = await serve(t, unexpected);
  const response = await fetch(`${base}/__osm/gyms?lat=${origin.lat}&lon=${origin.lon}`);
  const body = await response.json();
  assert.deepEqual(body.gyms.map((entry: { id: string }) => entry.id), ["node/12452359656", "node/10681112121"]);
  assert.equal(body.gyms[0].name, "エニタイムフィットネス 桜丘町");
});

test("徒歩経路は[緯度, 経度]に並べ替え、秒数と距離を丸める", async (t) => {
  const { origin: base, calls } = await serve(t, () =>
    new Response(JSON.stringify({
      routes: [{ duration: 377.366, distance: 371.056, geometry: { type: "LineString", coordinates: [[139.6987, 35.6572], [139.702, 35.6568]] } }],
    })),
  );
  const response = await fetch(`${base}/__osm/route?fromLat=35.6572&fromLon=139.6987&toLat=35.6568&toLon=139.702`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    seconds: 377,
    distanceMeters: 371,
    coordinates: [[35.6572, 139.6987], [35.6568, 139.702]],
  });
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.costing, "pedestrian");
  assert.deepEqual(body.locations, [{ lat: 35.6572, lon: 139.6987 }, { lat: 35.6568, lon: 139.702 }]);
});

test("不正な座標は外部を呼ばずに400、経路なしは422を返す", async (t) => {
  const { origin: base, calls } = await serve(t, () => new Response("{}", { status: 400 }));
  assert.equal((await fetch(`${base}/__osm/gyms?lat=abc&lon=139.7`)).status, 400);
  assert.equal((await fetch(`${base}/__osm/route?fromLat=35&fromLon=139`)).status, 400);
  assert.equal(calls.length, 0);
  const response = await fetch(`${base}/__osm/route?fromLat=0&fromLon=0&toLat=0.001&toLon=0.001`);
  assert.equal(response.status, 422);
  assert.equal((await fetch(`${base}/other`)).status, 404);
});
