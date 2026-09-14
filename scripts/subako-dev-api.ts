import type { IncomingMessage, ServerResponse } from "node:http";
import { SubakoClient, type RequestOptions } from "@subako-ai/sdk";
import type { Plugin } from "vite";

/** 開発サーバーだけが持つ、APIキーを要る2つの操作。ブラウザーはこれ越しに会話へ入ります。 */
type DevApiClient = {
  sessions: {
    create(
      body: { agent_id: string; display_name: string },
      options?: RequestOptions,
    ): Promise<{ id: string }>;
    mintToken(
      sessionId: string,
      options?: RequestOptions,
    ): Promise<{ expires_at: string; session_token?: string }>;
  };
};
type DevApiOptions = {
  apiKey: string;
  agentId: string;
  baseUrl: string;
  title: string;
  createClient?: (config: {
    baseUrl: string;
    apiKey: string;
    timeout: number;
    maxRetries: number;
  }) => DevApiClient;
};

function reply(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    // 開発用の口なので、壊れた入力で膨らませないだけの上限にします。
    if (text.length > 4096) throw new Error("body too large");
  }
  return JSON.parse(text) as Record<string, unknown>;
}

export function createDevApiMiddleware(options: DevApiOptions) {
  const connect = (): DevApiClient => {
    const config = {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      timeout: 20_000,
      maxRetries: 0,
    };
    return options.createClient ? options.createClient(config) : new SubakoClient(config);
  };
  // 設定漏れは、APIを呼ぶ前に開発者へ返します。
  const unconfigured = (needsAgent: boolean) => {
    if (!options.apiKey.trim())
      return "SUBAKO_API_KEY を設定して、開発サーバーを再起動してください。";
    if (needsAgent && !options.agentId.trim())
      return "先に npm run agent:publish を実行してください。";
    try {
      if (!["http:", "https:"].includes(new URL(options.baseUrl).protocol))
        throw new Error();
    } catch {
      return "Subakoの接続先URLを確認してください。";
    }
    return "";
  };

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const path = (req.url ?? "").split("?")[0];
    const route =
      path === "/__subako/session"
        ? "session"
        : path === "/__subako/token"
          ? "token"
          : "";
    if (!route) return next();
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return reply(res, 405, { error: "POSTで呼び出してください。" });
    }

    let sessionId = "";
    if (route === "token") {
      try {
        const body = await readBody(req);
        if (typeof body.sessionId !== "string" || !body.sessionId)
          throw new Error("sessionId required");
        sessionId = body.sessionId;
      } catch {
        return reply(res, 400, { error: "sessionId を指定してください。" });
      }
    } else {
      // 作成先は開発サーバーが決めます。リクエストの中身は読みません。
      req.resume();
    }

    const error = unconfigured(route === "session");
    if (error) return reply(res, 503, { error });

    try {
      const client = connect();
      if (route === "session") {
        const created = await client.sessions.create({
          agent_id: options.agentId,
          display_name: options.title,
        });
        // 作成時のsession_tokenはブラウザーへ返しません。必要になったら発行します。
        return reply(res, 201, { sessionId: created.id });
      }
      const minted = await client.sessions.mintToken(sessionId);
      if (!minted.session_token) throw new Error("receipt without a token");
      return reply(res, 201, { token: minted.session_token });
    } catch {
      // APIキーや上流の詳細は返しません。
      return reply(res, 502, {
        error:
          route === "session"
            ? "新しい会話を作成できませんでした。接続とAPIキーの権限を確認してください。"
            : "会話に接続できませんでした。接続とAPIキーの権限を確認してください。",
      });
    }
  };
}

/** 開発サーバーとプレビューの両方に、同じ2つの口を生やします。 */
export function subakoDevApi(options: DevApiOptions): Plugin {
  const middleware = createDevApiMiddleware(options);
  return {
    name: "subako-dev-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
