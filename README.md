# Subako Hackathon 2026-09-14

普通の React アプリに、[Subako](https://subako.ai) のエージェントを組み込むハッカソンの教材です。
進め方の全体は[スライド](https://subako-ai.github.io/subako-hackathon-2026-09-14-slides/)にあります。このファイルは、手を動かすときに横に置く早見表です。

## 3 つのコマンド

CLI でログインし、`.env.local` に API キーとモデルを入れたあと、どのアプリも同じ 3 つで動きます。`<app>` は下の表の名前です。

```sh
npm install --workspace @hackathon/<app> \
  @subako-ai/sdk@0.1.2 @subako-ai/react@0.1.2 @subako-ai/assistant-ui@0.1.2 \
  @assistant-ui/react@0.15.19 @assistant-ui/react-markdown@0.14.15 zod@4.6.4
npm run agent:publish -- <app>
npm run dev -- <app>
```

publish は `agents/<app>/prompt.md`・`mcp.json`・`skills.json`（任意）を Subako に登録し、`.env.local` の `SUBAKO_AGENT_*` を書き換えます。開発サーバーを動かしたまま publish したら、`Ctrl+C` で止めて `npm run dev` をやり直してください。

| `<app>` | 何か | ポート | prompt | 会話の保存キー |
| --- | --- | --- | --- | --- |
| `todo` | ハンズオンで使うスターター | 5173 | `agents/todo/prompt.md` | `hackathon:session:todo:<baseUrl>` |
| `todo-integrated` | TODO の完成例 | 5174 | `agents/todo-integrated/prompt.md` | |
| `ec` | ハックタイム用スターター（EC） | 5177 | `agents/ec/prompt.md` | `hackathon:session:ec:<baseUrl>` |
| `ec-coffee` | EC の完成例（コーヒー豆） | 5178 | `agents/ec-coffee/prompt.md` | |
| `map` | ハックタイム用スターター（マップ） | 5175 | `agents/map/prompt.md` | `hackathon:session:map:<baseUrl>` |
| `map-coffee` | マップの完成例（渋谷のコーヒー店） | 5176 | `agents/map-coffee/prompt.md` | |

Codespaces では、ポートは Ports タブから開きます。ローカルは `http://127.0.0.1:<ポート>` です。

## TODO（ハンズオン）

作業箇所には `TODO(1)` 形式のコメントを付けています。編集する `App.tsx` で `TODO(` を検索すると、やることの一覧を確認できます。ターミナルでは次のコマンドを使います（EC・マップは `todo` を `ec`・`map` に変更）。

```sh
grep -nF 'TODO(' apps/todo/src/App.tsx
```

`apps/todo/src/App.tsx` の 手順1〜6 を上から外します。手順4 の `set_todo_done` だけ雛形が無いので、手順3 の `useTool` を真似て書きます。手順6 は `<p>` と、JSX コメントの始まり `{/*` と終わり `*/}` の行を消します。

手順3・5・6には「新しいセッション」ボタンも含まれます。コメントを解除すると、TODOのデータを残したまま会話を作り直せます。作成に失敗したときの再試行も雛形に含まれています。

## EC / マップ（ハックタイム）

EC・マップも、`App.tsx` の手順1〜6をコメント解除すると主要なツールと会話が動きます。**コードの書き足しは不要です。** 手順3の関数は中の手順4もまとめて解除します。手順6は案内の `<p>` を消し、その下のJSXコメントを解除します。新しいセッション、作成失敗時の再試行、ツール結果の表示も入っています。

### 最初の15分で、一度動かす

上の3コマンドでSDKのインストール・publish・起動を済ませ、手順1〜6を有効にします。最初は汎用データのまま、次の依頼を試してください。

| アプリ | 最初のデモ | 画面で確認すること |
| --- | --- | --- |
| EC | 「商品AとBを比較して、予算2,000円で各1点をカートに入れて」 | 比較パネルとカートが変わり、合計が1,700円になる |
| Map | 「地点AとCを候補にして、A→Cの順で回りたい。Aは固定して」 | 地図に候補と訪問順が出て、Aが固定される |

ECには検索・詳細取得・候補表示・比較・カート操作・購入確認、Mapには検索・状態取得・候補表示・訪問順・固定が用意されています。ECの購入確定は画面のボタンで行うデモです。Mapの点線は訪問順で、移動時間は直線距離からの概算です。

### 自分たちの作品にする

最初に、次の4行をチームで埋めます。**工夫が伝わるデモの依頼文を1つ作り、同じ依頼で改善を確かめます。**

- 誰が、どんな場面で使う：
- エージェントが優先する条件：
- 判断のためにmetadataへ入れる情報：
- 発表で入力する依頼文と、期待する画面の変化：

| 順 | やること | 目安 | 編集するもの |
| --- | --- | --- | --- |
| 1 | 汎用データで最初のデモを動かす | 15分 | `App.tsx` の手順1〜6 |
| 2 | 上の4行を決める | 10分 | チームのメモ |
| 3 | 自分たちの題材のデータを作る | 25分 | EC：`apps/ec/data/catalog.json`、Map：`apps/map/src/data.json` |
| 4 | 質問・選び方・説明・操作の順序を工夫する | 30分 | `agents/<app>/prompt.md`、必要ならSkills |
| 5 | デモを改善する。必要ならMCP、独自ツール、UIも追加 | 35分 | `agents/<app>/mcp.json`、`App.tsx` など |
| 6 | 発表用の依頼で通して動かし、見せ方を整える | 20分 | 60秒で伝わるデモ |

データは、運営が案内するWebのデータ生成チャットでJSONを作り、ファイルへ貼り付けます。既存JSONを見本として渡し、項目名は維持してください。独自の判断材料は `metadata` に入れます。少量のデータで始め、公開してよい情報や架空の情報を使います。Mapの座標は地図で確認してください。

データを変えても以前の内容が出る場合は、下の「困ったとき」に従ってアプリの保存データを消します。「新しいセッション」は会話だけを切り替えるので、商品や地点の保存データは残ります。

18:00に実装を止め、18:00〜18:15で60秒のデモ動画を撮って、運営が案内するフォームへ提出します。誰を助けるか・自分たちの工夫・実際に画面が変わるところを入れてください。

### Skills・MCPを足す（任意）

まず `prompt.md` で選び方を試します。比較する属性や判断手順をまとめたいときは、`skills/decision-guide/SKILL.md` を自分の題材に合わせて編集します。SubakoのCLIで、APIキーと同じworkspaceが選ばれていることを確認し、登録します。

```sh
subako workspace list
subako workspace use <workspace-id>
subako skill create skills/decision-guide
```

返されたskillのIDを使い、`agents/<app>/skills.json` を次の形にします。

```json
[
  { "name": "decision-guide", "skill_id": "<skill-id>", "version": "latest" }
]
```

`prompt.md` に「提案するときは decision-guide の手順を使う」と加え、`npm run agent:publish -- <app>` を実行します。Skillの本文を変更したら `subako skill push <skill-id> skills/decision-guide` で更新します。`latest` は新しいセッションで反映されるため、画面の「新しいセッション」を押してください。`skills.json` の内容を変更した場合は再publishも必要です。

外部情報が必要なら、`presets/mcp/exa.json`（Web検索）か `presets/mcp/eris.json`（天気）を `agents/<app>/mcp.json` にコピーします。複数使う場合は同じ配列へ追加します。何を調べて判断に使うかを `prompt.md` に書き、再publish・開発サーバーの再起動・「新しいセッション」で試してください。Skills・MCPが不要なら、それぞれの設定は `[]` のままで進められます。

### さらに機能を足したい人へ

- ツールはZodの `schema` と、既存の操作関数を呼ぶ `execute` で追加します。状態はECの `catalog.getState()`、Mapの `app.getState()` から読むと、連続した操作の直後も最新の値が取れます。
- Mapの出発地は渋谷駅です。別の街を使う場合は `apps/map/src/domain.ts` の `SHIBUYA_STATION` と表示名も変えます。
- コーヒーの完成例と [`docs/answers.md`](docs/answers.md) には、題材・画面・徒歩経路などの差分があります。独自ツールやUIの追加は発展課題です。

## 困ったとき

| 見えるもの | 意味 | 直し方 |
| --- | --- | --- |
| `npm run setup の後、.env.local に SUBAKO_API_KEY を入力してください。` | publish がキーを見つけられない | `.env.local` の `SUBAKO_API_KEY=` に `sbk_ak` から始まるキーを貼る |
| サイドバーに「会話を準備できませんでした」 | 開発サーバーが `/__subako/session` を 503 か 502 で返した | ターミナルで `curl -X POST http://127.0.0.1:<ポート>/__subako/session` を叩き、返る日本語のエラーに従う。キーを入れた・publish したあとは開発サーバーを再起動 |
| `先に npm run agent:publish を実行してください。` | `.env.local` の `SUBAKO_AGENT_*` が空 | `npm run agent:publish -- <app>` のあと再起動 |
| 「接続できません。agentのOrigin設定と開発サーバーを確認してください。」 | ブラウザーの Origin が agent に許可されていない | 開いている URL が上の表のポートか確認。別 Origin で開くなら `.env.local` の `SUBAKO_EXTRA_ORIGINS` に足して `npm run agent:origins -- <app>` |
| `指定モデルはこのproviderの一覧にありません。` | `SUBAKO_MODEL_ID` の綴り違い | `npm run agent:models` の一覧から `crow` / `hawk` / `sparrow` を選ぶ |
| prompt を変えたのに会話が変わらない | 既存のセッションは古い version のまま | publish のあと「新しいセッション」を押す |
| データ JSON を変えたのに画面が変わらない | 前の操作状態が `localStorage` に残っている | DevTools の Application → Local Storage で `subako-hackathon:ec:v1` / `hackathon-map-v1` を消して再読み込み |

`npm run check` で型・テスト・ビルドをまとめて確認できます。
