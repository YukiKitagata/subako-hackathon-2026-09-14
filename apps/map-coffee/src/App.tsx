import { useMemo, useState } from "react";
import { z } from "zod";
import { SubakoSessionClient } from "@subako-ai/sdk";
import { SubakoProvider, useSession, useTool, useToolClient } from "@subako-ai/react";
import { SubakoChat } from "@subako-ai/assistant-ui";
import { MapView } from "./map-view";
import { useMapApp, type MapApp } from "./use-map-app";
import { getVisitSummary, parseMapItems, type MapState, type WalkingRoute } from "./domain";
import { SessionControls, SessionPending, SafeToolResult } from "./SessionControls";
import { fetchSessionToken, useSessionId } from "./session";
import data from "./data.json";
import routeData from "./routes.json";

const initialItems = parseMapItems(data);
const walkingRoutes = routeData as WalkingRoute[];

// 経路の全座標は省き、判断に必要な距離と所要時間を渡します。
function mapResult(state: MapState) {
  const summary = getVisitSummary(state.items, state.visitIds, walkingRoutes);
  return JSON.stringify({
    ...state,
    summary: {
      ...summary,
      segments: summary.segments.map(({ coordinates: _, ...segment }) => segment),
    },
  });
}

function MapAssistant({ app, sessionId, creating, error, onNew }: {
  app: MapApp;
  sessionId: string;
  creating: boolean;
  error: string;
  onNew: () => void;
}) {
  const session = useSession(sessionId);
  const client = useToolClient(session, "coffee-map");

  // 既存の画面操作を、ここでエージェントのツールとして登録します。
  useTool(client, "get_places", {
    description: "地点を取得する。metadataには画面に出していない特徴や情報の出典が含まれる。まず全件取得し、ユーザーの好みと比較する。",
    schema: z.object({
      query: z.string().default("").describe("任意のキーワード。省略で全件。"),
    }).strict(),
    execute: ({ query }) => {
      const normalized = query.trim().toLocaleLowerCase();
      return JSON.stringify(app.getState().items.filter((item) =>
        !normalized || JSON.stringify(item).toLocaleLowerCase().includes(normalized),
      ));
    },
  });
  useTool(client, "get_map_state", {
    description: "候補・訪問順・固定した地点と、渋谷駅からの距離・移動時間の概算を取得する。概算に店内滞在と帰路は含まれない。",
    schema: z.object({}).strict(),
    execute: () => mapResult(app.getState()),
  });
  useTool(client, "show_candidates", {
    description: "提案する地点を地図と一覧で強調する。空配列で強調を解除する。",
    schema: z.object({
      ids: z.array(z.string()).describe("地点のidを順番に指定"),
    }).strict(),
    execute: ({ ids }) => JSON.stringify({ candidateIds: app.showCandidates(ids) }),
  });
  useTool(client, "set_visit_order", {
    description: "訪問したい地点のidを訪問順で指定し、画面を更新する。固定された地点を除外できない。実線は保存済みの徒歩経路、点線は経路未取得の訪問順。結果の移動時間に店内滞在・帰路は含まれない。",
    schema: z.object({
      ids: z.array(z.string()).describe("地点のidを順番に指定"),
    }).strict(),
    execute: ({ ids }) => mapResult(app.setVisitOrder(ids)),
  });
  useTool(client, "set_pinned", {
    description: "ユーザーの明示的な依頼で地点を固定または解除する。固定した地点は再提案でも残る。",
    schema: z.object({ id: z.string(), pinned: z.boolean() }).strict(),
    execute: ({ id, pinned }) =>
      JSON.stringify({ pinnedIds: app.setPinned(id, pinned) }),
  });

  return (
    <SessionControls session={session} creating={creating} error={error} onNew={onNew}>
      <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
    </SessionControls>
  );
}

export default function App() {
  const app = useMapApp(initialItems, "hackathon-map-coffee-v1", walkingRoutes);
  const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL?.trim() || "https://api.us.cloud.subako.ai";
  const storageKey = `hackathon:session:map-coffee:${baseUrl}`;
  const { sessionId, creating, error: sessionError, startNew } = useSessionId(storageKey);
  const [connectionError, setConnectionError] = useState("");
  // APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
  const subako = useMemo(
    () => new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken }),
    [baseUrl],
  );

  return (
    <div className="app-layout has-session">
      <div className="app-panel">
        <div className="app-content">
          <MapView
            app={app}
            title="渋谷、コーヒーの寄り道。"
            subtitle="一杯の好奇心を連れて。あなた好みのコーヒー散歩を。"
          />
        </div>
        <div id="app-dialogs" className="app-dialog-host" />
      </div>
      <aside className="session-sidebar" aria-label="寄り道の相談室">
        <header>
          <h2>寄り道の相談室</h2>
          <p>好みや空き時間から、一緒に考えます。</p>
        </header>
        <div className="session-content">
          {connectionError && (
            <div className="session-notice session-error" role="alert">
              {connectionError}
              <button onClick={() => setConnectionError("")}>閉じる</button>
            </div>
          )}
          {sessionId ? (
            <SubakoProvider client={subako} onError={() => setConnectionError("接続を確認してください。agentのOrigin設定と開発サーバーを確認し、アプリを再起動してください。") }>
              <MapAssistant
                key={sessionId}
                app={app}
                sessionId={sessionId}
                creating={creating}
                error={sessionError}
                onNew={startNew}
              />
            </SubakoProvider>
          ) : (
            <SessionPending creating={creating} error={sessionError} onRetry={startNew} />
          )}
        </div>
      </aside>
    </div>
  );
}
