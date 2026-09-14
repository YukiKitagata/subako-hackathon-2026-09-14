import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import gymsSnapshot from "./gyms-snapshot.json";

export type LatLon = { lat: number; lon: number };
export type Gym = LatLon & {
  id: string;
  name: string;
  address: string;
  openingHours: string;
  /** 出発地からの直線距離。徒歩経路の距離ではありません。 */
  distanceMeters: number;
};
export type Route = {
  seconds: number;
  distanceMeters: number;
  /** Leafletにそのまま渡せる [緯度, 経度] の順。 */
  coordinates: [number, number][];
};
type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: LatLon;
  /** 要素ごとに付いているタグが違うため、値がないキーもあります。 */
  tags?: Record<string, string | undefined>;
};
type GymsSnapshot = { center: LatLon; elements: OverpassElement[] };
type OsmApiOptions = {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** 事前に取得したOverpassの検索結果。 */
  snapshot?: GymsSnapshot;
  /** 公開サーバーの利用規約（最大1リクエスト/秒）に合わせた呼び出し間隔。 */
  minIntervalMs?: number;
};

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";
// FOSSGISの利用規約に沿って、呼び出し元を識別できるようにします。
const USER_AGENT = "subako-hackathon-2026-09-14 workout demo";
// 保存済みの候補は、取得した地点の近く（デモの固定出発地）でだけ使います。
const SNAPSHOT_MAX_OFFSET_METERS = 1000;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function reply(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function parseLatLon(params: URLSearchParams, latKey: string, lonKey: string): LatLon {
  const lat = Number(params.get(latKey) || NaN);
  const lon = Number(params.get(lonKey) || NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new ApiError(400, `${latKey}・${lonKey} に緯度・経度を指定してください。`);
  return { lat, lon };
}

export function distanceMeters(a: LatLon, b: LatLon) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(h)));
}

/** Overpassの結果を、出発地から直線距離の近い順に最大5件へまとめます。 */
export function parseGyms(elements: OverpassElement[], origin: LatLon): Gym[] {
  return elements
    .flatMap((element): Gym[] => {
      const point =
        element.lat !== undefined && element.lon !== undefined
          ? { lat: element.lat, lon: element.lon }
          : element.center;
      if (!point) return [];
      const tags = element.tags ?? {};
      const area = tags.branch ?? tags["addr:neighbourhood"] ?? tags["addr:quarter"] ?? "";
      const base = tags["name:ja"] ?? tags.name ?? "エニタイムフィットネス";
      const street = [tags["addr:block_number"], tags["addr:housenumber"]].filter(Boolean).join("-");
      return [{
        id: `${element.type}/${element.id}`,
        name: area ? `${base} ${area}` : base,
        address: [tags["addr:province"], tags["addr:city"], tags["addr:neighbourhood"] ?? tags["addr:quarter"], street]
          .filter(Boolean)
          .join(""),
        openingHours: tags.opening_hours ?? "",
        lat: point.lat,
        lon: point.lon,
        distanceMeters: distanceMeters(origin, point),
      }];
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5);
}

/** ValhallaのOSRM形式の応答から、秒数・距離・経路の座標を取り出します。 */
export function parseRoute(body: unknown): Route {
  const route = (body as {
    routes?: { duration?: unknown; distance?: unknown; geometry?: { coordinates?: unknown } }[];
  } | null)?.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (
    !route ||
    typeof route.duration !== "number" ||
    typeof route.distance !== "number" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2
  )
    throw new ApiError(502, "徒歩経路を読み取れませんでした。");
  return {
    seconds: Math.round(route.duration),
    distanceMeters: Math.round(route.distance),
    coordinates: (coordinates as [number, number][]).map(([lon, lat]) => [lat, lon]),
  };
}

/** 前の呼び出しが終わってから minIntervalMs 空けて、1件ずつ実行します。 */
function createThrottle(minIntervalMs: number) {
  let queue: Promise<unknown> = Promise.resolve();
  let lastAt = -Infinity;
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = lastAt + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      try {
        return await task();
      } finally {
        lastAt = Date.now();
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
}

export function createOsmMiddleware({
  fetch: fetcher = fetch,
  minIntervalMs = 1100,
  snapshot = gymsSnapshot,
}: OsmApiOptions = {}) {
  const valhalla = createThrottle(minIntervalMs);
  const routeCache = new Map<string, Route>();

  async function findRoute(from: LatLon, to: LatLon) {
    const key = [from.lat, from.lon, to.lat, to.lon].map((value) => value.toFixed(5)).join(",");
    const cached = routeCache.get(key);
    if (cached) return cached;
    let response: Response;
    try {
      response = await valhalla(() =>
        fetcher(VALHALLA_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, "X-Client-Id": USER_AGENT },
          body: JSON.stringify({ locations: [from, to], costing: "pedestrian", format: "osrm", shape_format: "geojson" }),
          signal: AbortSignal.timeout(20_000),
        }),
      );
    } catch {
      throw new ApiError(502, "徒歩経路を取得できませんでした。少し待ってから、もう一度お試しください。");
    }
    if (response.status === 400)
      throw new ApiError(422, "徒歩でたどれる経路が見つかりませんでした。別のジムを選んでください。");
    if (!response.ok)
      throw new ApiError(502, "徒歩経路を取得できませんでした。少し待ってから、もう一度お試しください。");
    const route = parseRoute(await response.json().catch(() => null));
    routeCache.set(key, route);
    return route;
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== "/__osm/gyms" && url.pathname !== "/__osm/route") return next();
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return reply(res, 405, { error: "GETで呼び出してください。" });
    }
    try {
      if (url.pathname === "/__osm/gyms") {
        // 公開の検索サーバー（Overpass）はデモ中に混雑で止まりやすいため、事前に取得した検索結果だけを使います。
        const origin = parseLatLon(url.searchParams, "lat", "lon");
        if (distanceMeters(origin, snapshot.center) > SNAPSHOT_MAX_OFFSET_METERS)
          throw new ApiError(422, "保存済みのジムデータは渋谷駅周辺のものです。出発地を確認してください。");
        return reply(res, 200, { gyms: parseGyms(snapshot.elements, origin) });
      }
      const from = parseLatLon(url.searchParams, "fromLat", "fromLon");
      const to = parseLatLon(url.searchParams, "toLat", "toLon");
      return reply(res, 200, await findRoute(from, to));
    } catch (error) {
      if (error instanceof ApiError) return reply(res, error.status, { error: error.message });
      return reply(res, 502, { error: "OpenStreetMapの情報を取得できませんでした。" });
    }
  };
}

/** 開発サーバーとプレビューの両方に、ジム検索と徒歩経路の口を生やします。 */
export function osmDevApi(options?: OsmApiOptions): Plugin {
  const middleware = createOsmMiddleware(options);
  return {
    name: "osm-dev-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
