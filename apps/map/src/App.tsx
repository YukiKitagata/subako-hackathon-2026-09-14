import { MapView } from "./map-view";
import { useMapApp } from "./use-map-app";
import { parseMapItems } from "./domain";
import data from "./data.json";

// TODO(1) SDKと準備済みの関数をimportする
// 先にREADMEの npm install を実行します。session.css は main.tsx がimport済みです。
// import { z } from "zod";
// import { SubakoSessionClient } from "@subako-ai/sdk";
// import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
// import { SubakoChat, SubakoToolApproval } from "@subako-ai/assistant-ui";
// import type { ToolCallMessagePartProps } from "@assistant-ui/react";
// import { fetchSessionToken, useSessionId } from "./session";
// import type { MapApp } from "./use-map-app";
// import { getVisitSummary, type MapState } from "./domain";

const initialItems = parseMapItems(data);

// TODO(2) 会話につなぐクライアントを用意する
// 会話ごとのtokenを開発サーバーから受け取ります。
// const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
// const sessionStorageKey = `hackathon:session:map:${baseUrl}`;
// const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });

// TODO(3) 会話・検索・表示のコードを有効にする
// 手順4を含め、次の関数をまとめてコメント解除します。
// // 補足データは省略し、操作の状態と承認ボタンを表示します。
// function SafeToolResult(props: ToolCallMessagePartProps) {
//   const { result, isError, approval } = props;
//   const waiting = approval && approval.approved === undefined && approval.resolution === undefined;
//   let message = result === undefined ? "アプリを操作しています…" : "アプリの操作結果を受け取りました";
//   if (isError) message = "アプリの操作に失敗しました";
//   if (waiting) message = "操作の承認を待っています";
//   if (approval?.approved === false) message = "操作を許可しませんでした";
//   if (approval?.resolution) message = "操作の承認待ちは終了しました";
//
//   return (
//     <div className="tool-status">
//       <span className={isError ? "session-error" : undefined}>{message}</span>
//       <SubakoToolApproval {...props} />
//     </div>
//   );
// }
//
// // 経路の全座標は省き、判断に必要な距離と所要時間を渡します。
// function mapResult(state: MapState) {
//   const summary = getVisitSummary(state.items, state.visitIds);
//   return JSON.stringify({
//     ...state,
//     summary: {
//       ...summary,
//       segments: summary.segments.map(({ coordinates: _, ...segment }) => segment),
//     },
//   });
// }
//
// function MapAssistant({ app, sessionId, creating, error, onNew }: {
//   app: MapApp;
//   sessionId: string;
//   creating: boolean;
//   error: string;
//   onNew: () => void;
// }) {
//   const session = useSession(sessionId);
//   const client = useToolClient(session, "map");
//
//   // 既存の画面操作を、ここでエージェントのツールとして登録します。
//   useTool(client, "get_places", {
//     description: "地点を取得する。metadataには画面に出していない特徴や情報の出典が含まれる。まず全件取得し、ユーザーの好みと比較する。",
//     schema: z.object({
//       query: z.string().default("").describe("任意のキーワード。省略で全件。"),
//     }).strict(),
//     execute: ({ query }) => {
//       const normalized = query.trim().toLocaleLowerCase();
//       return JSON.stringify(app.getState().items.filter((item) =>
//         !normalized || JSON.stringify(item).toLocaleLowerCase().includes(normalized),
//       ));
//     },
//   });
//   useTool(client, "get_map_state", {
//     description: "候補・訪問順・固定した地点と、渋谷駅からの距離・移動時間の概算を取得する。概算に滞在時間と帰路は含まれない。",
//     schema: z.object({}).strict(),
//     execute: () => mapResult(app.getState()),
//   });
//   useTool(client, "show_candidates", {
//     description: "提案する地点を地図と一覧で強調する。空配列で強調を解除する。",
//     schema: z.object({
//       ids: z.array(z.string()).describe("地点のidを順番に指定"),
//     }).strict(),
//     execute: ({ ids }) => JSON.stringify({ candidateIds: app.showCandidates(ids) }),
//   });
//   // TODO(4) 訪問順と固定の操作ツールを登録する
//   useTool(client, "set_visit_order", {
//     description: "訪問したい地点のidを訪問順で指定し、画面を更新する。固定された地点を除外できない。点線は訪問順で、実際の徒歩経路ではない。結果の移動時間に滞在時間・帰路は含まれない。",
//     schema: z.object({
//       ids: z.array(z.string()).describe("地点のidを順番に指定"),
//     }).strict(),
//     execute: ({ ids }) => mapResult(app.setVisitOrder(ids)),
//   });
//   useTool(client, "set_pinned", {
//     description: "ユーザーの明示的な依頼で地点を固定または解除する。固定した地点は再提案でも残る。",
//     schema: z.object({ id: z.string(), pinned: z.boolean() }).strict(),
//     execute: ({ id, pinned }) =>
//       JSON.stringify({ pinnedIds: app.setPinned(id, pinned) }),
//   });
//
//   const state = useSessionState(session);
//   const running = state?.isRunning && state.status !== "failed";
//   const connecting = !state || state.status === "connecting" || state.status === "reconnecting";
//
//   return (
//     <div className="session-conversation" aria-busy={creating}>
//       <div className="session-toolbar">
//         <button
//           type="button"
//           disabled={creating || running || connecting}
//           onClick={onNew}
//           title="会話を新しくします。アプリのデータは引き継がれます。"
//         >
//           {creating ? "作成中…" : "＋ 新しいセッション"}
//         </button>
//         {running && <span>応答後、または停止後に切り替えられます。</span>}
//         {error && <p className="session-error" role="alert">{error}</p>}
//         {state?.status === "failed" && <p className="session-error" role="alert">接続できません。agentのOrigin設定と開発サーバーを確認してください。</p>}
//       </div>
//       <div className="session-chat" inert={creating}>
//         <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
//       </div>
//     </div>
//   );
// }

export default function App() {
  const app = useMapApp(initialItems, "hackathon-map-v1");

  // TODO(5) 保存済みの会話を開き、新しく始める操作を用意する
  // 会話を切り替えても、アプリのデータは残ります。
  // const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);

  return (
    <div className="app-layout has-session">
      <div className="app-panel">
        <div className="app-content">
          <MapView
            app={app}
            title="あなたの寄り道マップ。"
            subtitle="好きな場所を集めて、自分だけの訪問プランを。"
          />
        </div>
        <div id="app-dialogs" className="app-dialog-host" />
      </div>

      <aside className="session-sidebar" aria-label="マップアシスタント">
        <header className="session-header">
          <h2>マップアシスタント</h2>
          <p>会話しながら、地図を動かせます。</p>
        </header>
        <div className="session-content">
          <p>ここに会話が入ります。</p>
          {/* TODO(6) 上の <p> を消し、下の JSX コメントを解除します。 */}
          {/*
            {sessionId ? (
              <SubakoProvider client={subako}>
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
              <div className="session-toolbar" aria-busy={creating}>
                {creating ? (
                  <span>会話を準備しています…</span>
                ) : (
                  <button type="button" onClick={startNew}>もう一度試す</button>
                )}
                {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
              </div>
            )}
          */}
        </div>
      </aside>
    </div>
  );
}
