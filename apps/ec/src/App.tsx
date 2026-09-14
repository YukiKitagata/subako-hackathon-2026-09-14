import { CatalogView } from "./CatalogView";
import { useCatalog } from "./useCatalog";
import { validateCatalog } from "./model";
import catalogData from "../data/catalog.json";

// TODO(1) SDKと準備済みの関数をimportする
// 先にREADMEの npm install を実行します。session.css は main.tsx がimport済みです。
// import { z } from "zod";
// import { SubakoSessionClient } from "@subako-ai/sdk";
// import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
// import { SubakoChat, SubakoToolApproval } from "@subako-ai/assistant-ui";
// import type { ToolCallMessagePartProps } from "@assistant-ui/react";
// import { fetchSessionToken, useSessionId } from "./session";
// import type { CatalogStore } from "./useCatalog";
// import { cartSummary, searchCatalog } from "./model";

const initialData = validateCatalog(catalogData);

// TODO(2) 会話につなぐクライアントを用意する
// 会話ごとのtokenを開発サーバーから受け取ります。
// const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
// const sessionStorageKey = `hackathon:session:ec:${baseUrl}`;
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
// function Assistant({
//   sessionId,
//   catalog,
//   creating,
//   error,
//   onNew,
// }: {
//   sessionId: string;
//   catalog: CatalogStore;
//   creating: boolean;
//   error: string;
//   onNew: () => void;
// }) {
//   const session = useSession(sessionId);
//   const client = useToolClient(session, "shop");
//
//   // 既存の検索関数を、このセッションのツールとして登録する。
//   useTool(client, "search_items", {
//     description:
//       "商品を検索する。queryを空にすると全商品を取得できる。metadataの素材・用途なども返るため、提案前に使う。maxPriceは1点あたりの上限額。画面は変更しない。",
//     schema: z.object({
//       query: z.string().max(200).trim().default(""),
//       maxPrice: z.number().int().min(0).max(100_000_000).optional(),
//     }).strict(),
//     execute: ({ query, maxPrice }) =>
//       JSON.stringify(searchCatalog(catalog.getState().data.items, query, maxPrice)),
//   });
//
//   useTool(client, "get_item", {
//     description: "1商品の詳細をmetadata込みで取得する。画面には表示されない属性や用途も判断に使える。",
//     schema: z.object({ id: z.string().max(80).trim().min(1) }).strict(),
//     execute: ({ id }) => {
//       const item = catalog.getState().data.items.find((entry) => entry.id === id);
//       if (!item) throw new Error(`商品「${id}」が見つかりません。`);
//       return JSON.stringify(item);
//     },
//   });
//
//   useTool(client, "show_items", {
//     description: "指定した商品だけを画面の一覧に表示する。提案する候補が決まったら使う。idsの順に表示する。空配列なら何も表示しない。",
//     schema: z.object({
//       ids: z.array(z.string().max(80).trim().min(1)).max(100),
//     }).strict(),
//     execute: ({ ids }) => {
//       const shownIds = catalog.showItems(ids);
//       return JSON.stringify({ shownIds });
//     },
//   });
//
//   useTool(client, "show_all_items", {
//     description: "候補の絞り込みを解除して、画面を全商品の表示に戻す。",
//     schema: z.object({}).strict(),
//     execute: () => {
//       catalog.showItems(null);
//       return "全商品を表示しました。";
//     },
//   });
//
//   // TODO(4) 比較とカートの操作ツールを登録する
//   useTool(client, "compare_items", {
//     description: "最大3点を画面で比較する。商品名・説明・価格を比較パネルに並べる。metadataによる違いは会話で説明する。",
//     schema: z.object({
//       ids: z.array(z.string().max(80).trim().min(1)).max(3),
//     }).strict(),
//     execute: ({ ids }) => {
//       const comparedIds = catalog.compareItems(ids);
//       return JSON.stringify({ comparedIds });
//     },
//   });
//
//   useTool(client, "get_cart", {
//     description: "現在のカートの商品・数量・合計金額と画面の選択状態を読む。人が変更した結果を引き継ぐため、セットを組む前に使う。",
//     schema: z.object({}).strict(),
//     execute: () => {
//       const current = catalog.getState();
//       return JSON.stringify({
//         ...cartSummary(current.cart, current.data.items),
//         comparedIds: current.comparedIds,
//         shownIds: current.shownIds,
//       });
//     },
//   });
//
//   // カートのボタンと同じ操作を呼ぶ。
//   useTool(client, "set_cart_quantity", {
//     description: "1商品のカート内数量を指定値にする。0なら削除。在庫数を超える操作は失敗する。購入確定は行わない。",
//     schema: z.object({
//       id: z.string().max(80).trim().min(1),
//       quantity: z.number().int().min(0).max(9999),
//     }).strict(),
//     execute: ({ id, quantity }) =>
//       JSON.stringify(catalog.setQuantity(id, quantity)),
//   });
//
//   useTool(client, "replace_cart", {
//     description: "カート全体を指定したセットに置き換える。予算がある場合はmaxTotalも渡す。予算・在庫の検証に失敗するとカートは一切変更しない。購入確定は行わない。",
//     schema: z.object({
//       lines: z.array(z.object({
//         itemId: z.string().max(80).trim().min(1),
//         quantity: z.number().int().min(1).max(9999),
//       }).strict()).max(100),
//       maxTotal: z.number().int().min(0).max(100_000_000).optional(),
//     }).strict(),
//     execute: ({ lines, maxTotal }) => JSON.stringify(catalog.replaceCart(lines, maxTotal)),
//   });
//
//   useTool(client, "open_checkout", {
//     description: "購入内容と合計を確認する画面を開く。最終確定は利用者が画面のボタンを押す。実際の課金や配送のないデモ。",
//     schema: z.object({}).strict(),
//     execute: () => JSON.stringify({
//       ...catalog.openCheckout(),
//       status: "awaiting_human_confirmation",
//       message: "購入確認を表示しました。画面の確定ボタンは利用者が押します。実際の決済はありません。",
//     }),
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
  const catalog = useCatalog({
    initialData,
    storageKey: "subako-hackathon:ec:v1",
  });

  // TODO(5) 保存済みの会話を開き、新しく始める操作を用意する
  // 会話を切り替えても、アプリのデータは残ります。
  // const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);

  return (
    <div className="app-layout has-session">
      <div className="app-panel">
        <div className="app-content">
          <CatalogView store={catalog} />
        </div>
        <div id="app-dialogs" className="app-dialog-host" />
      </div>

      <aside className="session-sidebar" aria-label="ショップアシスタント">
        <header className="session-header">
          <h2>ショップアシスタント</h2>
          <p>会話しながら、商品を探せます。</p>
        </header>
        <div className="session-content">
          <p>ここに会話が入ります。</p>
          {/* TODO(6) 上の <p> を消し、下の JSX コメントを解除します。 */}
          {/*
            {sessionId ? (
              <SubakoProvider client={subako}>
                <Assistant
                  key={sessionId}
                  catalog={catalog}
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
