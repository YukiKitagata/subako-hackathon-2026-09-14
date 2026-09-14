# 運営用の確認資料

確認日：2026年9月14日。この資料は教材の根拠確認に使います。

## Subako CLI

[公式リリース v0.1.7](https://github.com/subako-ai/subako-cli/releases/tag/v0.1.7) の配布ファイルとインストーラーを確認しました。CLIのサブコマンドは Subako 本体の `crates/subako-cli/src/bin/subako.rs` と公式ドキュメントのソースに照合しています。[公開Quickstart](https://docs.subako.ai/quickstart) は初回調査で403となったため、コマンドの確認にはローカルの公式ソースを使用しました。その後、PATH上のCLIからProductionの既存組織 `kikuvi` にworkspace `shun-hackathon-260914` を作成し、3つの完成例で接続・会話・画面操作・セッション切り替えを確認しています。新規参加者のアカウント登録とCodespacesでの一連の手順は、運営の事前確認項目として残ります。

### インストール

Codespacesでは [post-create.sh](../.devcontainer/post-create.sh) が初回にCLI・npm依存・`.env.local` を準備します。CLIは `~/.local/bin` に配置し、[devcontainer.json](../.devcontainer/devcontainer.json) でターミナルのPATHを設定しています。登録・ログインは参加者が行います。

ローカルのmacOS / Linux：

```sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/subako-ai/subako-cli/releases/latest/download/subako-cli-installer.sh | sh
subako --version
```

通常の配置先は `~/.local/bin` です。コマンドが見つからない場合はターミナルを開き直します。Codespacesではターミナルに表示される認証URLを手元のブラウザーで開けます。

Windows PowerShell：

```powershell
powershell -c "irm https://github.com/subako-ai/subako-cli/releases/latest/download/subako-cli-installer.ps1 | iex"
subako --version
```

公開 v0.1.7 に Windows x64 用zipとPowerShellインストーラーがあり、配布URLが取得できることを確認しています。Windowsでの実行は未検証です。公式QuickstartのソースではWindows欄が非表示のため、当日の標準手順はOSを問わずCodespacesとし、Windowsローカル手順は運営が一度実行してから案内してください。インストーラーとmacOS/Linuxの配布はARM64・x64、Windowsはx64が確認できました。

### 新規登録から準備まで

`your-unique-handle` を参加者ごとに一意の英小文字・数字・ハイフンの組織名に置き換えます。既存組織を使う人は新規登録を省略し、同じ組織名でログインします。

```sh
subako cloud signup --org your-unique-handle --name "Subako Hackathon"
subako login --org your-unique-handle
subako whoami
subako workspace create --name hackathon
subako workspace use hackathon
subako workspace list
subako model-provider list
subako org credits
```

- `cloud signup` 自体もブラウザー認証を開始します。表示されたURLを開き、アカウント登録または認証を行います。
- `cloud signup` はCLIのログイン情報を保存しません。完了後の `login` も必要です。登録結果に `next: subako login ...` が表示されます。
- 組織のhandleは後から変更できません。`--name` は表示名です。
- `workspace use` はログイン中のプロファイルに選択を保存します。
- `model-provider list` の一覧から provider ID・モデルID・format を確認します。教材のpublish設定に明示的に転記します。一覧の先頭を自動採用しません。
- プラットフォームのモデルプロバイダーが利用できる構成では、参加者自身のモデルAPIキーは不要です。使用可能なモデルは実際の一覧で確認します。
- CLIは保存したログイン情報で認証します。`SUBAKO_API_KEY` 環境変数はCLIのログインの代わりになりません。

### 教材用APIキーの権限

Nodeスクリプトでエージェントを作成・再利用・publishし、モデルとCORS設定を確認してセッションを作成する構成に必要な権限です。

```sh
subako api-key mint \
  --label "hackathon-2026-09-14" \
  --permission agent.read \
  --permission agent.publish \
  --permission model_provider.read \
  --permission session.create \
  --permission session.read \
  --permission session.manage \
  --expires-at 2026-09-15T00:00:00+09:00
```

| 権限 | 使用箇所 |
|---|---|
| `agent.read` | エージェントの一覧・取得、公開バージョンやセキュリティ設定の参照 |
| `agent.publish` | エージェント作成、バージョンpublish、`allowed_origins` 設定 |
| `model_provider.read` | モデルプロバイダーの一覧・詳細参照 |
| `session.create` | セッション作成 |
| `session.read` | 既存セッションとイベントの参照 |
| `session.manage` | セッションへの入力・ツール応答など |

`api-key mint` の最後に表示される秘密値全体を、教材で指定された `.env.local` に保存します。値は一度しか表示されません。例示の有効期限はイベント翌日の日本時間0時であり、継続開発する場合は期限を決め直します。利用可能な権限は `subako api-key permissions`、一覧は `subako api-key list`、失効は `subako api-key revoke <key-id>` で確認・操作できます。

`.env.local`、生成されたセッション設定、ビルド結果はGitに含めません。`VITE_` 付きの値はブラウザーから読めるため、今回の教材で使う専用キーに限定します。画面に表示しないitemの `metadata` も機密情報を隠す仕組みではありません。

### publishとブラウザー接続

通常のCLI手順は以下です。教材では編集箇所を減らすため同じ操作をNodeスクリプトで行えます。

```sh
subako agent create --name hackathon-todo
subako agent config-example --format openai_responses > agent.json
subako agent publish <agent-id> --config agent.json --model-provider <provider-id>
```

`agent.json` の `model.model` を一覧に存在するモデルIDに必ず置き換えます。IDの誤りはpublish時に検知されず、実行時に失敗する可能性があります。publish後も既存セッションは以前のバージョンのままなので、新しいセッションを作ります。

現在のサーバー実装は、ブラウザーからのクロスオリジン通信を `/v1/sessions/{session_id}` 以下に限って許可します。新規セッション作成・エージェントpublish・セキュリティ設定は、どのOriginからも直接呼び出せません。

この教材では**APIキーをブラウザーへ渡しません**。キーを持つのは開発サーバーだけで、Viteに2つの口を置いています。`POST /__subako/session` が既定のエージェントに会話を作ってIDだけを返し、`POST /__subako/token` がその会話に接続するtokenを発行します。ブラウザーは `SubakoSessionClient` にtokenの取得関数（`getToken`）を渡し、会話への接続とclient toolだけをAPIへ直接つなぎます。この接続はエージェントの `allowed_origins` でOriginごとに許可されます。tokenの期限切れは、SDKが `getToken` を呼び直して回復します。

2つの口は [`scripts/subako-dev-api.ts`](../scripts/subako-dev-api.ts) にあり、6アプリすべての `vite.config.ts` に配線済みです。エージェントのpublishはNodeスクリプトで行い、`.env.local` の `SUBAKO_AGENT_*` を更新します。開発・previewの両方で使え、CLIの保存ログイン情報を読む必要はありません。previewも各アプリの5173〜5178を使うため、開発サーバーを止めてからビルド・previewを実行します。envを変更した場合は再ビルドします。

### 運営が確認すること

- [ ] 新規アカウントで登録・ログイン・モデル一覧・APIキー発行を実行する。
- [ ] 教材の推奨モデル・provider ID・formatを参加者が判別できるよう案内する。
- [ ] 参加者の利用クレジットと同時実行条件を確認し、残高不足の補充方法を用意する。
- [ ] Codespacesの認証URL表示と `allowed_origins` 設定を確認する。
- [ ] macOS/Linuxと、案内する場合はWindowsでインストールを確認する。

初期クレジットは無条件に保証しません。確認した本番用設定ソースは `signup_sc: 500` ですが、付与は本人の認証identityごとに一度だけです。同じ人が新しい組織を作り直しても、再付与されず残高0で始まる場合があります。実際の残高は `subako org credits` で確認します。

実装根拠：Subako 本体の `crates/subako-cli/src/bin/subako.rs`、`crates/subako-cli/src/cloud.rs`、`crates/core-server/src/api/agents.rs`、`crates/core-server/src/api/model_providers.rs`、`crates/core-server/src/api/sessions.rs`、`crates/core-server/src/cors.rs`、`crates/service-usecase/src/provision.rs`、`infra/deployments/cloud-us-prod/catalog.yaml`。これらは確認に使った別リポジトリ内のパスです。

## 渋谷のコーヒー店データ

[data/shibuya-coffee-research.json](../data/shibuya-coffee-research.json) に店名・住所・公式URL・確認日・特徴・座標の根拠を記録しています。特徴は短く要約し、情報源の記事日付を付けました。確認日は現地調査日ではありません。

| 店舗 | 店舗情報 | 特徴の根拠 |
|---|---|---|
| ABOUT LIFE COFFEE BREWERS 道玄坂店 | [公式店舗ページ](https://onibuscoffee.com/pages/locations/dogenzaka) | [公式紹介・2022年](https://onibuscoffee.com/blogs/news/117) |
| ABOUT LIFE COFFEE BREWERS 渋谷一丁目店 | [公式店舗ページ](https://onibuscoffee.com/pages/locations/shibuya1st) | [公式紹介・2022年](https://onibuscoffee.com/blogs/news/117) |
| WHITE GLASS COFFEE 渋谷店 | [公式サイト・地図リンク](https://whiteglasscoffee.com/) | [運営会社の開業発表・2019年](https://prtimes.jp/main/html/rd/p/000000015.000023432.html) |
| REC COFFEE 渋谷東店 | [公式店舗ページ](https://rec-coffee.com/pages/shibuyahigashi) | [公式紹介・2023年](https://rec-coffee.com/blogs/yomimono/shibuya-higashi) |
| ブルーボトルコーヒー 渋谷カフェ | [公式店舗ページ](https://store.bluebottlecoffee.jp/pages/shibuya) | 同ページの席・Wi-Fi・公園内の記載 |
| 猿田彦珈琲 JR渋谷新南改札 Short | [公式店舗ページ](https://brand.sarutahiko.jp/shop/shibuya_new_south_gate_short) | [運営会社の開業発表・2026年](https://prtimes.jp/main/html/rd/p/000000203.000027005.html) |

全6件の座標は、公式ページに掲載されたGoogle Mapsリンクの展開先から、店舗ピンの `!3d`・`!4d` の組を取得しています。URLの `@` 以降や埋め込み地図の表示中心は店舗座標と異なることがあるため使用していません。

営業時間・混雑・現在の取扱豆・商品価格・徒歩所要時間は収録していません。2地点を結ぶ直線は実際の徒歩経路ではありません。ECの架空商品はデモ商品と明示し、実店舗の実売商品であるような説明を付けないでください。RECのリリーブレンドについてのみ、公式記事に産地・焙煎・フレーバーの記載がありますが、2023年時点の紹介であり現在の販売を保証しません。

## 徒歩ルートの事前取得

[data/shibuya-walking-routes.json](../data/shibuya-walking-routes.json) は、渋谷駅のデモ出発点と6店舗を結ぶ有向区間の保存データです。[Valhallaの公式API資料](https://valhalla.github.io/valhalla/api/route/api-reference/) に従い、`costing: pedestrian`、徒歩速度4.8 km/h、`format: osrm`、`shape_format: geojson` を指定しました。返却された経路・秒数・距離を保存し、アプリ実行時のルーティングAPI呼び出しを不要にします。

[FOSSGISの利用規約](https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/) は、識別可能なUser-Agent、スクリプト1接続、最大1リクエスト/秒を求め、大量取得を禁止しています。今回は7地点42区間だけを対象に、1接続・各応答後2.2秒以上の間隔で一度取得しました。`User-Agent` と `X-Client-Id` で教材を識別しています。サービスの継続提供は保証されません。

保存したOSM由来の経路データは [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) と出典情報を付けて配布します。地図画面には [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright) と [地図の誤りを報告](https://www.openstreetmap.org/fixthemap) のリンクを表示してください。サービスを利用する公開サイトには運営者の連絡先メールを掲示する条件もあるため、公開する際に運営で記入します。地図タイル画像は取得・同梱していません。

- `geometryGeoJSONLineString.coordinates` の順序は `[経度, 緯度]` です。
- `seconds` はAPIの徒歩推定秒数、`distanceMeters` は経路距離です。単純な直線距離ではありません。
- 始点・終点は道路ネットワークに寄せられるため、店舗ピンと完全には一致しない場合があります。
- 渋谷駅の座標は教材の固定出発点であり、特定の改札や出口を示しません。
- 工事・混雑・実際の通行条件・店舗内での移動・休憩時間は保証しません。利用者向けには「徒歩の目安」と表示します。

ソースの地点JSONは初期データです。ブラウザーに保存された地点・訪問リストは別に扱われ、JSONの編集では上書きされません。保存済みの経路は地点ID・座標が一致する区間だけを利用し、別の地点へ以前の経路を流用しません。経路がない区間は直線距離による目安を表示します。
