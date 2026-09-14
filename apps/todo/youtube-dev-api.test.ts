import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { type TestContext } from "node:test";
import { createYouTubeMiddleware } from "./youtube-dev-api.ts";

async function serve(t: TestContext, options: Parameters<typeof createYouTubeMiddleware>[0]) {
  const middleware = createYouTubeMiddleware(options);
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
  return `http://127.0.0.1:${address.port}`;
}

const unexpected = async (): Promise<Response> => {
  throw new Error("想定外のYouTube呼び出し");
};

test("キー未設定と不正なqは、YouTubeを呼ばずに返す", async (t) => {
  const origin = await serve(t, { apiKey: "", fetch: unexpected });
  assert.equal((await fetch(`${origin}/__youtube/search?q=`)).status, 400);
  const response = await fetch(`${origin}/__youtube/search?q=${encodeURIComponent("ベンチプレス")}`);
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /YOUTUBE_API_KEY/);
  assert.equal((await fetch(`${origin}/__youtube/search`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${origin}/other`)).status, 404);
});

test("種目名で検索し、タイトルを戻して結果を覚える", async (t) => {
  const urls: string[] = [];
  const origin = await serve(t, {
    apiKey: "test-youtube-secret",
    fetch: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({
        items: [
          {
            id: { videoId: "abc" },
            snippet: { title: "ベンチプレス &amp; フォーム解説 &#39;初心者&#39;", channelTitle: "Gym", thumbnails: { medium: { url: "https://i.ytimg.com/vi/abc/mqdefault.jpg" } } },
          },
          { id: {}, snippet: { title: "チャンネル" } },
        ],
      }));
    },
  });
  const path = `${origin}/__youtube/search?q=${encodeURIComponent("ベンチプレス")}`;
  const first = await fetch(path);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    videos: [{ videoId: "abc", title: "ベンチプレス & フォーム解説 '初心者'", channelTitle: "Gym", thumbnailUrl: "https://i.ytimg.com/vi/abc/mqdefault.jpg" }],
  });
  assert.equal((await fetch(path)).status, 200);
  assert.equal(urls.length, 1);
  const params = new URL(urls[0]).searchParams;
  assert.equal(params.get("q"), "ベンチプレス やり方 フォーム");
  assert.equal(params.get("type"), "video");
  assert.equal(params.get("key"), "test-youtube-secret");
});

test("上流のエラーではキーを含めず502を返す", async (t) => {
  const origin = await serve(t, {
    apiKey: "test-youtube-secret",
    fetch: async () => new Response("quotaExceeded", { status: 403 }),
  });
  const response = await fetch(`${origin}/__youtube/search?q=${encodeURIComponent("スクワット")}`);
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /test-youtube-secret|quotaExceeded/);
});
