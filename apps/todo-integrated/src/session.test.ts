import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  createSession,
  ensureSessionId,
  fetchSessionToken,
  loadSessionId,
  useSessionId,
} from "./session";

type Stubs = { saved?: string | null; broken?: boolean; reply?: () => Response };
type Call = { url: string; body: unknown };

/** localStorageとfetchを差し替えて実行し、終わったら必ず元へ戻します。 */
async function stub<T>({ saved = null, broken = false, reply }: Stubs, run: () => T | Promise<T>) {
  const store = new Map<string, string>();
  if (saved !== null) store.set("key", saved);
  const names = ["localStorage", "fetch"] as const;
  const previous = names.map(
    (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const calls: Call[] = [];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        if (broken) throw new Error("ブラウザーの保存領域を読めません");
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (broken) throw new Error("保存容量が足りません");
        store.set(key, value);
      },
    },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      });
      if (!reply) throw new Error("想定外のAPI呼び出し");
      return reply();
    },
  });
  try {
    return { result: await run(), calls, store };
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

const json = (body: object, status = 201) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("作成はIDだけを読み、session_tokenには触れない", async () => {
  const { result, calls } = await stub(
    { reply: () => json({ sessionId: "made", session_token: "leaked" }) },
    () => createSession(),
  );
  assert.equal(result, "made");
  assert.deepEqual(calls.map((call) => call.url), ["/__subako/session"]);
});

test("作成の失敗はエラーになる", async () => {
  for (const reply of [
    () => json({ error: "だめ" }, 503),
    () => json({ sessionId: "" }),
    () => json({}),
  ]) {
    await assert.rejects(stub({ reply }, () => createSession()));
  }
});

test("tokenの発行はsessionIdを送り、tokenを返す", async () => {
  const { result, calls } = await stub(
    { reply: () => json({ token: "minted" }) },
    () => fetchSessionToken("saved"),
  );
  assert.equal(result, "minted");
  assert.deepEqual(calls, [{ url: "/__subako/token", body: { sessionId: "saved" } }]);
});

test("tokenの発行の失敗はエラーになる", async () => {
  for (const reply of [() => json({ error: "だめ" }, 502), () => json({})]) {
    await assert.rejects(stub({ reply }, () => fetchSessionToken("saved")));
  }
});

test("保存済みの会話を再利用し、作成APIを呼ばない", async () => {
  const { result, calls } = await stub({ saved: "kept" }, () => ensureSessionId("key"));
  assert.equal(result, "kept");
  assert.deepEqual(calls, []);
});

test("未保存なら会話を作り、次回のために保存する", async () => {
  const { result, calls, store } = await stub(
    { reply: () => json({ sessionId: "made" }) },
    () => ensureSessionId("key"),
  );
  assert.equal(result, "made");
  assert.deepEqual(calls.map((call) => call.url), ["/__subako/session"]);
  assert.equal(store.get("key"), "made");
});

test("保存領域を使えなくても会話を作って続行する", async () => {
  const { result } = await stub(
    { broken: true, reply: () => json({ sessionId: "made" }) },
    () => ensureSessionId("key"),
  );
  assert.equal(result, "made");
  assert.equal((await stub({ broken: true }, () => loadSessionId("key"))).result, "");
});

function render(key: string) {
  let state: ReturnType<typeof useSessionId> | undefined;
  function Probe() {
    state = useSessionId(key);
    return null;
  }
  renderToString(createElement(Probe));
  assert.ok(state);
  return state;
}

test("保存済みの会話は最初の描画から使い、準備中にしない", async () => {
  const { result } = await stub({ saved: "kept" }, () => render("key"));
  assert.equal(result.sessionId, "kept");
  assert.equal(result.creating, false);
  assert.equal(result.error, "");
});

test("未保存の会話は最初の描画では空で、準備中になる", async () => {
  const { result } = await stub({}, () => render("key"));
  assert.equal(result.sessionId, "");
  assert.equal(result.creating, true);
});

test("session.ts と session.css はコピー先6アプリで同じ内容にする", () => {
  for (const file of ["session.ts", "session.css"]) {
    const base = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    for (const app of ["todo", "map", "ec", "map-coffee", "ec-coffee"]) {
      assert.equal(
        readFileSync(new URL(`../../${app}/src/${file}`, import.meta.url), "utf8"),
        base,
        `${app} の ${file} が todo-integrated と違います`,
      );
    }
  }
});
