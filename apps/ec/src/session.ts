/**
 * 会話（session）の出入り口。App.tsx の 手順1 でimportして使います。
 *
 * APIキーはブラウザーに置きません。会話の作成もtokenの発行も、開発サーバーの
 * `/__subako/*` に頼みます。ブラウザーが持つのは会話のIDだけで、それを
 * localStorage に覚えて、次に開いたときは同じ会話から続けます。
 *
 * 中身を読まなくてもハンズオンは進みます。完成例と同じ内容です。
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function loadSessionId(key: string) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function saveSessionId(key: string, id: string) {
  try {
    localStorage.setItem(key, id);
  } catch {
    // 保存できなくても、開いている間は会話を続けられます。
  }
}

async function ask(path: string, body?: object) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`${path} が ${response.status} を返しました`);
  return (await response.json()) as Record<string, unknown>;
}

/** 開発サーバーが決めたagentに、新しい会話を作ります。 */
export async function createSession() {
  const { sessionId } = await ask("/__subako/session");
  if (typeof sessionId !== "string" || !sessionId)
    throw new Error("会話のIDを受け取れませんでした");
  return sessionId;
}

/** 会話につなぐためのtokenを発行します。期限切れのたびにSDKが呼び直します。 */
export async function fetchSessionToken(sessionId: string) {
  const { token } = await ask("/__subako/token", { sessionId });
  if (typeof token !== "string" || !token)
    throw new Error("tokenを受け取れませんでした");
  return token;
}

/** 前回の会話があれば続け、なければ作って覚えます。 */
export async function ensureSessionId(key: string) {
  const saved = loadSessionId(key);
  if (saved) return saved;
  const created = await createSession();
  saveSessionId(key, created);
  return created;
}

/**
 * 画面が使う会話のID。前回の続きがあれば最初の描画から渡し、なければ作ります。
 * StrictModeで作成が二重に走らないよう、実行中は次の依頼を受けません。
 */
export function useSessionId(key: string) {
  const [sessionId, setSessionId] = useState(() => loadSessionId(key));
  const [creating, setCreating] = useState(() => !loadSessionId(key));
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const run = useCallback(
    (make: () => Promise<string>, message: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setCreating(true);
      setError("");
      make()
        .then(setSessionId)
        .catch(() => setError(message))
        .finally(() => {
          inFlight.current = false;
          setCreating(false);
        });
    },
    [],
  );

  useEffect(() => {
    if (sessionId) return;
    run(
      () => ensureSessionId(key),
      "会話を準備できませんでした。開発サーバーとAPIキーの設定を確認して、もう一度お試しください。",
    );
  }, [key, run, sessionId]);

  const startNew = useCallback(() => {
    run(async () => {
      const created = await createSession();
      saveSessionId(key, created);
      return created;
    }, "新しい会話を作れませんでした。開発サーバーとAPIキーの設定を確認して、もう一度お試しください。");
  }, [key, run]);

  return { sessionId, creating, error, startNew };
}
