import assert from "node:assert/strict";
import { createServer } from "node:http";
import test, { type TestContext } from "node:test";
import { createDevApiMiddleware } from "../subako-dev-api.ts";

const options = {
  apiKey: "test-api-secret",
  agentId: "configured-agent",
  baseUrl: "https://api.us.cloud.subako.ai",
  title: "渋谷コーヒー巡り",
};

async function serve(
  t: TestContext,
  overrides: Partial<Parameters<typeof createDevApiMiddleware>[0]> = {},
) {
  const middleware = createDevApiMiddleware({
    ...options,
    createClient: () => {
      throw new Error("想定外のSDK呼び出し");
    },
    ...overrides,
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
  return `http://127.0.0.1:${address.port}`;
}

function post(origin: string, path: string, body?: object) {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("既定のagentでsessionを作り、session_tokenを返さない", async (t) => {
  const calls: string[] = [];
  const origin = await serve(t, {
    createClient: (config) => {
      assert.equal(config.apiKey, "test-api-secret");
      assert.equal(config.baseUrl, "https://api.us.cloud.subako.ai");
      return {
        sessions: {
          async create(body) {
            calls.push("create");
            assert.deepEqual(body, {
              agent_id: "configured-agent",
              display_name: "渋谷コーヒー巡り",
            });
            return { id: "new-session", session_token: "test-session-secret" };
          },
          async mintToken() {
            assert.fail("作成時にtokenを発行してはいけません");
          },
        },
      };
    },
  });
  const result = await post(origin, "/__subako/session");
  assert.equal(result.status, 201);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const text = await result.text();
  assert.deepEqual(JSON.parse(text), { sessionId: "new-session" });
  assert.ok(!text.includes("test-session-secret"));
  assert.deepEqual(calls, ["create"]);
});

test("ブラウザーが指定したagent_idを無視し、既定のagentで作る", async (t) => {
  const origin = await serve(t, {
    createClient: () => ({
      sessions: {
        async create(body) {
          assert.equal(body.agent_id, "configured-agent");
          return { id: "new-session", session_token: "secret" };
        },
        async mintToken() {
          assert.fail("呼ばれません");
        },
      },
    }),
  });
  const result = await post(origin, "/__subako/session", {
    agent_id: "injected-agent",
    display_name: "injected",
  });
  assert.equal(result.status, 201);
});

test("指定したsessionのtokenを発行して返す", async (t) => {
  const origin = await serve(t, {
    createClient: () => ({
      sessions: {
        async create() {
          assert.fail("発行時にsessionを作ってはいけません");
        },
        async mintToken(sessionId) {
          assert.equal(sessionId, "saved-session");
          return { session_token: "minted-token", expires_at: "2026-09-15T00:00:00Z" };
        },
      },
    }),
  });
  const result = await post(origin, "/__subako/token", { sessionId: "saved-session" });
  assert.equal(result.status, 201);
  assert.deepEqual(await result.json(), { token: "minted-token" });
});

test("tokenを含まない受領応答は失敗として扱う", async (t) => {
  const origin = await serve(t, {
    createClient: () => ({
      sessions: {
        async create() {
          assert.fail("呼ばれません");
        },
        async mintToken() {
          return { id: "token-id", session_id: "saved-session", expires_at: "2026-09-15T00:00:00Z" };
        },
      },
    }),
  });
  const result = await post(origin, "/__subako/token", { sessionId: "saved-session" });
  assert.equal(result.status, 502);
});

test("sessionIdのない発行要求はAPIを呼ばず400にする", async (t) => {
  const origin = await serve(t);
  for (const body of [undefined, {}, { sessionId: "" }, { sessionId: 42 }]) {
    assert.equal((await post(origin, "/__subako/token", body)).status, 400);
  }
});

test("APIの失敗はキーも詳細も返さない", async (t) => {
  const origin = await serve(t, {
    createClient: () => ({
      sessions: {
        async create() {
          throw new Error("test-api-secret upstream details");
        },
        async mintToken() {
          throw new Error("test-api-secret upstream details");
        },
      },
    }),
  });
  for (const path of ["/__subako/session", "/__subako/token"]) {
    const result = await post(origin, path, { sessionId: "saved-session" });
    assert.equal(result.status, 502);
    const body = await result.text();
    assert.ok(!body.includes("test-api-secret"));
    assert.ok(!body.includes("upstream"));
  }
});

test("APIキー未設定と不正なURLはAPIを呼ばず503にする", async (t) => {
  for (const overrides of [
    { apiKey: "" },
    { agentId: "" },
    { baseUrl: "file:///secret" },
  ]) {
    const origin = await serve(t, overrides);
    assert.equal((await post(origin, "/__subako/session")).status, 503);
  }
});

test("他のパスは通し、GETは405にする", async (t) => {
  const origin = await serve(t);
  for (const path of ["/__subako/session", "/__subako/token"]) {
    const result = await fetch(`${origin}${path}`);
    assert.equal(result.status, 405);
    assert.equal(result.headers.get("allow"), "POST");
  }
  for (const path of ["/other", "/__subako/session/other"]) {
    const result = await fetch(`${origin}${path}`);
    assert.equal(result.status, 404);
    assert.equal(await result.text(), "next");
  }
});
