import { useMemo, useState } from "react";
import { z } from "zod";
import { SubakoSessionClient } from "@subako-ai/sdk";
import { SubakoChat } from "@subako-ai/assistant-ui";
import { SubakoProvider, useSession, useTool, useToolClient } from "@subako-ai/react";
import { CatalogView } from "./CatalogView";
import { useCatalog, type CatalogStore } from "./useCatalog";
import { cartSummary, searchCatalog, validateCatalog } from "./model";
import { SessionControls, SessionPending, SafeToolResult } from "./SessionControls";
import { fetchSessionToken, useSessionId } from "./session";
import catalogData from "../data/catalog.json";

const initialData = validateCatalog(catalogData);

function Assistant({
  sessionId,
  catalog,
  creating,
  error,
  onNew,
}: {
  sessionId: string;
  catalog: CatalogStore;
  creating: boolean;
  error: string;
  onNew: () => void;
}) {
  const session = useSession(sessionId);
  const client = useToolClient(session, "shop");

  // 既存の検索関数を、このセッションのツールとして登録する。
  useTool(client, "search_items", {
    description:
      "商品を検索する。queryを空にすると全商品を取得できる。metadataの産地・味・用途も返るため、提案前に使う。maxPriceは1点あたりの上限額。画面は変更しない。",
    schema: z.object({
      query: z.string().max(200).trim().default(""),
      maxPrice: z.number().int().min(0).max(100_000_000).optional(),
    }).strict(),
    execute: ({ query, maxPrice }) =>
      JSON.stringify(searchCatalog(catalog.getState().data.items, query, maxPrice)),
  });

  useTool(client, "get_item", {
    description: "1商品の詳細をmetadata込みで取得する。画面には表示されないフレーバーや相性も判断に使える。",
    schema: z.object({ id: z.string().max(80).trim().min(1) }).strict(),
    execute: ({ id }) => {
      const item = catalog.getState().data.items.find((entry) => entry.id === id);
      if (!item) throw new Error(`商品「${id}」が見つかりません。`);
      return JSON.stringify(item);
    },
  });

  useTool(client, "show_items", {
    description: "指定した商品だけを画面の一覧に表示する。提案する候補が決まったら使う。idsの順に表示する。空配列なら何も表示しない。",
    schema: z.object({
      ids: z.array(z.string().max(80).trim().min(1)).max(100),
    }).strict(),
    execute: ({ ids }) => {
      const shownIds = catalog.showItems(ids);
      return JSON.stringify({ shownIds });
    },
  });

  useTool(client, "show_all_items", {
    description: "候補の絞り込みを解除して、画面を全商品の表示に戻す。",
    schema: z.object({}).strict(),
    execute: () => {
      catalog.showItems(null);
      return "全商品を表示しました。";
    },
  });

  useTool(client, "compare_items", {
    description: "最大3点を画面で比較する。商品名・説明・価格を比較パネルに並べる。味などmetadataによる違いは会話で説明する。",
    schema: z.object({
      ids: z.array(z.string().max(80).trim().min(1)).max(3),
    }).strict(),
    execute: ({ ids }) => {
      const comparedIds = catalog.compareItems(ids);
      return JSON.stringify({ comparedIds });
    },
  });

  useTool(client, "get_cart", {
    description: "現在のカートの商品・数量・合計金額と画面の選択状態を読む。人が変更した結果を引き継ぐため、セットを組む前に使う。",
    schema: z.object({}).strict(),
    execute: () => {
      const current = catalog.getState();
      return JSON.stringify({
        ...cartSummary(current.cart, current.data.items),
        comparedIds: current.comparedIds,
        shownIds: current.shownIds,
      });
    },
  });

  // カートのボタンと同じ操作を呼ぶ。
  useTool(client, "set_cart_quantity", {
    description: "1商品のカート内数量を指定値にする。0なら削除。在庫数を超える操作は失敗する。購入確定は行わない。",
    schema: z.object({
      id: z.string().max(80).trim().min(1),
      quantity: z.number().int().min(0).max(9999),
    }).strict(),
    execute: ({ id, quantity }) =>
      JSON.stringify(catalog.setQuantity(id, quantity)),
  });

  useTool(client, "replace_cart", {
    description: "カート全体を指定したセットに置き換える。予算がある場合はmaxTotalも渡す。予算・在庫の検証に失敗するとカートは一切変更しない。購入確定は行わない。",
    schema: z.object({
      lines: z.array(z.object({
        itemId: z.string().max(80).trim().min(1),
        quantity: z.number().int().min(1).max(9999),
      }).strict()).max(100),
      maxTotal: z.number().int().min(0).max(100_000_000).optional(),
    }).strict(),
    execute: ({ lines, maxTotal }) => JSON.stringify(catalog.replaceCart(lines, maxTotal)),
  });

  useTool(client, "open_checkout", {
    description: "購入内容と合計を確認する画面を開く。最終確定は利用者が画面のボタンを押す。実際の課金や配送のないデモ。",
    schema: z.object({}).strict(),
    execute: () => JSON.stringify({
      ...catalog.openCheckout(),
      status: "awaiting_human_confirmation",
      message: "購入確認を表示しました。画面の確定ボタンは利用者が押します。実際の決済はありません。",
    }),
  });

  return (
    <SessionControls session={session} creating={creating} error={error} onNew={onNew}>
      <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
    </SessionControls>
  );
}

export default function App() {
  const catalog = useCatalog({
    initialData,
    storageKey: "subako-hackathon:ec-coffee:v1",
  });
  const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
  const storageKey = `hackathon:session:ec-coffee:${baseUrl}`;
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
          <CatalogView store={catalog} />
        </div>
        <div id="app-dialogs" className="app-dialog-host" />
      </div>
      <aside className="session-sidebar" aria-label="アシスタント">
        <header className="session-header">
          <h2>いっしょに、選ぼう。</h2>
          <p>好みや予算から、ぴったりの組み合わせを。</p>
        </header>
        <div className="session-content">
          {sessionId ? (
            <SubakoProvider
              key={sessionId}
              client={subako}
              onError={() => setConnectionError("接続できません。agentのOrigin設定と開発サーバーを確認してください。")}
            >
              {connectionError && <p className="session-error" role="alert">{connectionError}</p>}
              <Assistant
                key={sessionId}
                sessionId={sessionId}
                catalog={catalog}
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
