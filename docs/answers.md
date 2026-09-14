# 解答編：スターターから完成例への差分

「普通のReactアプリのどこにSubakoを足したか」を答え合わせするための資料です。各節の折りたたみには、**このリポジトリの実ファイルから取得したdiff**を載せています。`+` は追加、`-` は削除、行頭が空白の行は変更していない前後のコードです。

| 題材 | スターター | 完成例 | この資料 |
| --- | --- | --- | --- |
| TODO | [`apps/todo`](../apps/todo) | [`apps/todo-integrated`](../apps/todo-integrated) | [TODOの差分](#todo-answer) |
| EC | [`apps/ec`](../apps/ec) | [`apps/ec-coffee`](../apps/ec-coffee) | [ECの差分](#ec-answer) |
| Map | [`apps/map`](../apps/map) | [`apps/map-coffee`](../apps/map-coffee) | [Mapの差分](#map-answer) |

スターターには汎用の初期データがあります。TODOは[作業3件](../apps/todo/src/data.json)、ECは[商品A〜D](../apps/ec/data/catalog.json)、Mapは[架空の地点A〜D](../apps/map/src/data.json)です。SDKを追加する前から、これらのデータで手動操作を試せます。JSONは保存データがないときの初期データです。操作状態は `localStorage` に保存され、再読み込み後も引き継ぎます。JSONを編集しても、保存済みのデータは自動で上書きされません。

## まず見るところ

3組とも、次の順序で読みます。

1. **SDKをインストールする。** `package.json` にSubako・assistant-ui・Zodの依存を追加します。
2. **会話につなぐ。** `SubakoSessionClient` → `SubakoProvider` → `useSession` でつなぎます。会話はアプリが作り、IDを `localStorage` に覚えます。
3. **既存の操作を登録する。** `useToolClient` と `useTool` を追加し、`execute` から今のstateを読むか、ボタンでも使っている関数を呼びます。
4. **会話を表示する。** 既存画面の隣にサイドバーを置き、`SubakoChat` にセッションを渡します。
5. **必要な追加UIを足す。** 完成例には新しいセッションのボタン、接続エラー表示、ツール結果の表示調整もあります。

引数は `schema: z.object({ ... }).strict()` で定義します。`.strict()` は未定義の引数を拒否し、`.default()` は省略時の値、`.optional()` は省略できる項目を表します。`execute` の引数の型もZodから推論されます。

ツールの名前・説明・引数は、連携版の `App.tsx` で初めて定義しています。スターターのstateや操作関数を、エージェント用の仕組みに置き換える変更はありません。`metadata` も通常のデータの一部で、必要な属性をツールの結果として返すことでエージェントが判断に使えます。

### 自分のスターターに適用するときの設定

以下のdiffは、別ディレクトリに置いた完成例との比較です。スターターを編集している場合は、**そのアプリの名前・ポート・保存キー・環境変数を引き続き使います。** 完成例の値に変えている箇所は、6アプリを並べて動かすための差分です。

| 設定 | TODOを編集 | ECを編集 | Mapを編集 |
| --- | --- | --- | --- |
| npmの対象 | `@hackathon/todo` | `@hackathon/ec` | `@hackathon/map` |
| publish・起動コマンドの引数 | `todo` | `ec` | `map` |
| ポート | `5173` | `5177` | `5175` |
| agentの変数（publishが更新） | `SUBAKO_AGENT_TODO` | `SUBAKO_AGENT_EC` | `SUBAKO_AGENT_MAP` |
| アプリのデータ保存キー | `hackathon:todo` | `subako-hackathon:ec:v1` | `hackathon-map-v1` |
| 会話の保存キーのアプリ名 | `todo` | `ec` | `map` |

会話の保存キーは、完成例と同じ `hackathon:session:<アプリ名>:<baseUrl>` の形にします。アプリのデータ保存キーとは別です。

CLIの導入、アカウント・workspace・APIキーの準備を済ませたら、たとえばTODOならルートで次を実行します。EC・Mapは上の表に合わせます。

```sh
npm install --workspace @hackathon/todo @subako-ai/sdk@0.1.2 @subako-ai/react@0.1.2 @subako-ai/assistant-ui@0.1.2 @assistant-ui/react@0.15.19 @assistant-ui/react-markdown@0.14.15 zod@4.6.4
npm run agent:publish -- todo
npm run dev -- todo
```

APIキーはルートの `.env.local` の `SUBAKO_API_KEY` に置きます。`VITE_` が付かないので**ブラウザーへは渡りません**。`.env.local` はすでにGitの対象外です。publishスクリプトが対象アプリのagentと許可Originを準備し、`SUBAKO_AGENT_*` を更新します。起動済みなら開発サーバーを再起動します。

`package.json` の依存の追加に加え、`npm install` によってルートの `package-lock.json` も更新されます。ルートのSDKは運営が用意したスクリプト用で、未連携アプリ自身にはSDK依存がありません。

<a id="todo-answer"></a>

## TODO：追加フォームとチェックボックスをAIから使う

**解答の中心は、既存の `getItems`・`add`・`complete` を会話コンポーネントへ渡すことです。** `App` 内の起動時の読み込みとブラウザーへの保存処理、追加・完了・削除の関数はそのままです。

TODOスターターの手順3・5・6には「新しいセッション」ボタンと作成失敗時の再試行も入っています。コメントを解除するだけで、TODOのデータを残して会話を作り直せます。完成例では、この表示を `SessionControls.tsx` に分けています。

| ツール | `execute` が使う既存の値・関数 | アプリで確かめること |
| --- | --- | --- |
| `list_todos` | `getItems()` | 手で追加・完了した最新の一覧が返る |
| `add_todo` | `add(title)` | フォームで追加したときと同じ一覧に増える |
| `set_todo_done` | `complete(id, done)` | 同じTODOのチェックが切り替わる |

`useToolClient(session, "todo")` でこのアプリのツールを登録し、`useTool` の `execute` が操作結果を返します。`getItems()` は追加・完了・削除でも使う読み取り関数です。連続した操作でも、直前の変更を検証・返却できるよう、アプリ内のrefから現在の一覧を読みます。画面への表示は通常のReact stateで行います。

### 変更するファイル

| ファイル | 変更内容 |
| --- | --- |
| `package.json` | SDK・assistant-ui・Zodの追加。`name` の差分は完成例を別アプリとして起動するため |
| `src/App.tsx` | 接続、3つのツール、サイドバー、会話選択のstateを追加 |
| `src/session.css`・`src/session.ts` | スターターにも最初から置いてあります。importして使うだけです |
| `src/SessionControls.tsx`（追加） | 新しいセッションとツール結果の表示。全文は[追加UIの差分](#session-answer) |
| `vite.config.ts` | 新しいセッションを作るAPIを追加。最小のチャット連携では変更不要 |

`src/data.json`・`src/model.ts`・`src/style.css`・`src/layout.css`・`src/main.tsx`・`src/model.test.ts` は、スターターと完成例で同じ内容です。`agents/todo/prompt.md` と `agents/todo-integrated/prompt.md` も同じ指示です。


<details>
<summary>TODO：package.json の実際のdiff</summary>

```diff
--- apps/todo/package.json
+++ apps/todo-integrated/package.json
@@ -1,5 +1,5 @@
 {
-  "name": "@hackathon/todo",
+  "name": "@hackathon/todo-integrated",
   "version": "1.0.0",
   "private": true,
   "type": "module",
@@ -9,7 +9,13 @@
     "typecheck": "tsc --noEmit"
   },
   "dependencies": {
+    "@assistant-ui/react": "0.15.19",
+    "@assistant-ui/react-markdown": "0.14.15",
+    "@subako-ai/assistant-ui": "0.1.2",
+    "@subako-ai/react": "0.1.2",
+    "@subako-ai/sdk": "0.1.2",
     "react": "19.2.0",
-    "react-dom": "19.2.0"
+    "react-dom": "19.2.0",
+    "zod": "4.6.4"
   }
 }
```

</details>


<details>
<summary>TODO：src/App.tsx の実際のdiff</summary>

```diff
--- apps/todo/src/App.tsx
+++ apps/todo-integrated/src/App.tsx
@@ -1,91 +1,61 @@
 import { useEffect, useRef, useState, type FormEvent } from "react";
+import { z } from "zod";
+import { SubakoSessionClient } from "@subako-ai/sdk";
+import { SubakoProvider, useSession, useTool, useToolClient } from "@subako-ai/react";
+import { SubakoChat } from "@subako-ai/assistant-ui";
+import { SessionControls, SessionPending, SafeToolResult } from "./SessionControls";
+import { fetchSessionToken, useSessionId } from "./session";
 import { createTodo, parseTodos, setTodoDone, type Todo } from "./model";
 import data from "./data.json";
 import "./style.css";
 import "./layout.css";
-import "./session.css";
-
-// ──────────────────────────────────────────────────────────────
-// TODO(1) SDKと、同じフォルダの session.ts をimportする
-//    session.ts は最初から置いてあります。先に npm install を済ませてください。
-//    session.css はサイドバーの枠に使うので、すでに上でimportしています。
-// ──────────────────────────────────────────────────────────────
-// import { z } from "zod";
-// import { SubakoSessionClient } from "@subako-ai/sdk";
-// import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
-// import { SubakoChat } from "@subako-ai/assistant-ui";
-// import { fetchSessionToken, useSessionId } from "./session";

 const initialItems: Todo[] = parseTodos(data);
-const storageKey = "hackathon:todo";
+const storageKey = "hackathon:todo-integrated";
+const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
+const sessionStorageKey = `hackathon:session:todo-integrated:${baseUrl}`;
+// APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
+const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });
+
+function Assistant({ getItems, add, complete, sessionId, creating, error, onNew }: {
+  getItems: () => Todo[];
+  add: (title: string) => Todo;
+  complete: (id: string, done: boolean) => Todo;
+  sessionId: string;
+  creating: boolean;
+  error: string;
+  onNew: () => void;
+}) {
+  const session = useSession(sessionId);
+  const client = useToolClient(session, "todo");

-// ──────────────────────────────────────────────────────────────
-// TODO(2) 会話につなぐクライアントを用意する
-//    APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
-// ──────────────────────────────────────────────────────────────
-// const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
-// const sessionStorageKey = `hackathon:session:todo:${baseUrl}`;
-// const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });
+  useTool(client, "list_todos", {
+    description: "現在のTODO一覧を取得します。",
+    schema: z.object({}).strict(),
+    execute: () => JSON.stringify(getItems()),
+  });
+  useTool(client, "add_todo", {
+    description: "TODOを1件追加します。",
+    schema: z.object({ title: z.string().max(300).trim().min(1) }).strict(),
+    // フォームと同じ追加関数を呼びます。
+    execute: ({ title }) => JSON.stringify(add(title)),
+  });
+  useTool(client, "set_todo_done", {
+    description: "指定したTODOを完了・未完了にします。",
+    schema: z.object({ id: z.string(), done: z.boolean() }).strict(),
+    execute: ({ id, done }) => JSON.stringify(complete(id, done)),
+  });

-// ──────────────────────────────────────────────────────────────
-// TODO(3) 会話を担当するコンポーネントを追加する
-//    execute の中身は、フォームが使っている add() をそのまま呼ぶだけです。
-// ──────────────────────────────────────────────────────────────
-// function TodoAssistant({ getItems, add, complete, sessionId, creating, error, onNew }: {
-//   getItems: () => Todo[];
-//   add: (title: string) => Todo;
-//   complete: (id: string, done: boolean) => Todo;
-//   sessionId: string;
-//   creating: boolean;
-//   error: string;
-//   onNew: () => void;
-// }) {
-//   const session = useSession(sessionId);
-//   const client = useToolClient(session, "todo");
-//   const state = useSessionState(session);
-//   const running = state?.isRunning && state.status !== "failed";
-//   const connecting = !state || state.status === "connecting" || state.status === "reconnecting";
-//
-//   useTool(client, "list_todos", {
-//     description: "現在のTODOを取得する。",
-//     schema: z.object({}).strict(),
-//     execute: () => JSON.stringify(getItems()),
-//   });
-//
-//   useTool(client, "add_todo", {
-//     description: "TODOを1件追加する。",
-//     schema: z.object({ title: z.string().max(300).trim().min(1) }).strict(),
-//     execute: ({ title }) => JSON.stringify(add(title)),
-//   });
-//
-//   // TODO(4) ここに完了ツールを足す。ここだけ雛形がありません。
-//   //   ツール名  set_todo_done
-//   //   説明      一覧で取得したidのTODOを完了・未完了にする。
-//   //   引数      id: string / done: boolean
-//   //   execute   complete(id, done) を呼び、JSON.stringify で返す
-//
-//   return (
-//     <div className="session-conversation" aria-busy={creating}>
-//       <div className="session-toolbar">
-//         <button
-//           type="button"
-//           disabled={creating || running || connecting}
-//           onClick={onNew}
-//           title="会話を新しくします。TODOのデータは引き継がれます。"
-//         >
-//           {creating ? "作成中…" : "＋ 新しいセッション"}
-//         </button>
-//         {running && <span>応答後、または停止後に切り替えられます。</span>}
-//         {error && <p className="session-error" role="alert">{error}</p>}
-//       </div>
-//       <div className="session-chat" inert={creating}>
-//         <SubakoChat session={session} />
-//       </div>
-//     </div>
-//   );
-// }
+  return (
+    <SessionControls session={session} creating={creating} error={error} onNew={onNew}>
+      <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
+    </SessionControls>
+  );
+}

 export default function App() {
+  const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
+  const [connectionError, setConnectionError] = useState("");
   const [initial] = useState(() => {
     try {
       const saved = localStorage.getItem(storageKey);
@@ -99,13 +69,6 @@ export default function App() {
   const [error, setError] = useState(initial.error);
   const [title, setTitle] = useState("");
   const [filter, setFilter] = useState<"all" | "active" | "done">("all");
-
-  // ──────────────────────────────────────────────────────────────
-  // TODO(5) 使う会話を用意する
-  //    保存済みの会話があれば続きから、無ければ新しく作ります。
-  //    startNew は会話だけを作り直し、TODOは残します。
-  // ──────────────────────────────────────────────────────────────
-  // const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
   const active = items.filter((item) => !item.done).length;
   const visible = items.filter(
     (item) => filter === "all" || (filter === "done" ? item.done : !item.done),
@@ -269,40 +232,30 @@ export default function App() {
           </div>
         </div>
       </div>
-
       <aside className="session-sidebar" aria-label="TODOアシスタント">
-        <header className="session-header">
+        <header>
+          <span>SUBAKO / SESSION</span>
           <h2>TODOアシスタント</h2>
           <p>会話しながら、アプリを操作できます。</p>
         </header>
         <div className="session-content">
-          <p>ここに会話が入ります。</p>
-          {/* TODO(6) 上の <p> を消し、下の JSX コメントを解除します。 */}
-          {/*
-            {sessionId ? (
-              <SubakoProvider client={subako}>
-                <TodoAssistant
-                  key={sessionId}
-                  getItems={getItems}
-                  add={add}
-                  complete={complete}
-                  sessionId={sessionId}
-                  creating={creating}
-                  error={sessionError}
-                  onNew={startNew}
-                />
-              </SubakoProvider>
-            ) : (
-              <div className="session-toolbar" aria-busy={creating}>
-                {creating ? (
-                  <span>会話を準備しています…</span>
-                ) : (
-                  <button type="button" onClick={startNew}>もう一度試す</button>
-                )}
-                {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
-              </div>
-            )}
-          */}
+          {connectionError && <p className="session-error" role="alert">{connectionError}</p>}
+          {sessionId ? (
+            <SubakoProvider client={subako} onError={() => setConnectionError("接続できません。agentのOrigin設定と開発サーバーを確認してください。") }>
+              <Assistant
+                key={sessionId}
+                getItems={getItems}
+                add={add}
+                complete={complete}
+                sessionId={sessionId}
+                creating={creating}
+                error={sessionError}
+                onNew={startNew}
+              />
+            </SubakoProvider>
+          ) : (
+            <SessionPending creating={creating} error={sessionError} onRetry={startNew} />
+          )}
         </div>
       </aside>
     </div>
```

</details>


<details>
<summary>TODO：vite.config.ts の実際のdiff</summary>

```diff
--- apps/todo/vite.config.ts
+++ apps/todo-integrated/vite.config.ts
@@ -6,7 +6,7 @@ import { subakoDevApi } from "../../scripts/subako-dev-api.ts";
 const envDir = fileURLToPath(new URL("../../", import.meta.url));
 const codespace = process.env.CODESPACE_NAME;
 const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
-const host = codespace && domain ? `${codespace}-5173.${domain}` : undefined;
+const host = codespace && domain ? `${codespace}-5174.${domain}` : undefined;
 
 export default defineConfig(({ mode }) => {
   const env = loadEnv(mode, envDir, ["SUBAKO_", "VITE_SUBAKO_"]);
@@ -16,16 +16,16 @@ export default defineConfig(({ mode }) => {
       // APIキーを持つのは開発サーバーだけです。ブラウザーはこの口から会話に入ります。
       subakoDevApi({
         apiKey: env.SUBAKO_API_KEY ?? "",
-        agentId: env.SUBAKO_AGENT_TODO ?? "",
+        agentId: env.SUBAKO_AGENT_TODO_INTEGRATED ?? "",
         baseUrl: env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai",
-        title: "TODO・スタート",
+        title: "TODO・Subako連携",
       }),
     ],
     envDir,
-    preview: { port: 5173, strictPort: true },
+    preview: { port: 5174, strictPort: true },
     server: {
       host: "0.0.0.0",
-      port: 5173,
+      port: 5174,
       strictPort: true,
       ...(host ? { allowedHosts: [host] } : {}),
     },
```

</details>


最初は `SessionControls` を使わず、`return <SubakoChat session={session} />` だけでも会話できます。その場合は `session.css` を `App.tsx` で直接importします。`session.ts` は会話を作るのに必要なので、最小の連携でも使います。完成例では `SessionControls.tsx` がこのCSSをimportしています。3つのツールを残したまま、後から会話の切り替えを追加できます。

- [ ] 手でTODOを1件追加し、AIに現在の一覧を読んでもらえた。
- [ ] AIで追加したTODOを手で完了にし、その変更をAIの回答に反映できた。

<a id="ec-answer"></a>

## EC：既存のカタログ・比較・カートをAIから使う

**解答の中心は、`useCatalog` が返す `catalog` を会話コンポーネントへ渡すことです。** `CatalogView` と会話が同じカタログのstateと操作関数を使います。

スターターの `App.tsx` には、手順1〜6に完成した連携コードをコメントで用意しています。手順3の中の手順4も含めて解除し、手順6の案内どおりに会話の表示を有効にすると、以下のツールをすべて使えます。コードを書き足す必要はなく、データ・prompt・Skills・MCPの工夫から始められます。

| ツール | `execute` が使う値・関数 | アプリでの役割 |
| --- | --- | --- |
| `search_items` | `searchCatalog(catalog.getState().data.items, query, maxPrice)` | 商品検索。検索結果を返し、画面は変えない |
| `get_item` | `catalog.getState().data.items` | IDで商品の詳細・metadataを取得 |
| `show_items` | `catalog.showItems(ids)` | 提案した候補を一覧に表示 |
| `show_all_items` | `catalog.showItems(null)` | 全商品を表示 |
| `compare_items` | `catalog.compareItems(ids)` | 最大3点を比較パネルに表示 |
| `get_cart` | `cartSummary(...)` と `catalog.getState()` | 現在の数量・合計・選択状態を読む |
| `set_cart_quantity` | `catalog.setQuantity(id, quantity)` | 数量を変更 |
| `replace_cart` | `catalog.replaceCart(lines, maxTotal)` | 在庫・予算を検証してセット全体を変更 |
| `open_checkout` | `catalog.openCheckout()` | 確認ダイアログを開く。確定は利用者のボタン操作 |

`schema` にZodで引数の形と制約を定義します。SDKがAIへ渡すJSON Schemaを生成し、実行前に引数を検証します。`execute` の引数はそのスキーマから型が推論され、既存のアプリの操作を呼びます。在庫や予算などの業務ルールは、元からあるカタログの関数で検証します。雛形には9つのツールが入っています。最初のデモは「商品AとBを比較して、予算2,000円で各1点をカートに入れて」で、比較とカートの変化を確認します。

`useCatalog` の `getState()` は、元からある `latest` refから現在値を返し、更新直後の読み取りツールにも変更を伝えます。スターターにも最初からあるので、ツールの `execute` からは `catalog.state` ではなく `catalog.getState()` を読みます。`catalog.state` は描画時点の値なので、1回の応答で操作と読み取りが続くと古い値を返します。

### 変更するファイル

| ファイル | 変更内容 |
| --- | --- |
| `package.json`・`src/App.tsx` | SDK・Zodの依存、接続、ツール、会話の表示を追加 |
| `src/session.ts`・`src/session.css` | スターターにも最初から置いてあります。importして使うだけです |
| `src/SessionControls.tsx`（追加） | 会話の切り替えUI。全文は[追加UIの差分](#session-answer) |
| `vite.config.ts` | 会話を作るAPIはスターターにも準備済み。コメント解除時の編集は不要 |
| `src/CatalogView.tsx`・`src/style.css` | 完成例側の文言・商品イラストをコーヒー向けに編集 |
| `data/catalog.json` | 汎用の商品A〜Dからコーヒー豆のデータへ変更 |
| `index.html`・`agents/ec-coffee/prompt.md` | 作品名と、コーヒー豆を提案する指示 |

`src/model.ts`・`src/useCatalog.ts`・`src/Dialog.tsx`・`src/layout.css`・`src/main.tsx`・`src/model.test.ts` と `data/schema.json` は同じ内容です。`src/CatalogView.tsx` と `src/style.css` は、完成例側でコーヒー作品の表示に編集しています。

### コーヒーという題材の差分

SDK導入時は自分の `data/catalog.json`・`initialData`・`CatalogView` をそのまま使います。完成例は[コーヒーデータ](../apps/ec-coffee/data/catalog.json)を入れ、コピー先の `CatalogView.tsx` の文言と商品イラスト、`style.css` をコーヒー作品向けに編集しています。両方の呼び出しは `<CatalogView store={catalog} />` です。ツール説明にある産地・味などの例も、自分のデータの属性に合わせられます。


<details>
<summary>EC：package.json の実際のdiff</summary>

```diff
--- apps/ec/package.json
+++ apps/ec-coffee/package.json
@@ -1,5 +1,5 @@
 {
-  "name": "@hackathon/ec",
+  "name": "@hackathon/ec-coffee",
   "version": "0.0.0",
   "private": true,
   "type": "module",
@@ -9,7 +9,13 @@
     "typecheck": "tsc --noEmit"
   },
   "dependencies": {
+    "@assistant-ui/react": "0.15.19",
+    "@assistant-ui/react-markdown": "0.14.15",
+    "@subako-ai/assistant-ui": "0.1.2",
+    "@subako-ai/react": "0.1.2",
+    "@subako-ai/sdk": "0.1.2",
     "react": "19.2.0",
-    "react-dom": "19.2.0"
+    "react-dom": "19.2.0",
+    "zod": "4.6.4"
   }
 }
```

</details>


<details>
<summary>EC：src/App.tsx の実際のdiff</summary>

```diff
--- apps/ec/src/App.tsx
+++ apps/ec-coffee/src/App.tsx
@@ -1,198 +1,153 @@
+import { useMemo, useState } from "react";
+import { z } from "zod";
+import { SubakoSessionClient } from "@subako-ai/sdk";
+import { SubakoChat } from "@subako-ai/assistant-ui";
+import { SubakoProvider, useSession, useTool, useToolClient } from "@subako-ai/react";
 import { CatalogView } from "./CatalogView";
-import { useCatalog } from "./useCatalog";
-import { validateCatalog } from "./model";
+import { useCatalog, type CatalogStore } from "./useCatalog";
+import { cartSummary, searchCatalog, validateCatalog } from "./model";
+import { SessionControls, SessionPending, SafeToolResult } from "./SessionControls";
+import { fetchSessionToken, useSessionId } from "./session";
 import catalogData from "../data/catalog.json";

-// TODO(1) SDKと準備済みの関数をimportする
-// 先にREADMEの npm install を実行します。session.css は main.tsx がimport済みです。
-// import { z } from "zod";
-// import { SubakoSessionClient } from "@subako-ai/sdk";
-// import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
-// import { SubakoChat, SubakoToolApproval } from "@subako-ai/assistant-ui";
-// import type { ToolCallMessagePartProps } from "@assistant-ui/react";
-// import { fetchSessionToken, useSessionId } from "./session";
-// import type { CatalogStore } from "./useCatalog";
-// import { cartSummary, searchCatalog } from "./model";
-
 const initialData = validateCatalog(catalogData);

-// TODO(2) 会話につなぐクライアントを用意する
-// 会話ごとのtokenを開発サーバーから受け取ります。
-// const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
-// const sessionStorageKey = `hackathon:session:ec:${baseUrl}`;
-// const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });
+function Assistant({
+  sessionId,
+  catalog,
+  creating,
+  error,
+  onNew,
+}: {
+  sessionId: string;
+  catalog: CatalogStore;
+  creating: boolean;
+  error: string;
+  onNew: () => void;
+}) {
+  const session = useSession(sessionId);
+  const client = useToolClient(session, "shop");
+
+  // 既存の検索関数を、このセッションのツールとして登録する。
+  useTool(client, "search_items", {
+    description:
+      "商品を検索する。queryを空にすると全商品を取得できる。metadataの産地・味・用途も返るため、提案前に使う。maxPriceは1点あたりの上限額。画面は変更しない。",
+    schema: z.object({
+      query: z.string().max(200).trim().default(""),
+      maxPrice: z.number().int().min(0).max(100_000_000).optional(),
+    }).strict(),
+    execute: ({ query, maxPrice }) =>
+      JSON.stringify(searchCatalog(catalog.getState().data.items, query, maxPrice)),
+  });

-// TODO(3) 会話・検索・表示のコードを有効にする
-// 手順4を含め、次の関数をまとめてコメント解除します。
-// // 補足データは省略し、操作の状態と承認ボタンを表示します。
-// function SafeToolResult(props: ToolCallMessagePartProps) {
-//   const { result, isError, approval } = props;
-//   const waiting = approval && approval.approved === undefined && approval.resolution === undefined;
-//   let message = result === undefined ? "アプリを操作しています…" : "アプリの操作結果を受け取りました";
-//   if (isError) message = "アプリの操作に失敗しました";
-//   if (waiting) message = "操作の承認を待っています";
-//   if (approval?.approved === false) message = "操作を許可しませんでした";
-//   if (approval?.resolution) message = "操作の承認待ちは終了しました";
-//
-//   return (
-//     <div className="tool-status">
-//       <span className={isError ? "session-error" : undefined}>{message}</span>
-//       <SubakoToolApproval {...props} />
-//     </div>
-//   );
-// }
-//
-// function Assistant({
-//   sessionId,
-//   catalog,
-//   creating,
-//   error,
-//   onNew,
-// }: {
-//   sessionId: string;
-//   catalog: CatalogStore;
-//   creating: boolean;
-//   error: string;
-//   onNew: () => void;
-// }) {
-//   const session = useSession(sessionId);
-//   const client = useToolClient(session, "shop");
-//
-//   // 既存の検索関数を、このセッションのツールとして登録する。
-//   useTool(client, "search_items", {
-//     description:
-//       "商品を検索する。queryを空にすると全商品を取得できる。metadataの素材・用途なども返るため、提案前に使う。maxPriceは1点あたりの上限額。画面は変更しない。",
-//     schema: z.object({
-//       query: z.string().max(200).trim().default(""),
-//       maxPrice: z.number().int().min(0).max(100_000_000).optional(),
-//     }).strict(),
-//     execute: ({ query, maxPrice }) =>
-//       JSON.stringify(searchCatalog(catalog.getState().data.items, query, maxPrice)),
-//   });
-//
-//   useTool(client, "get_item", {
-//     description: "1商品の詳細をmetadata込みで取得する。画面には表示されない属性や用途も判断に使える。",
-//     schema: z.object({ id: z.string().max(80).trim().min(1) }).strict(),
-//     execute: ({ id }) => {
-//       const item = catalog.getState().data.items.find((entry) => entry.id === id);
-//       if (!item) throw new Error(`商品「${id}」が見つかりません。`);
-//       return JSON.stringify(item);
-//     },
-//   });
-//
-//   useTool(client, "show_items", {
-//     description: "指定した商品だけを画面の一覧に表示する。提案する候補が決まったら使う。idsの順に表示する。空配列なら何も表示しない。",
-//     schema: z.object({
-//       ids: z.array(z.string().max(80).trim().min(1)).max(100),
-//     }).strict(),
-//     execute: ({ ids }) => {
-//       const shownIds = catalog.showItems(ids);
-//       return JSON.stringify({ shownIds });
-//     },
-//   });
-//
-//   useTool(client, "show_all_items", {
-//     description: "候補の絞り込みを解除して、画面を全商品の表示に戻す。",
-//     schema: z.object({}).strict(),
-//     execute: () => {
-//       catalog.showItems(null);
-//       return "全商品を表示しました。";
-//     },
-//   });
-//
-//   // TODO(4) 比較とカートの操作ツールを登録する
-//   useTool(client, "compare_items", {
-//     description: "最大3点を画面で比較する。商品名・説明・価格を比較パネルに並べる。metadataによる違いは会話で説明する。",
-//     schema: z.object({
-//       ids: z.array(z.string().max(80).trim().min(1)).max(3),
-//     }).strict(),
-//     execute: ({ ids }) => {
-//       const comparedIds = catalog.compareItems(ids);
-//       return JSON.stringify({ comparedIds });
-//     },
-//   });
-//
-//   useTool(client, "get_cart", {
-//     description: "現在のカートの商品・数量・合計金額と画面の選択状態を読む。人が変更した結果を引き継ぐため、セットを組む前に使う。",
-//     schema: z.object({}).strict(),
-//     execute: () => {
-//       const current = catalog.getState();
-//       return JSON.stringify({
-//         ...cartSummary(current.cart, current.data.items),
-//         comparedIds: current.comparedIds,
-//         shownIds: current.shownIds,
-//       });
-//     },
-//   });
-//
-//   // カートのボタンと同じ操作を呼ぶ。
-//   useTool(client, "set_cart_quantity", {
-//     description: "1商品のカート内数量を指定値にする。0なら削除。在庫数を超える操作は失敗する。購入確定は行わない。",
-//     schema: z.object({
-//       id: z.string().max(80).trim().min(1),
-//       quantity: z.number().int().min(0).max(9999),
-//     }).strict(),
-//     execute: ({ id, quantity }) =>
-//       JSON.stringify(catalog.setQuantity(id, quantity)),
-//   });
-//
-//   useTool(client, "replace_cart", {
-//     description: "カート全体を指定したセットに置き換える。予算がある場合はmaxTotalも渡す。予算・在庫の検証に失敗するとカートは一切変更しない。購入確定は行わない。",
-//     schema: z.object({
-//       lines: z.array(z.object({
-//         itemId: z.string().max(80).trim().min(1),
-//         quantity: z.number().int().min(1).max(9999),
-//       }).strict()).max(100),
-//       maxTotal: z.number().int().min(0).max(100_000_000).optional(),
-//     }).strict(),
-//     execute: ({ lines, maxTotal }) => JSON.stringify(catalog.replaceCart(lines, maxTotal)),
-//   });
-//
-//   useTool(client, "open_checkout", {
-//     description: "購入内容と合計を確認する画面を開く。最終確定は利用者が画面のボタンを押す。実際の課金や配送のないデモ。",
-//     schema: z.object({}).strict(),
-//     execute: () => JSON.stringify({
-//       ...catalog.openCheckout(),
-//       status: "awaiting_human_confirmation",
-//       message: "購入確認を表示しました。画面の確定ボタンは利用者が押します。実際の決済はありません。",
-//     }),
-//   });
-//
-//   const state = useSessionState(session);
-//   const running = state?.isRunning && state.status !== "failed";
-//   const connecting = !state || state.status === "connecting" || state.status === "reconnecting";
-//
-//   return (
-//     <div className="session-conversation" aria-busy={creating}>
-//       <div className="session-toolbar">
-//         <button
-//           type="button"
-//           disabled={creating || running || connecting}
-//           onClick={onNew}
-//           title="会話を新しくします。アプリのデータは引き継がれます。"
-//         >
-//           {creating ? "作成中…" : "＋ 新しいセッション"}
-//         </button>
-//         {running && <span>応答後、または停止後に切り替えられます。</span>}
-//         {error && <p className="session-error" role="alert">{error}</p>}
-//         {state?.status === "failed" && <p className="session-error" role="alert">接続できません。agentのOrigin設定と開発サーバーを確認してください。</p>}
-//       </div>
-//       <div className="session-chat" inert={creating}>
-//         <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
-//       </div>
-//     </div>
-//   );
-// }
+  useTool(client, "get_item", {
+    description: "1商品の詳細をmetadata込みで取得する。画面には表示されないフレーバーや相性も判断に使える。",
+    schema: z.object({ id: z.string().max(80).trim().min(1) }).strict(),
+    execute: ({ id }) => {
+      const item = catalog.getState().data.items.find((entry) => entry.id === id);
+      if (!item) throw new Error(`商品「${id}」が見つかりません。`);
+      return JSON.stringify(item);
+    },
+  });
+
+  useTool(client, "show_items", {
+    description: "指定した商品だけを画面の一覧に表示する。提案する候補が決まったら使う。idsの順に表示する。空配列なら何も表示しない。",
+    schema: z.object({
+      ids: z.array(z.string().max(80).trim().min(1)).max(100),
+    }).strict(),
+    execute: ({ ids }) => {
+      const shownIds = catalog.showItems(ids);
+      return JSON.stringify({ shownIds });
+    },
+  });
+
+  useTool(client, "show_all_items", {
+    description: "候補の絞り込みを解除して、画面を全商品の表示に戻す。",
+    schema: z.object({}).strict(),
+    execute: () => {
+      catalog.showItems(null);
+      return "全商品を表示しました。";
+    },
+  });
+
+  useTool(client, "compare_items", {
+    description: "最大3点を画面で比較する。商品名・説明・価格を比較パネルに並べる。味などmetadataによる違いは会話で説明する。",
+    schema: z.object({
+      ids: z.array(z.string().max(80).trim().min(1)).max(3),
+    }).strict(),
+    execute: ({ ids }) => {
+      const comparedIds = catalog.compareItems(ids);
+      return JSON.stringify({ comparedIds });
+    },
+  });
+
+  useTool(client, "get_cart", {
+    description: "現在のカートの商品・数量・合計金額と画面の選択状態を読む。人が変更した結果を引き継ぐため、セットを組む前に使う。",
+    schema: z.object({}).strict(),
+    execute: () => {
+      const current = catalog.getState();
+      return JSON.stringify({
+        ...cartSummary(current.cart, current.data.items),
+        comparedIds: current.comparedIds,
+        shownIds: current.shownIds,
+      });
+    },
+  });
+
+  // カートのボタンと同じ操作を呼ぶ。
+  useTool(client, "set_cart_quantity", {
+    description: "1商品のカート内数量を指定値にする。0なら削除。在庫数を超える操作は失敗する。購入確定は行わない。",
+    schema: z.object({
+      id: z.string().max(80).trim().min(1),
+      quantity: z.number().int().min(0).max(9999),
+    }).strict(),
+    execute: ({ id, quantity }) =>
+      JSON.stringify(catalog.setQuantity(id, quantity)),
+  });
+
+  useTool(client, "replace_cart", {
+    description: "カート全体を指定したセットに置き換える。予算がある場合はmaxTotalも渡す。予算・在庫の検証に失敗するとカートは一切変更しない。購入確定は行わない。",
+    schema: z.object({
+      lines: z.array(z.object({
+        itemId: z.string().max(80).trim().min(1),
+        quantity: z.number().int().min(1).max(9999),
+      }).strict()).max(100),
+      maxTotal: z.number().int().min(0).max(100_000_000).optional(),
+    }).strict(),
+    execute: ({ lines, maxTotal }) => JSON.stringify(catalog.replaceCart(lines, maxTotal)),
+  });
+
+  useTool(client, "open_checkout", {
+    description: "購入内容と合計を確認する画面を開く。最終確定は利用者が画面のボタンを押す。実際の課金や配送のないデモ。",
+    schema: z.object({}).strict(),
+    execute: () => JSON.stringify({
+      ...catalog.openCheckout(),
+      status: "awaiting_human_confirmation",
+      message: "購入確認を表示しました。画面の確定ボタンは利用者が押します。実際の決済はありません。",
+    }),
+  });
+
+  return (
+    <SessionControls session={session} creating={creating} error={error} onNew={onNew}>
+      <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
+    </SessionControls>
+  );
+}

 export default function App() {
   const catalog = useCatalog({
     initialData,
-    storageKey: "subako-hackathon:ec:v1",
+    storageKey: "subako-hackathon:ec-coffee:v1",
   });
-
-  // TODO(5) 保存済みの会話を開き、新しく始める操作を用意する
-  // 会話を切り替えても、アプリのデータは残ります。
-  // const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
+  const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
+  const storageKey = `hackathon:session:ec-coffee:${baseUrl}`;
+  const { sessionId, creating, error: sessionError, startNew } = useSessionId(storageKey);
+  const [connectionError, setConnectionError] = useState("");
+  // APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
+  const subako = useMemo(
+    () => new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken }),
+    [baseUrl],
+  );

   return (
     <div className="app-layout has-session">
@@ -202,38 +157,31 @@ export default function App() {
         </div>
         <div id="app-dialogs" className="app-dialog-host" />
       </div>
-
-      <aside className="session-sidebar" aria-label="ショップアシスタント">
+      <aside className="session-sidebar" aria-label="アシスタント">
         <header className="session-header">
-          <h2>ショップアシスタント</h2>
-          <p>会話しながら、商品を探せます。</p>
+          <h2>いっしょに、選ぼう。</h2>
+          <p>好みや予算から、ぴったりの組み合わせを。</p>
         </header>
         <div className="session-content">
-          <p>ここに会話が入ります。</p>
-          {/* TODO(6) 上の <p> を消し、下の JSX コメントを解除します。 */}
-          {/*
-            {sessionId ? (
-              <SubakoProvider client={subako}>
-                <Assistant
-                  key={sessionId}
-                  catalog={catalog}
-                  sessionId={sessionId}
-                  creating={creating}
-                  error={sessionError}
-                  onNew={startNew}
-                />
-              </SubakoProvider>
-            ) : (
-              <div className="session-toolbar" aria-busy={creating}>
-                {creating ? (
-                  <span>会話を準備しています…</span>
-                ) : (
-                  <button type="button" onClick={startNew}>もう一度試す</button>
-                )}
-                {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
-              </div>
-            )}
-          */}
+          {sessionId ? (
+            <SubakoProvider
+              key={sessionId}
+              client={subako}
+              onError={() => setConnectionError("接続できません。agentのOrigin設定と開発サーバーを確認してください。")}
+            >
+              {connectionError && <p className="session-error" role="alert">{connectionError}</p>}
+              <Assistant
+                key={sessionId}
+                sessionId={sessionId}
+                catalog={catalog}
+                creating={creating}
+                error={sessionError}
+                onNew={startNew}
+              />
+            </SubakoProvider>
+          ) : (
+            <SessionPending creating={creating} error={sessionError} onRetry={startNew} />
+          )}
         </div>
       </aside>
     </div>
```

</details>


<details>
<summary>EC：vite.config.ts の実際のdiff</summary>

```diff
--- apps/ec/vite.config.ts
+++ apps/ec-coffee/vite.config.ts
@@ -6,7 +6,7 @@ import { subakoDevApi } from "../../scripts/subako-dev-api.ts";
 const envDir = fileURLToPath(new URL("../../", import.meta.url));
 const codespace = process.env.CODESPACE_NAME;
 const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
-const host = codespace && domain ? `${codespace}-5177.${domain}` : undefined;
+const host = codespace && domain ? `${codespace}-5178.${domain}` : undefined;
 
 export default defineConfig(({ mode }) => {
   const env = loadEnv(mode, envDir, ["SUBAKO_", "VITE_SUBAKO_"]);
@@ -16,16 +16,16 @@ export default defineConfig(({ mode }) => {
       // APIキーを持つのは開発サーバーだけです。ブラウザーはこの口から会話に入ります。
       subakoDevApi({
         apiKey: env.SUBAKO_API_KEY ?? "",
-        agentId: env.SUBAKO_AGENT_EC ?? "",
+        agentId: env.SUBAKO_AGENT_EC_COFFEE ?? "",
         baseUrl: env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai",
-        title: "EC・スタート",
+        title: "コーヒー・バンドル",
       }),
     ],
     envDir,
-    preview: { port: 5177, strictPort: true },
+    preview: { port: 5178, strictPort: true },
     server: {
       host: "0.0.0.0",
-      port: 5177,
+      port: 5178,
       strictPort: true,
       ...(host ? { allowedHosts: [host] } : {}),
     },
```

</details>


<details>
<summary>EC：index.html の実際のdiff</summary>

```diff
--- apps/ec/index.html
+++ apps/ec-coffee/index.html
@@ -4,7 +4,7 @@
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta name="theme-color" content="#365341" />
-    <title>ECアプリ | Subako Hackathon</title>
+    <title>渋谷コーヒー | Subako Hackathon</title>
   </head>
   <body>
     <div id="root"></div>
```

</details>


<details>
<summary>EC：エージェントの指示のdiff</summary>

```diff
--- agents/ec/prompt.md
+++ agents/ec-coffee/prompt.md
@@ -3,5 +3,5 @@
 metadataには画面に表示しない判断材料があります。属性を判断に使い、必要な理由をわかりやすい自然文で伝えてください。
 ユーザーが手動で選んだ内容や固定した候補を尊重してください。操作が成功した後で完了を伝えます。
 不明な商品、価格、場所、座標、営業時間を作らず、不足条件は質問してください。
-このカタログの商品を、ユーザーの用途・希望・予算に合わせて提案します。登録された商品属性とmetadataを読み、比較や組み合わせの判断に使ってください。
+コーヒー豆の飲み比べセットを提案します。酸味、焙煎度、産地、フレーバーノート、好み、予算を使って候補を選びます。
 カートの合計・数量・在庫はアプリの関数の値を使います。決済は行わず、購入の最終確認はユーザーに任せます。
```

</details>


<details>
<summary>EC：題材の変更 — src/CatalogView.tsx の実際のdiff</summary>

```diff
--- apps/ec/src/CatalogView.tsx
+++ apps/ec-coffee/src/CatalogView.tsx
@@ -26,22 +26,22 @@ function ProductArt({
 }) {
   return (
     <div
-      className="ec-product-art"
+      className="ec-product-art ec-coffee-art"
       aria-hidden="true"
     >
       <span className="ec-art-number">
         {String(index + 1).padStart(2, "0")}
       </span>
       <div
-        className="ec-product-placeholder"
+        className="ec-product-bag"
         style={{ borderBottomColor: colors[index % colors.length] }}
       >
-        <span className="ec-placeholder-brand">SELECT</span>
-        <span className="ec-placeholder-mark">◇</span>
-        <span className="ec-placeholder-unit">{item.unit}</span>
+        <span className="ec-bag-brand">SHIBUYA</span>
+        <span className="ec-bag-mark">◒</span>
+        <span className="ec-bag-unit">{item.unit}</span>
       </div>
       <span className="ec-art-caption">
-        YOUR COLLECTION
+        COFFEE COLLECTION
       </span>
     </div>
   );
@@ -78,7 +78,7 @@ export function CatalogView({ store }: { store: CatalogStore }) {
         <a className="ec-brand" href="/" aria-label="ショップのホーム">
           <span className="ec-brand-symbol">s.</span>
           <span>
-            SELECT MARKET
+            SHIBUYA COFFEE
             <small>SUBAKO HACKATHON</small>
           </span>
         </a>
@@ -104,16 +104,16 @@ export function CatalogView({ store }: { store: CatalogStore }) {
         <section className="ec-intro">
           <div>
             <p className="ec-eyebrow">
-              MAKE IT YOUR OWN.
+              A LITTLE DISCOVERY, EVERY CUP.
             </p>
             <h1>{state.data.title}</h1>
             <p className="ec-description">{state.data.description}</p>
           </div>
           <div className="ec-intro-note">
-            <span>あなたがつくる</span>
-            <strong>新しい買い物体験</strong>
+            <span>渋谷をイメージした</span>
+            <strong>小さなコーヒー便</strong>
             <span>
-              気になる商品を、自由に組み合わせよう。
+              100gから、好みをひとつずつ。
             </span>
           </div>
         </section>
@@ -130,7 +130,7 @@ export function CatalogView({ store }: { store: CatalogStore }) {
         )}
         <p role="status" className="ec-notice">
           {state.notice ||
-            "変更はこのブラウザーに保存されます。"}
+            "商品・価格・在庫はハッカソン用の架空データです。実際の店舗の商品ではありません。"}
         </p>
 
         <div className="ec-layout">
@@ -397,7 +397,7 @@ export function CatalogView({ store }: { store: CatalogStore }) {
         <footer className="ec-footer">
           <span>SUBAKO HACKATHON · 2026.09.14</span>
           <span>
-            YOUR IDEA, YOUR COLLECTION
+            渋谷の街をイメージした架空の商品・デモ価格
           </span>
         </footer>
       </main>
```

</details>

<details>
<summary>EC：題材の変更 — src/style.css の実際のdiff</summary>

```diff
--- apps/ec/src/style.css
+++ apps/ec-coffee/src/style.css
@@ -286,6 +286,9 @@ input:focus-visible {
   background: #e9ede4;
   overflow: hidden;
 }
+.ec-coffee-art {
+  background: #efeee7;
+}
 .ec-product:nth-child(3n + 2) .ec-product-art {
   background: #e9ede6;
 }
@@ -300,30 +303,50 @@ input:focus-visible {
   font-size: 9px;
   letter-spacing: 0.05em;
 }
-.ec-product-placeholder {
-  width: 100px;
-  height: 100px;
+.ec-product-bag {
+  position: relative;
+  width: 79px;
+  height: 119px;
   background: #faf9f2;
   border: 1px solid #e4e2d6;
-  border-bottom: 4px solid;
-  border-radius: 12px;
+  border-bottom: 18px solid;
+  border-radius: 2px 2px 4px 4px;
+  transform: rotate(-5deg);
+  box-shadow:
+    9px 10px 14px #40412d14,
+    inset 3px 0 3px #fff;
   display: flex;
   flex-direction: column;
   align-items: center;
   justify-content: center;
 }
-.ec-placeholder-brand {
+.ec-product-bag::before {
+  content: "";
+  position: absolute;
+  inset: 6px 0 auto;
+  border-top: 2px solid #e9e7dd;
+}
+.ec-product-bag::after {
+  content: "";
+  position: absolute;
+  inset: auto 6px -13px;
+  border-top: 1px solid #ffffff50;
+}
+.ec-product:nth-child(2n) .ec-product-bag {
+  transform: rotate(4deg);
+}
+.ec-bag-brand {
   font-size: 7px;
   letter-spacing: 0.15em;
   font-family: Georgia, serif;
 }
-.ec-placeholder-mark {
+.ec-bag-mark {
   display: block;
   font-size: 30px;
   color: #687360;
   line-height: 1.6;
 }
-.ec-placeholder-unit {
+.ec-bag-unit {
   font-size: 7px;
   letter-spacing: 0.04em;
   color: #8b8e7f;
@@ -807,9 +830,11 @@ input:focus-visible {
   .ec-product-art {
     height: 155px;
   }
-  .ec-product-placeholder {
-    width: 90px;
-    height: 90px;
+  .ec-product-bag {
+    transform: scale(0.9) rotate(-5deg);
+  }
+  .ec-product:nth-child(2n) .ec-product-bag {
+    transform: scale(0.9) rotate(4deg);
   }
   .ec-product-name {
     font-size: 12px;
```

</details>

`catalog.json` の商品データ全文は[スターター](../apps/ec/data/catalog.json)と[完成例](../apps/ec-coffee/data/catalog.json)で比較できます。SDKのためにschemaを変える必要はありません。

- [ ] 自分の商品を読み、条件に合う候補が一覧に表示された。
- [ ] 手でカートを変更した後、AIが現在の数量・合計を読み取れた。
- [ ] AIが購入確認を開いても、最終確定は画面から行えた。

<a id="map-answer"></a>

## Map：既存の候補選択・訪問順・固定をAIから使う

**解答の中心は、`useMapApp` が返す `app` を会話コンポーネントへ渡すことです。** 画面のボタンとAIのツールが、同じ訪問リストを更新します。

スターターの `App.tsx` には、手順1〜6に完成した連携コードをコメントで用意しています。手順3の中の手順4も含めて解除し、手順6の案内どおりに会話の表示を有効にすると、以下のツールをすべて使えます。コードを書き足す必要はなく、データ・prompt・Skills・MCPの工夫から始められます。

| ツール | `execute` が使う値・関数 | アプリでの役割 |
| --- | --- | --- |
| `get_places` | `app.getState().items` | 登録地点とmetadataを読む。キーワードがあれば絞り込む |
| `get_map_state` | `app.getState()` と `getVisitSummary(...)` | 現在の候補・訪問順・固定・距離・時間を読む |
| `show_candidates` | `app.showCandidates(ids)` | 候補を地図と一覧で強調 |
| `set_visit_order` | `app.setVisitOrder(ids)` | 訪問順を更新。固定された地点を残す |
| `set_pinned` | `app.setPinned(id, pinned)` | 地点の固定を変更 |

雛形には5つのツールが入っています。最初のデモは「地点AとCを候補にして、A→Cの順で回りたい。Aは固定して」で、候補・訪問順・固定の変化を確認します。検索は今の `app.getState().items` を読み、画面の更新には既存の関数を呼びます。

`useMapApp` の `getState()` は、操作ごとに更新される既存の `current` refを読み、再描画を待たずに呼ばれるツールにも現在値を返します。スターターにも最初からあるので、ツールの `execute` からは `app.state` ではなく `app.getState()` を読みます。画面は引き続き `state` を使います。

### 変更するファイル

| ファイル | 変更内容 |
| --- | --- |
| `package.json`・`src/App.tsx` | SDK・Zodの依存、接続、ツール、会話の表示を追加 |
| `src/session.ts`・`src/session.css` | スターターにも最初から置いてあります。importして使うだけです |
| `src/SessionControls.tsx`（追加） | 会話の切り替えUI。全文は[追加UIの差分](#session-answer) |
| `vite.config.ts` | 会話を作るAPIはスターターにも準備済み。コメント解除時の編集は不要 |
| `src/domain.ts`・`src/use-map-app.ts`・`src/map-canvas.tsx`・`src/map-view.tsx`・`src/domain.test.ts` | 完成例側に保存済み徒歩経路の計算・描画・表示とテストを追加 |
| `src/data.json`（変更）・`src/routes.json`（追加） | 架空の地点を渋谷周辺の店舗に置き換え、保存済みの徒歩経路を追加 |
| `index.html`・`agents/map-coffee/prompt.md` | 作品名と、コーヒー屋巡りを提案する指示 |

`src/Dialog.tsx`・`src/style.css`・`src/layout.css`・`src/main.tsx`・`src/use-map-app.test.ts` は同じ内容です。下記のアプリ機能の差分は、保存済み徒歩経路の計算・描画・表示・テストです。スターターは経路データを扱わず、直線距離から概算します。

### コーヒーという題材の差分

完成例は、`src/data.json` の架空の地点を[店舗データ](../apps/map-coffee/src/data.json)で置き換え、[徒歩経路](../apps/map-coffee/src/routes.json)を `useMapApp` に渡しています。`MapView` のタイトルと説明も変わります。自分の地点データにSDKを追加する際は、この入れ替えは不要です。

スターターの `mapResult` は、`getVisitSummary` で移動時間を概算し、座標の列を省いて判断材料を返します。完成例では保存済み徒歩経路も渡して計算します。`routes.json` は完成例の追加機能なので、スターターのコメント解除には不要です。

Mapの既定の出発地は画面にも表示している渋谷駅です。座標は [`domain.ts`](../apps/map/src/domain.ts) の `SHIBUYA_STATION` にあります。初期JSONに別地域の地点を用意しても、出発地は自動では変わりません。別の出発地で使う場合はこの定数と表示名を自分のアプリに合わせて変更します。


<details>
<summary>Map：package.json の実際のdiff</summary>

```diff
--- apps/map/package.json
+++ apps/map-coffee/package.json
@@ -1,5 +1,5 @@
 {
-  "name": "@hackathon/map",
+  "name": "@hackathon/map-coffee",
   "version": "0.0.0",
   "private": true,
   "type": "module",
@@ -10,10 +10,16 @@
     "test": "tsx --test src/*.test.ts"
   },
   "dependencies": {
+    "@assistant-ui/react": "0.15.19",
+    "@assistant-ui/react-markdown": "0.14.15",
+    "@subako-ai/assistant-ui": "0.1.2",
+    "@subako-ai/react": "0.1.2",
+    "@subako-ai/sdk": "0.1.2",
+    "leaflet": "1.9.4",
     "react": "19.2.0",
     "react-dom": "19.2.0",
-    "leaflet": "1.9.4",
-    "react-leaflet": "5.0.0"
+    "react-leaflet": "5.0.0",
+    "zod": "4.6.4"
   },
   "devDependencies": {
     "@types/leaflet": "^1.9.20"
```

</details>


<details>
<summary>Map：src/App.tsx の実際のdiff</summary>

```diff
--- apps/map/src/App.tsx
+++ apps/map-coffee/src/App.tsx
@@ -1,141 +1,98 @@
+import { useMemo, useState } from "react";
+import { z } from "zod";
+import { SubakoSessionClient } from "@subako-ai/sdk";
+import { SubakoProvider, useSession, useTool, useToolClient } from "@subako-ai/react";
+import { SubakoChat } from "@subako-ai/assistant-ui";
 import { MapView } from "./map-view";
-import { useMapApp } from "./use-map-app";
-import { parseMapItems } from "./domain";
+import { useMapApp, type MapApp } from "./use-map-app";
+import { getVisitSummary, parseMapItems, type MapState, type WalkingRoute } from "./domain";
+import { SessionControls, SessionPending, SafeToolResult } from "./SessionControls";
+import { fetchSessionToken, useSessionId } from "./session";
 import data from "./data.json";
-
-// TODO(1) SDKと準備済みの関数をimportする
-// 先にREADMEの npm install を実行します。session.css は main.tsx がimport済みです。
-// import { z } from "zod";
-// import { SubakoSessionClient } from "@subako-ai/sdk";
-// import { SubakoProvider, useSession, useSessionState, useTool, useToolClient } from "@subako-ai/react";
-// import { SubakoChat, SubakoToolApproval } from "@subako-ai/assistant-ui";
-// import type { ToolCallMessagePartProps } from "@assistant-ui/react";
-// import { fetchSessionToken, useSessionId } from "./session";
-// import type { MapApp } from "./use-map-app";
-// import { getVisitSummary, type MapState } from "./domain";
+import routeData from "./routes.json";

 const initialItems = parseMapItems(data);
+const walkingRoutes = routeData as WalkingRoute[];

-// TODO(2) 会話につなぐクライアントを用意する
-// 会話ごとのtokenを開発サーバーから受け取ります。
-// const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai";
-// const sessionStorageKey = `hackathon:session:map:${baseUrl}`;
-// const subako = new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken });
+// 経路の全座標は省き、判断に必要な距離と所要時間を渡します。
+function mapResult(state: MapState) {
+  const summary = getVisitSummary(state.items, state.visitIds, walkingRoutes);
+  return JSON.stringify({
+    ...state,
+    summary: {
+      ...summary,
+      segments: summary.segments.map(({ coordinates: _, ...segment }) => segment),
+    },
+  });
+}

-// TODO(3) 会話・検索・表示のコードを有効にする
-// 手順4を含め、次の関数をまとめてコメント解除します。
-// // 補足データは省略し、操作の状態と承認ボタンを表示します。
-// function SafeToolResult(props: ToolCallMessagePartProps) {
-//   const { result, isError, approval } = props;
-//   const waiting = approval && approval.approved === undefined && approval.resolution === undefined;
-//   let message = result === undefined ? "アプリを操作しています…" : "アプリの操作結果を受け取りました";
-//   if (isError) message = "アプリの操作に失敗しました";
-//   if (waiting) message = "操作の承認を待っています";
-//   if (approval?.approved === false) message = "操作を許可しませんでした";
-//   if (approval?.resolution) message = "操作の承認待ちは終了しました";
-//
-//   return (
-//     <div className="tool-status">
-//       <span className={isError ? "session-error" : undefined}>{message}</span>
-//       <SubakoToolApproval {...props} />
-//     </div>
-//   );
-// }
-//
-// // 経路の全座標は省き、判断に必要な距離と所要時間を渡します。
-// function mapResult(state: MapState) {
-//   const summary = getVisitSummary(state.items, state.visitIds);
-//   return JSON.stringify({
-//     ...state,
-//     summary: {
-//       ...summary,
-//       segments: summary.segments.map(({ coordinates: _, ...segment }) => segment),
-//     },
-//   });
-// }
-//
-// function MapAssistant({ app, sessionId, creating, error, onNew }: {
-//   app: MapApp;
-//   sessionId: string;
-//   creating: boolean;
-//   error: string;
-//   onNew: () => void;
-// }) {
-//   const session = useSession(sessionId);
-//   const client = useToolClient(session, "map");
-//
-//   // 既存の画面操作を、ここでエージェントのツールとして登録します。
-//   useTool(client, "get_places", {
-//     description: "地点を取得する。metadataには画面に出していない特徴や情報の出典が含まれる。まず全件取得し、ユーザーの好みと比較する。",
-//     schema: z.object({
-//       query: z.string().default("").describe("任意のキーワード。省略で全件。"),
-//     }).strict(),
-//     execute: ({ query }) => {
-//       const normalized = query.trim().toLocaleLowerCase();
-//       return JSON.stringify(app.getState().items.filter((item) =>
-//         !normalized || JSON.stringify(item).toLocaleLowerCase().includes(normalized),
-//       ));
-//     },
-//   });
-//   useTool(client, "get_map_state", {
-//     description: "候補・訪問順・固定した地点と、渋谷駅からの距離・移動時間の概算を取得する。概算に滞在時間と帰路は含まれない。",
-//     schema: z.object({}).strict(),
-//     execute: () => mapResult(app.getState()),
-//   });
-//   useTool(client, "show_candidates", {
-//     description: "提案する地点を地図と一覧で強調する。空配列で強調を解除する。",
-//     schema: z.object({
-//       ids: z.array(z.string()).describe("地点のidを順番に指定"),
-//     }).strict(),
-//     execute: ({ ids }) => JSON.stringify({ candidateIds: app.showCandidates(ids) }),
-//   });
-//   // TODO(4) 訪問順と固定の操作ツールを登録する
-//   useTool(client, "set_visit_order", {
-//     description: "訪問したい地点のidを訪問順で指定し、画面を更新する。固定された地点を除外できない。点線は訪問順で、実際の徒歩経路ではない。結果の移動時間に滞在時間・帰路は含まれない。",
-//     schema: z.object({
-//       ids: z.array(z.string()).describe("地点のidを順番に指定"),
-//     }).strict(),
-//     execute: ({ ids }) => mapResult(app.setVisitOrder(ids)),
-//   });
-//   useTool(client, "set_pinned", {
-//     description: "ユーザーの明示的な依頼で地点を固定または解除する。固定した地点は再提案でも残る。",
-//     schema: z.object({ id: z.string(), pinned: z.boolean() }).strict(),
-//     execute: ({ id, pinned }) =>
-//       JSON.stringify({ pinnedIds: app.setPinned(id, pinned) }),
-//   });
-//
-//   const state = useSessionState(session);
-//   const running = state?.isRunning && state.status !== "failed";
-//   const connecting = !state || state.status === "connecting" || state.status === "reconnecting";
-//
-//   return (
-//     <div className="session-conversation" aria-busy={creating}>
-//       <div className="session-toolbar">
-//         <button
-//           type="button"
-//           disabled={creating || running || connecting}
-//           onClick={onNew}
-//           title="会話を新しくします。アプリのデータは引き継がれます。"
-//         >
-//           {creating ? "作成中…" : "＋ 新しいセッション"}
-//         </button>
-//         {running && <span>応答後、または停止後に切り替えられます。</span>}
-//         {error && <p className="session-error" role="alert">{error}</p>}
-//         {state?.status === "failed" && <p className="session-error" role="alert">接続できません。agentのOrigin設定と開発サーバーを確認してください。</p>}
-//       </div>
-//       <div className="session-chat" inert={creating}>
-//         <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
-//       </div>
-//     </div>
-//   );
-// }
+function MapAssistant({ app, sessionId, creating, error, onNew }: {
+  app: MapApp;
+  sessionId: string;
+  creating: boolean;
+  error: string;
+  onNew: () => void;
+}) {
+  const session = useSession(sessionId);
+  const client = useToolClient(session, "coffee-map");

-export default function App() {
-  const app = useMapApp(initialItems, "hackathon-map-v1");
+  // 既存の画面操作を、ここでエージェントのツールとして登録します。
+  useTool(client, "get_places", {
+    description: "地点を取得する。metadataには画面に出していない特徴や情報の出典が含まれる。まず全件取得し、ユーザーの好みと比較する。",
+    schema: z.object({
+      query: z.string().default("").describe("任意のキーワード。省略で全件。"),
+    }).strict(),
+    execute: ({ query }) => {
+      const normalized = query.trim().toLocaleLowerCase();
+      return JSON.stringify(app.getState().items.filter((item) =>
+        !normalized || JSON.stringify(item).toLocaleLowerCase().includes(normalized),
+      ));
+    },
+  });
+  useTool(client, "get_map_state", {
+    description: "候補・訪問順・固定した地点と、渋谷駅からの距離・移動時間の概算を取得する。概算に店内滞在と帰路は含まれない。",
+    schema: z.object({}).strict(),
+    execute: () => mapResult(app.getState()),
+  });
+  useTool(client, "show_candidates", {
+    description: "提案する地点を地図と一覧で強調する。空配列で強調を解除する。",
+    schema: z.object({
+      ids: z.array(z.string()).describe("地点のidを順番に指定"),
+    }).strict(),
+    execute: ({ ids }) => JSON.stringify({ candidateIds: app.showCandidates(ids) }),
+  });
+  useTool(client, "set_visit_order", {
+    description: "訪問したい地点のidを訪問順で指定し、画面を更新する。固定された地点を除外できない。実線は保存済みの徒歩経路、点線は経路未取得の訪問順。結果の移動時間に店内滞在・帰路は含まれない。",
+    schema: z.object({
+      ids: z.array(z.string()).describe("地点のidを順番に指定"),
+    }).strict(),
+    execute: ({ ids }) => mapResult(app.setVisitOrder(ids)),
+  });
+  useTool(client, "set_pinned", {
+    description: "ユーザーの明示的な依頼で地点を固定または解除する。固定した地点は再提案でも残る。",
+    schema: z.object({ id: z.string(), pinned: z.boolean() }).strict(),
+    execute: ({ id, pinned }) =>
+      JSON.stringify({ pinnedIds: app.setPinned(id, pinned) }),
+  });
+
+  return (
+    <SessionControls session={session} creating={creating} error={error} onNew={onNew}>
+      <SubakoChat session={session} components={{ tools: { Fallback: SafeToolResult } }} />
+    </SessionControls>
+  );
+}

-  // TODO(5) 保存済みの会話を開き、新しく始める操作を用意する
-  // 会話を切り替えても、アプリのデータは残ります。
-  // const { sessionId, creating, error: sessionError, startNew } = useSessionId(sessionStorageKey);
+export default function App() {
+  const app = useMapApp(initialItems, "hackathon-map-coffee-v1", walkingRoutes);
+  const baseUrl = import.meta.env.VITE_SUBAKO_BASE_URL?.trim() || "https://api.us.cloud.subako.ai";
+  const storageKey = `hackathon:session:map-coffee:${baseUrl}`;
+  const { sessionId, creating, error: sessionError, startNew } = useSessionId(storageKey);
+  const [connectionError, setConnectionError] = useState("");
+  // APIキーは持ちません。会話ごとのtokenを開発サーバーから受け取ります。
+  const subako = useMemo(
+    () => new SubakoSessionClient({ baseUrl, getToken: fetchSessionToken }),
+    [baseUrl],
+  );

   return (
     <div className="app-layout has-session">
@@ -143,44 +100,38 @@ export default function App() {
         <div className="app-content">
           <MapView
             app={app}
-            title="あなたの寄り道マップ。"
-            subtitle="好きな場所を集めて、自分だけの訪問プランを。"
+            title="渋谷、コーヒーの寄り道。"
+            subtitle="一杯の好奇心を連れて。あなた好みのコーヒー散歩を。"
           />
         </div>
         <div id="app-dialogs" className="app-dialog-host" />
       </div>
-
-      <aside className="session-sidebar" aria-label="マップアシスタント">
-        <header className="session-header">
-          <h2>マップアシスタント</h2>
-          <p>会話しながら、地図を動かせます。</p>
+      <aside className="session-sidebar" aria-label="寄り道の相談室">
+        <header>
+          <h2>寄り道の相談室</h2>
+          <p>好みや空き時間から、一緒に考えます。</p>
         </header>
         <div className="session-content">
-          <p>ここに会話が入ります。</p>
-          {/* TODO(6) 上の <p> を消し、下の JSX コメントを解除します。 */}
-          {/*
-            {sessionId ? (
-              <SubakoProvider client={subako}>
-                <MapAssistant
-                  key={sessionId}
-                  app={app}
-                  sessionId={sessionId}
-                  creating={creating}
-                  error={sessionError}
-                  onNew={startNew}
-                />
-              </SubakoProvider>
-            ) : (
-              <div className="session-toolbar" aria-busy={creating}>
-                {creating ? (
-                  <span>会話を準備しています…</span>
-                ) : (
-                  <button type="button" onClick={startNew}>もう一度試す</button>
-                )}
-                {sessionError && <p className="session-error" role="alert">{sessionError}</p>}
-              </div>
-            )}
-          */}
+          {connectionError && (
+            <div className="session-notice session-error" role="alert">
+              {connectionError}
+              <button onClick={() => setConnectionError("")}>閉じる</button>
+            </div>
+          )}
+          {sessionId ? (
+            <SubakoProvider client={subako} onError={() => setConnectionError("接続を確認してください。agentのOrigin設定と開発サーバーを確認し、アプリを再起動してください。") }>
+              <MapAssistant
+                key={sessionId}
+                app={app}
+                sessionId={sessionId}
+                creating={creating}
+                error={sessionError}
+                onNew={startNew}
+              />
+            </SubakoProvider>
+          ) : (
+            <SessionPending creating={creating} error={sessionError} onRetry={startNew} />
+          )}
         </div>
       </aside>
     </div>
```

</details>


<details>
<summary>Map：vite.config.ts の実際のdiff</summary>

```diff
--- apps/map/vite.config.ts
+++ apps/map-coffee/vite.config.ts
@@ -6,7 +6,7 @@ import { subakoDevApi } from "../../scripts/subako-dev-api.ts";
 const envDir = fileURLToPath(new URL("../../", import.meta.url));
 const codespace = process.env.CODESPACE_NAME;
 const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
-const host = codespace && domain ? `${codespace}-5175.${domain}` : undefined;
+const host = codespace && domain ? `${codespace}-5176.${domain}` : undefined;
 
 export default defineConfig(({ mode }) => {
   const env = loadEnv(mode, envDir, ["SUBAKO_", "VITE_SUBAKO_"]);
@@ -16,16 +16,16 @@ export default defineConfig(({ mode }) => {
       // APIキーを持つのは開発サーバーだけです。ブラウザーはこの口から会話に入ります。
       subakoDevApi({
         apiKey: env.SUBAKO_API_KEY ?? "",
-        agentId: env.SUBAKO_AGENT_MAP ?? "",
+        agentId: env.SUBAKO_AGENT_MAP_COFFEE ?? "",
         baseUrl: env.VITE_SUBAKO_BASE_URL || "https://api.us.cloud.subako.ai",
-        title: "Map・スタート",
+        title: "渋谷コーヒー巡り",
       }),
     ],
     envDir,
-    preview: { port: 5175, strictPort: true },
+    preview: { port: 5176, strictPort: true },
     server: {
       host: "0.0.0.0",
-      port: 5175,
+      port: 5176,
       strictPort: true,
       ...(host ? { allowedHosts: [host] } : {}),
     },
```

</details>


<details>
<summary>Map：index.html の実際のdiff</summary>

```diff
--- apps/map/index.html
+++ apps/map-coffee/index.html
@@ -4,7 +4,7 @@
     <meta charset="UTF-8" />
     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <meta name="theme-color" content="#2e563f" />
-    <title>あなたの寄り道マップ | Subako Hackathon</title>
+    <title>渋谷、コーヒーの寄り道。| Subako Hackathon</title>
   </head>
   <body>
     <div id="root"></div>
```

</details>


<details>
<summary>Map：エージェントの指示のdiff</summary>

```diff
--- agents/map/prompt.md
+++ agents/map-coffee/prompt.md
@@ -3,5 +3,5 @@
 metadataには画面に表示しない判断材料があります。属性を判断に使い、必要な理由をわかりやすい自然文で伝えてください。
 ユーザーが手動で選んだ内容や固定した候補を尊重してください。操作が成功した後で完了を伝えます。
 不明な商品、価格、場所、座標、営業時間を作らず、不足条件は質問してください。
-登録された地点の訪問計画を助けます。地点の特徴、移動時間と滞在時間を比べ、候補と訪問順を画面に示してください。
-ユーザーの時間や希望に収まる候補を探し、固定した地点は残して組み直してください。移動の目安と実際の徒歩経路を区別します。
+コーヒー屋巡りの相談を助けます。店の特徴、歩く時間と滞在時間を比べ、候補と訪問順を画面に示してください。
+ユーザーの時間や希望に収まる候補を探し、固定した店は残して組み直してください。移動の目安と実際の徒歩経路を区別します。
```

</details>


<details>
<summary>Map：徒歩経路機能の追加 — src/domain.ts の実際のdiff</summary>

```diff
--- apps/map/src/domain.ts
+++ apps/map-coffee/src/domain.ts
@@ -28,6 +28,18 @@ export interface MapState {
 
 export const SHIBUYA_STATION = { lat: 35.658034, lng: 139.701636 };
 
+export interface WalkingRoute {
+  fromId: string;
+  toId: string;
+  from: MapItem["position"];
+  to: MapItem["position"];
+  seconds: number;
+  distanceMeters: number;
+  coordinates: [number, number][];
+  sourceUrl: string;
+  checkedAt: string;
+}
+
 function record(value: unknown, label: string): Record<string, unknown> {
   if (!value || typeof value !== "object" || Array.isArray(value))
     throw new Error(`${label}はオブジェクトにしてください。`);
@@ -154,6 +166,7 @@ export function distanceKm(
 export function getVisitSummary(
   items: MapItem[],
   ids: string[],
+  routes: WalkingRoute[] = [],
 ) {
   const locations = ids.flatMap(
     (id) => items.find((item) => item.id === id) ?? [],
@@ -162,18 +175,35 @@ export function getVisitSummary(
     const previous = locations[index - 1];
     const from = previous?.position ?? SHIBUYA_STATION;
     const straightLineKm = distanceKm(from, item.position);
+    // 同じidでも座標が変わったら、保存済み経路を使いません。
+    const same = (a: MapItem["position"], b: MapItem["position"]) =>
+      Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;
+    const route = routes.find(
+      (route) =>
+        route.fromId === (previous?.id ?? "shibuya-station") &&
+        route.toId === item.id &&
+        same(route.from, from) &&
+        same(route.to, item.position),
+    );
     return {
       from: previous?.name ?? "渋谷駅",
       to: item.name,
-      distanceKm: straightLineKm,
+      straightLineKm: Math.round(straightLineKm * 100) / 100,
+      distanceKm: route ? route.distanceMeters / 1000 : straightLineKm,
       estimatedWalkMinutes: Math.max(
         1,
-        Math.ceil(((straightLineKm * 1.3) / 4.8) * 60),
+        Math.ceil(
+          route ? route.seconds / 60 : ((straightLineKm * 1.3) / 4.8) * 60,
+        ),
       ),
-      coordinates: [
+      isWalkingRoute: Boolean(route),
+      coordinates: route?.coordinates ?? [
         [from.lng, from.lat],
         [item.position.lng, item.position.lat],
       ],
+      routeSource: route
+        ? { url: route.sourceUrl, checkedAt: route.checkedAt }
+        : null,
     };
   });
   return {
@@ -182,6 +212,9 @@ export function getVisitSummary(
       (sum, item) => sum + item.estimatedWalkMinutes,
       0,
     ),
-    note: "点線は訪問順で、徒歩経路ではありません。直線距離×1.3・時速4.8kmで概算しています。滞在時間と帰路は含みません。",
+    note:
+      segments.length && segments.every((segment) => segment.isWalkingRoute)
+        ? "事前取得したOSMの徒歩経路・所要時間の推定です。混雑・工事・出入口の現況を保証しません。店内の滞在時間と帰路は含みません。"
+        : "点線の区間は徒歩経路が未取得。直線距離×1.3・時速4.8kmで概算しています。店内の滞在時間と帰路は含みません。",
   };
 }
```

</details>

<details>
<summary>Map：徒歩経路機能の追加 — src/use-map-app.ts の実際のdiff</summary>

```diff
--- apps/map/src/use-map-app.ts
+++ apps/map-coffee/src/use-map-app.ts
@@ -6,6 +6,7 @@ import {
   updateVisitOrder,
   type MapItem,
   type MapState,
+  type WalkingRoute,
 } from "./domain";
 
 const initialState = (items: MapItem[]): MapState => ({
@@ -19,6 +20,7 @@ const initialState = (items: MapItem[]): MapState => ({
 export function useMapApp(
   initialItems: MapItem[],
   storageKey: string,
+  routes: WalkingRoute[] = [],
 ) {
   const [loaded] = useState(() => {
     try {
@@ -73,6 +75,7 @@ export function useMapApp(
       return getVisitSummary(
         current.current.items,
         current.current.visitIds,
+        routes,
       );
     },
     showCandidates(ids: unknown) {
```

</details>

<details>
<summary>Map：徒歩経路機能の追加 — src/map-canvas.tsx の実際のdiff</summary>

```diff
--- apps/map/src/map-canvas.tsx
+++ apps/map-coffee/src/map-canvas.tsx
@@ -198,7 +198,7 @@ export function MapCanvas({ app }: { app: MapApp }) {
               pathOptions={{
                 color: "#416753",
                 weight: 4,
-                dashArray: "7 9",
+                dashArray: segment.isWalkingRoute ? undefined : "7 9",
               }}
             />
           ))}
@@ -212,7 +212,9 @@ export function MapCanvas({ app }: { app: MapApp }) {
       {visitItems.length > 0 && (
         <div className="map-legend">
           <span />{" "}
-          点線は訪問順です。徒歩経路ではありません。
+          {offline
+            ? "点線は訪問順です。徒歩経路ではありません。"
+            : "実線：保存済みの徒歩経路 / 点線：訪問順（経路未取得）"}
         </div>
       )}
     </section>
```

</details>

<details>
<summary>Map：徒歩経路機能の追加 — src/map-view.tsx の実際のdiff</summary>

```diff
--- apps/map/src/map-view.tsx
+++ apps/map-coffee/src/map-view.tsx
@@ -189,7 +189,10 @@ export function MapView({
                           {item.name}
                         </button>
                         <small>
-                          前の地点から直線{" "}
+                          前の地点から
+                          {summary.segments[index]?.isWalkingRoute
+                            ? "徒歩"
+                            : "直線"}{" "}
                           {summary.segments[index]?.distanceKm.toFixed(2)}{" "}
                           km・移動 約
                           {summary.segments[index]?.estimatedWalkMinutes}分
@@ -279,7 +282,7 @@ export function MapView({
               target="_blank"
               rel="noreferrer"
             >
-              地図：© OpenStreetMap contributors / ODbL
+              地図・徒歩経路：© OpenStreetMap contributors / ODbL
             </a>{" "}
             ·{" "}
             <a
```

</details>

<details>
<summary>Map：徒歩経路機能の追加 — src/domain.test.ts の実際のdiff</summary>

```diff
--- apps/map/src/domain.test.ts
+++ apps/map-coffee/src/domain.test.ts
@@ -14,7 +14,7 @@ const row = {
   name: "最初の地点",
   position: { lat: 35.658034, lng: 139.701636 },
   tags: [],
-  metadata: { preferences: { priority: 2, notes: ["短時間"] } },
+  metadata: { preferences: { acidity: 2, notes: ["nuts"] } },
 };
 
 test("metadataを保持し、配列とitems形式の両方を読める", () => {
@@ -70,6 +70,34 @@ test("概算は直線距離に基づき、徒歩経路取得と区別する", ()
   );
   const result = getVisitSummary(parseMapItems([row]), ["first"]);
   assert.equal(result.segments[0]?.from, "渋谷駅");
-  assert.match(result.note, /徒歩経路ではありません/);
+  assert.match(result.note, /徒歩経路が未取得/);
   assert.equal(getVisitSummary([], []).estimatedWalkMinutes, 0);
 });
+
+test("取得済み徒歩経路を使い、同じidの座標が変わったら概算に戻す", () => {
+  const items = parseMapItems([row]);
+  const route = {
+    fromId: "shibuya-station",
+    toId: "first",
+    from: row.position,
+    to: row.position,
+    seconds: 600,
+    distanceMeters: 700,
+    coordinates: [[139.701636, 35.658034]] as [number, number][],
+    sourceUrl: "https://example.com",
+    checkedAt: "2026-09-13",
+  };
+  assert.equal(
+    getVisitSummary(items, ["first"], [route]).estimatedWalkMinutes,
+    10,
+  );
+  assert.equal(
+    getVisitSummary(items, ["first"], [route]).segments[0]?.isWalkingRoute,
+    true,
+  );
+  const moved = [{ ...items[0]!, position: { lat: 35.66, lng: 139.7 } }];
+  assert.equal(
+    getVisitSummary(moved, ["first"], [route]).segments[0]?.isWalkingRoute,
+    false,
+  );
+});
```

</details>

店舗と経路のJSON全文は上記のファイルを参照してください。徒歩経路の座標列は長いため、この資料ではコードの差分に集中しています。

- [ ] AIの提案した地点が、手で選択したときと同じ地図・一覧に反映された。
- [ ] 手で地点を固定し、AIに訪問順を組み直してもらっても残った。
- [ ] AIが距離・時間の値をアプリから読み、移動時間と店内滞在を区別して説明できた。

<a id="session-answer"></a>

## 追加UI：会話のサイドバーと新しいセッション

`session.ts`・`SessionControls.tsx`・`session.css` は完成例3つで同じ内容です。うち `session.ts` と `session.css` は、スターター3つ（`todo` / `map` / `ec`）にも最初から置いてあります。サイドバーの枠も最初からあり、`session-content` の中身を差し替えるだけです。以下にはTODO版を代表として載せます。

| 追加部分 | 役割 | 最小の連携での扱い |
| --- | --- | --- |
| `session.ts` の `useSessionId` | 会話を作り、IDを `localStorage` に覚え、次回は続きから | **最小の連携から必要** |
| `session.ts` の `fetchSessionToken` | 接続用のtokenを受け取る。`SubakoSessionClient` が期限切れのたびに呼ぶ | **最小の連携から必要** |
| `session.css` | アプリと会話の表示領域を分ける | スターターで配置・import 済み |
| `SessionControls` | 「新しいセッション」で会話を作り直す | 後から追加できる |
| `SessionPending` | 会話ができるまでの表示と、失敗時の再試行 | 後から追加できる |
| `SafeToolResult` | 短い操作表示・失敗状態・SDKの承認ボタンを表示 | 必要に応じて `SubakoChat` の `components` に渡す |
| `subakoDevApi` | Viteに作成・token発行の口を足す | **6アプリすべてに配線済み** |

`SessionControls` をコピーしたら、`useSessionId` が返す `creating`・`error`・`startNew` も会話コンポーネントへ渡します。`key={sessionId}` により、切り替え時は会話の接続とツール登録を作り直します。TODOやカートなど、元のアプリのstateは親に残ります。接続部分まで含めたdiffは各題材の `App.tsx` にあります。


<details>
<summary>追加ファイル：src/session.ts の全文</summary>

```diff
--- /dev/null
+++ apps/todo-integrated/src/session.ts
@@ -0,0 +1,104 @@
+import { useCallback, useEffect, useRef, useState } from "react";
+
+/**
+ * 会話の出入り口。APIキーは開発サーバーだけが持つので、作成もtokenの発行も
+ * `/__subako/*` 越しに頼みます。ブラウザーが持つのは会話のIDだけです。
+ */
+
+export function loadSessionId(key: string) {
+  try {
+    return localStorage.getItem(key) || "";
+  } catch {
+    return "";
+  }
+}
+
+export function saveSessionId(key: string, id: string) {
+  try {
+    localStorage.setItem(key, id);
+  } catch {
+    // 保存できなくても、開いている間は会話を続けられます。
+  }
+}
+
+async function ask(path: string, body?: object) {
+  const response = await fetch(path, {
+    method: "POST",
+    headers: { "Content-Type": "application/json" },
+    signal: AbortSignal.timeout(30_000),
+    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
+  });
+  if (!response.ok) throw new Error(`${path} が ${response.status} を返しました`);
+  return (await response.json()) as Record<string, unknown>;
+}
+
+/** 開発サーバーが決めたagentに、新しい会話を作ります。 */
+export async function createSession() {
+  const { sessionId } = await ask("/__subako/session");
+  if (typeof sessionId !== "string" || !sessionId)
+    throw new Error("会話のIDを受け取れませんでした");
+  return sessionId;
+}
+
+/** 会話につなぐためのtokenを発行します。期限切れのたびにSDKが呼び直します。 */
+export async function fetchSessionToken(sessionId: string) {
+  const { token } = await ask("/__subako/token", { sessionId });
+  if (typeof token !== "string" || !token)
+    throw new Error("tokenを受け取れませんでした");
+  return token;
+}
+
+/** 前回の会話があれば続け、なければ作って覚えます。 */
+export async function ensureSessionId(key: string) {
+  const saved = loadSessionId(key);
+  if (saved) return saved;
+  const created = await createSession();
+  saveSessionId(key, created);
+  return created;
+}
+
+/**
+ * 画面が使う会話のID。前回の続きがあれば最初の描画から渡し、なければ作ります。
+ * StrictModeで作成が二重に走らないよう、実行中は次の依頼を受けません。
+ */
+export function useSessionId(key: string) {
+  const [sessionId, setSessionId] = useState(() => loadSessionId(key));
+  const [creating, setCreating] = useState(() => !loadSessionId(key));
+  const [error, setError] = useState("");
+  const inFlight = useRef(false);
+
+  const run = useCallback(
+    (make: () => Promise<string>, message: string) => {
+      if (inFlight.current) return;
+      inFlight.current = true;
+      setCreating(true);
+      setError("");
+      make()
+        .then(setSessionId)
+        .catch(() => setError(message))
+        .finally(() => {
+          inFlight.current = false;
+          setCreating(false);
+        });
+    },
+    [],
+  );
+
+  useEffect(() => {
+    if (sessionId) return;
+    run(
+      () => ensureSessionId(key),
+      "会話を準備できませんでした。開発サーバーとAPIキーの設定を確認して、もう一度お試しください。",
+    );
+  }, [key, run, sessionId]);
+
+  const startNew = useCallback(() => {
+    run(async () => {
+      const created = await createSession();
+      saveSessionId(key, created);
+      return created;
+    }, "新しい会話を作れませんでした。開発サーバーとAPIキーの設定を確認して、もう一度お試しください。");
+  }, [key, run]);
+
+  return { sessionId, creating, error, startNew };
+}
```

</details>


<details>
<summary>追加ファイル：src/SessionControls.tsx の全文</summary>

```diff
--- /dev/null
+++ apps/todo-integrated/src/SessionControls.tsx
@@ -0,0 +1,76 @@
+import type { ReactNode } from "react";
+import type { SessionConnection } from "@subako-ai/sdk";
+import type { ToolCallMessagePartProps } from "@assistant-ui/react";
+import { SubakoToolApproval } from "@subako-ai/assistant-ui";
+import { useSessionState } from "@subako-ai/react";
+import "./session.css";
+
+/** 会話の枠。状態は `useSessionId` が持ち、ここは表示と操作だけを担当します。 */
+export function SessionControls({ session, creating, error, onNew, children }: {
+  session: SessionConnection | null;
+  creating: boolean;
+  error: string;
+  onNew: () => void;
+  children: ReactNode;
+}) {
+  const state = useSessionState(session);
+  const running = state?.isRunning && state.status !== "failed";
+  const connecting = !state || state.status === "connecting" || state.status === "reconnecting";
+
+  return (
+    <div className="session-conversation" aria-busy={creating}>
+      <div className="session-toolbar">
+        <button
+          type="button"
+          disabled={creating || running || connecting}
+          onClick={onNew}
+          title="会話を新しくします。アプリ内のデータは引き継がれます。"
+        >
+          <span aria-hidden="true">＋</span>
+          {creating ? "作成中…" : "新しいセッション"}
+        </button>
+        {running && <span>応答後、または停止後に切り替えられます。</span>}
+        {error && <p className="session-error" role="alert">{error}</p>}
+      </div>
+      <div className="session-chat" inert={creating}>{children}</div>
+    </div>
+  );
+}
+
+/** 最初の会話ができるまでの表示。失敗しても、ここから作り直せます。 */
+export function SessionPending({ creating, error, onRetry }: {
+  creating: boolean;
+  error: string;
+  onRetry: () => void;
+}) {
+  return (
+    <div className="session-conversation" aria-busy={creating}>
+      <div className="session-toolbar">
+        {creating ? (
+          <span>会話を準備しています…</span>
+        ) : (
+          <button type="button" onClick={onRetry}>もう一度試す</button>
+        )}
+        {error && <p className="session-error" role="alert">{error}</p>}
+      </div>
+    </div>
+  );
+}
+
+// 補足データは省略し、操作の状態と承認ボタンを表示します。
+export function SafeToolResult(props: ToolCallMessagePartProps) {
+  const { result, isError, approval } = props;
+  const waiting = approval && approval.approved === undefined && approval.resolution === undefined;
+  let message = result === undefined ? "アプリを操作しています…" : "アプリの操作結果を受け取りました";
+  if (isError) message = "アプリの操作に失敗しました";
+  if (waiting) message = "操作の承認を待っています";
+  if (approval?.approved === false) message = "操作を許可しませんでした";
+  if (approval?.resolution) message = "操作の承認待ちは終了しました";
+
+  return (
+    <div className="tool-status">
+      <span className={isError ? "session-error" : undefined}>{message}</span>
+      <SubakoToolApproval {...props} />
+    </div>
+  );
+}
```


</details>


<details>
<summary>追加ファイル：src/session.css の全文</summary>

```diff
--- /dev/null
+++ apps/todo-integrated/src/session.css
@@ -0,0 +1,81 @@
+.app-layout.has-session { grid-template-columns: minmax(0, 1fr) 360px; }
+.session-sidebar {
+  min-width: 0;
+  min-height: 0;
+  display: flex;
+  flex-direction: column;
+  background: #fffefa;
+  color: #283b31;
+  border-left: 1px solid #d9dfd7;
+  font-family: system-ui, sans-serif;
+}
+.session-sidebar > header {
+  flex-shrink: 0;
+  padding: 22px 22px 18px;
+  border-bottom: 1px solid #e5e8df;
+}
+.session-sidebar > header > span { font-size: 9px; letter-spacing: 1.8px; color: #7e8a76; }
+.session-sidebar h2 { margin: 10px 0 6px; font-size: 16px; line-height: 1.5; font-weight: 600; }
+.session-sidebar > header p { margin: 0; font-size: 11px; line-height: 1.8; color: #7b8374; }
+.session-content, .session-conversation, .session-chat {
+  flex: 1;
+  min-height: 0;
+  display: flex;
+  flex-direction: column;
+}
+.session-content { overflow: auto; overscroll-behavior: contain; }
+.session-content > p { margin: 22px; font-size: 13px; line-height: 1.9; }
+.session-notice { padding: 12px 16px; font: 12px/1.7 system-ui, sans-serif; }
+.session-error { margin: 0; color: #a14032; overflow-wrap: anywhere; }
+.session-toolbar {
+  flex-shrink: 0;
+  display: flex;
+  flex-direction: column;
+  align-items: flex-end;
+  gap: 6px;
+  padding: 10px 16px;
+  border-bottom: 1px solid #e1e5da;
+  font: 12px/1.6 system-ui, sans-serif;
+}
+.session-toolbar button {
+  display: inline-flex;
+  align-items: center;
+  gap: 5px;
+  padding: 6px 10px;
+  border: 1px solid #cbd5c6;
+  border-radius: 6px;
+  background: #fffefa;
+  color: #345b46;
+  font: inherit;
+  cursor: pointer;
+}
+.session-toolbar button:hover:not(:disabled) { background: #f0f3eb; }
+.session-toolbar button:focus-visible { outline: 2px solid #345b46; outline-offset: 3px; }
+.session-toolbar button:disabled { opacity: 0.55; cursor: default; }
+.session-toolbar > span { color: #788173; font-size: 11px; }
+.tool-status { display: block; padding: 4px 0; font: 12px/1.6 system-ui, sans-serif; color: #676155; }
+.session-sidebar .subako-chat {
+  flex: 1;
+  min-height: 0;
+  height: auto;
+  --subako-bg: #fffefa;
+  --subako-fg: #283b31;
+  --subako-muted: #788173;
+  --subako-accent: #345b46;
+  --subako-accent-fg: #ffffff;
+  --subako-border: #e1e5da;
+  --subako-surface: #f0f3eb;
+  --subako-error: #a14032;
+  color-scheme: light;
+  font: 13px/1.8 system-ui, sans-serif;
+}
+.subako-tool-args { display: none; }
+.session-sidebar .subako-composer { padding: 12px; gap: 8px; }
+.session-sidebar .subako-input { min-width: 0; min-height: 40px; max-height: 120px; }
+@media (max-width: 760px) {
+  .app-layout.has-session { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 3fr) minmax(0, 2fr); }
+  .session-sidebar { border-left: 0; border-top: 1px solid #d9dfd7; }
+  .session-sidebar > header { padding: 10px 16px; }
+  .session-sidebar h2 { margin: 0; font-size: 13px; }
+  .session-sidebar > header > span, .session-sidebar > header p { display: none; }
+}
```

</details>


### ボタンが呼ぶAPI

APIキーを持つのは開発サーバーだけです。[`scripts/subako-dev-api.ts`](../scripts/subako-dev-api.ts) が2つの口を提供します。

| 口 | 呼ぶ人 | すること |
| --- | --- | --- |
| `POST /__subako/session` | `useSessionId`（初回）と「新しいセッション」 | 既定のagentに会話を作り、IDだけを返す |
| `POST /__subako/token` | `SubakoSessionClient` の `getToken` | その会話に接続するtokenを発行する |

どちらもブラウザーから直接呼べません。作成APIはCORSが許可されていないためです。一方、会話への接続とclient toolは、発行されたtokenでAPIへ直接つなぎます。こちらはagentの `allowed_origins` でOriginごとに許可されています。

`vite.config.ts` は6アプリすべてに配線済みなので、追加の設定は要りません。自分の別リポジトリに導入する場合は、同じ2つの口を自分のサーバーに置きます。

- [ ] 新しいセッションで会話が空になり、アプリのデータは残った。
- [ ] リロードしても、タブを閉じて開き直しても、同じ会話を再開できた。
- [ ] EC・Mapでは、ダイアログを開いたままサイドバーでも会話できた。

## 手元のコードでdiffを取り直す

この資料のdiffは作成時点のものです。自分の変更後は、リポジトリのルートで次を実行すると比較できます。Gitにcommitする前でも使えます。

```sh
git diff --no-index -- apps/todo/src/App.tsx apps/todo-integrated/src/App.tsx
git diff --no-index -- apps/ec/src/App.tsx apps/ec-coffee/src/App.tsx
git diff --no-index -- apps/map/src/App.tsx apps/map-coffee/src/App.tsx
```

`git diff --no-index` は差分があれば終了コード1になります。表示されたdiffを読み、今のアプリの値・操作関数と、AIに追加した入口を確認してください。
