# Vespa Admin UI ドキュメント

> Vespa Search Engine のデバッグ・運用を支援するWeb管理画面です。  
> Solr Admin に近い操作感を目指して構築されています。

---

## 目次

1. [概要](#概要)
2. [セットアップ](#セットアップ)
3. [機能一覧](#機能一覧)
   - [Search（検索エクスプローラー）](#search検索エクスプローラー)
   - [Documents（ドキュメント操作）](#documentsドキュメント操作)
   - [Query Trace（クエリトレース）](#query-traceクエリトレース)
   - [Schema / Config（設定ファイルビューワー）](#schema--config設定ファイルビューワー)
   - [Health（ヘルスチェック）](#healthヘルスチェック)
   - [Logs（ログビューワー）](#logsログビューワー)
4. [既知の制約・注意事項](#既知の制約注意事項)
5. [Solr Admin との機能比較](#solr-admin-との機能比較)
6. [Vespa API 対応表](#vespa-api-対応表)

---

## 概要

### 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| 接続方式 | Next.js API Route がプロキシとして動作（CORS 回避） |

### 接続先

| 名称 | デフォルト | 用途 |
|------|-----------|------|
| Vespa Container URL | `http://localhost:8081` | 検索（Search・Query Trace）・ヘルス・メトリクス |
| Feed Container URL | `http://localhost:8080` | ドキュメント操作（Document API） |
| Config Server URL | `http://localhost:19071` | アプリパッケージ・ログ取得 |

接続先は画面右上の **⚙ Settings** からいつでも変更できます。

---

## セットアップ

```bash
cd vespa-admin-ui
npm install
npm run dev
# → http://localhost:3000 でアクセス
```

### Kubernetes / Docker 環境での利用

```bash
# port-forward してローカルからアクセス
kubectl port-forward svc/vespa-container 8080:8080
kubectl port-forward svc/vespa-configserver 19071:19071
```

---

## 機能一覧

---

### Search（検索エクスプローラー）

#### できること

- YQL クエリをブラウザ上で記述・実行できる
- よく使うパラメーターを GUI で指定できる
- 任意のカスタムパラメーターを `key=value` 形式で追加できる
- レスポンスをインタラクティブなツリー表示、または Raw JSON で確認できる
- 結果をクリップボードにコピーできる

#### ユーザーが得られること

- `curl` を書かずに YQL の動作確認ができる
- ヒット件数・各ドキュメントのフィールド値・relevance スコアを一覧で確認できる
- `ranking` プロファイルを切り替えてスコアの変化を即座に比較できる
- `offset` / `hits` でページネーションの動作確認ができる

#### GUI で指定できるパラメーター

| パラメーター | 説明 |
|------------|------|
| `yql` | YQL クエリ本文（必須） |
| `hits` | 返却件数（デフォルト: 10） |
| `offset` | 取得開始位置 |
| `ranking` | 使用する Rank Profile 名 |
| `summary` | 使用する Document Summary 名 |
| `model.language` | 言語指定（例: `ja`, `en`） |
| `timeout` | タイムアウト（例: `5s`） |
| カスタムパラメーター | `ranking.features.query(alpha)=0.5` など任意のパラメーターを複数行で追加可能 |

#### 操作方法

- `Ctrl + Enter`（Mac: `Cmd + Enter`）でクエリを実行
- 結果ビューは **hits**（カード形式）/ **tree**（ツリー形式）/ **raw**（JSON文字列）から選択

---

### Documents（ドキュメント操作）

#### できること

- Document API を使ってドキュメントの **Insert（挿入）**・**Full Update（全件更新）**・**Partial Update（部分更新）**・**Delete（削除）** を実行できる
- 単一ドキュメント（Single）またはバッチ（Batch）での操作に対応
- JSON ファイルをアップロードしてドキュメント本文を読み込める
- Partial Update 時、単純値フィールドを自動的に `{"assign": value}` 形式に変換する機能（auto-assign）
- Vespa のフル ID 形式（`id:<namespace>:<doctype>::<user-id>`）を入力フィールドに貼り付けると namespace / docType / id を自動分解

#### ユーザーが得られること

- `curl` を書かずにブラウザ上でドキュメント操作を試せる
- バッチ JSON を貼り付けて複数ドキュメントを一括操作できる
- `Document API is not configured` エラーが発生した場合は `services.xml` への追加方法をその場で案内してくれる

#### 操作方法

1. **OPERATION** でどの操作をするかを選択（Insert / Full Update / Partial Update / Delete）
2. **INPUT MODE** で単一（Single）かバッチ（Batch）かを選択
3. Namespace・Doc Type・Document ID を入力（Batch モードではデフォルト値を設定）
4. Insert / Update の場合はドキュメント本文を JSON で入力
5. **▶ Execute** ボタンで実行、結果が RESULTS セクションに表示される

#### Partial Update のフォーマット例

```json
{
  "fields": {
    "title": "新しいタイトル",
    "year": { "increment": 1 }
  }
}
```

> **auto-assign ON** の場合、`"title": "新しいタイトル"` のような単純値は送信時に自動的に `{"assign": "新しいタイトル"}` に変換されます。

#### Batch JSON のフォーマット例

```json
[
  { "id": "doc-1", "fields": { "title": "最初のドキュメント" } },
  { "id": "doc-2", "namespace": "custom", "docType": "article", "fields": { "title": "2つ目のドキュメント" } }
]
```

#### 前提条件

Document API を使うには、Vespa アプリケーションの `services.xml` の `<container>` ノード内に以下が必要です：

```xml
<document-api/>
```

---

### Query Trace（クエリトレース）

#### できること

- `trace.level` パラメーターを指定してクエリ実行し、Vespa 内部の処理ログを取得・表示できる
- トレースログをカテゴリ（`query` / `linguistic` / `rank` / `info` / `error`）でフィルタリングできる
- トレースの Raw JSON を確認できる
- `debug-summary` 経由でインデックス済みトークンを可視化できる（後述）

#### ユーザーが得られること

- クエリが内部でどの Searcher チェーンを通っているかを確認できる
- クエリリライトが発生しているかを確認できる
- ランキング計算や federation の処理順序を把握できる
- `trace.level` を上げることで linguistic 処理のログを確認できる場合がある

#### trace.level の目安

| レベル | 取得できる情報 |
|--------|--------------|
| 1 | Searcher チェーンの呼び出し一覧 |
| 2 | 主要な処理ステップ |
| 3〜4 | クエリパース・リライトの詳細 |
| 5〜6 | linguistic 処理（ステミング等）のログ（バージョン・設定依存） |
| 7〜9 | 非常に詳細なデバッグ情報 |

#### ⚠ 重要な制約：`userQuery()` を使う場合

YQL に `userQuery()` が含まれる場合、**`query` フィールドへの入力が必須**です。

```
# NG: query フィールドが空のまま実行するとエラー
yql: select * from sources * where userQuery()

# OK: query に検索テキストを入力してから実行
yql: select * from sources * where userQuery()
query: すもももももももものうち
```

`userQuery()` は `query=...` パラメーターの値を YQL に展開するプレースホルダーです。
`query` が空だと Vespa が展開対象を見つけられずエラーを返します。

#### インデックス済みトークンの確認方法（debug-summary）

Solr の Analysis タブのように、**あるフィールドが実際にどのトークンとしてインデックスされているか**を確認するには、スキーマに `debug-summary` を追加する必要があります。

**手順 1: スキーマに debug-summary を追加**

```sd
document-summary debug-summary {
  summary title { }
  summary title_tokens { source: title tokens }
  # 確認したいフィールドを同様に追加
  summary body { }
  summary body_tokens { source: body tokens }
}
```

**手順 2: Query Trace タブで実行**

- `summary` フィールドに `debug-summary` を入力
- `query` に確認したいテキストを入力
- 実行するとトレース画面上部に **「INDEXED TOKENS」** セクションが表示される

**確認できること・できないこと**

| 確認したいこと | 方法 | 可否 |
|--------------|------|------|
| ドキュメントのトークン（インデックス時） | debug-summary | ✅ |
| クエリのトークン（検索時） | trace.level=6 以上（設定依存） | △ |
| リアルタイムでの任意テキストのトークン分割 | Vespa に専用 API なし | ❌ |

> **補足:** Solr の `/analysis/field` に相当するリアルタイムトークン分析 API は Vespa には存在しません。  
> インデックス済みドキュメントを通じて間接的に確認するのが現実的な方法です。

---

### Schema / Config（設定ファイルビューワー）

#### できること

- Config Server から現在デプロイ中のアプリケーションパッケージのファイル一覧を取得できる
- スキーマ定義（`.sd`）・サービス設定（`services.xml`）・その他設定ファイルの内容をブラウザ上で確認できる
- `.sd` / `.xml` ファイルのシンタックスハイライト表示
- ファイル内容をクリップボードにコピーできる

#### ユーザーが得られること

- 現在 Vespa に**実際に適用されているスキーマ**の内容をファイルを開かずに確認できる
- Rank Profile の定義・`function` 式・`first-phase` / `second-phase` の設定を確認できる
- `services.xml` でクラスター構成・コンポーネント設定を確認できる
- ローカルのファイルと Vespa 上の設定にズレがないかを素早く確認できる

#### 接続設定

デフォルト設定（ほとんどの場合これで動作します）：

| 項目 | デフォルト値 |
|------|------------|
| tenant | `default` |
| application | `default` |
| environment | `prod` |
| region | `default` |
| instance | `default` |

接続に失敗した場合は `environment` を `default` に変更してみてください。

#### `.sd` ファイルのシンタックスハイライト色

| 色 | 対象 |
|----|------|
| 🔵 青 | `schema`, `document`, `field`, `rank-profile` などの構造定義 |
| 🟣 紫 | `indexing`, `index`, `attribute` などのインデックス設定 |
| 🟠 オレンジ | `function`, `first-phase`, `second-phase` などのランキング定義 |
| 🟢 緑 | `type`, `inherits` などの型・継承 |
| ⚫ グレー | コメント |

---

### Health（ヘルスチェック）

#### できること

- 主要なエンドポイントの死活確認を一覧で確認できる
- 30秒ごとに自動で再チェックする（リアルタイムインジケーター付き）
- ApplicationStatus から Searcher チェーンの構成を確認できる
- メトリクス API から認識されているノード一覧を確認できる

#### チェック対象

| 項目 | エンドポイント | 確認できること |
|------|--------------|--------------|
| Container (Query) | `:8080/state/v1/health` | 検索コンテナの死活・バージョン |
| Config Server | `:19071/state/v1/health` | 設定サーバーの死活 |
| Application Status | `:8080/ApplicationStatus` | Searcher チェーン構成 |
| Metrics API | `:8080/metrics/v2/values` | 認識ノード一覧 |

#### ユーザーが得られること

- どのコンポーネントが起動しているかを一目で把握できる
- Searcher チェーンに期待するコンポーネントが登録されているかを確認できる
- 簡易な死活監視として利用できる

> **補足:** 詳細なメトリクス（QPS・レイテンシ・メモリ使用率など）の監視は Prometheus + Grafana で行うことを推奨します。本画面はあくまで簡易的な死活確認用途です。

---

### Logs（ログビューワー）

#### できること

- Config Server の Log API（`:19071/log/v1/log`）からログを取得して表示できる
- `vespa-logfmt` コマンドの出力をペーストしてパース・表示できる
- ログレベル（`error` / `warning` / `info` / `debug` / `fine`）でフィルタリングできる
- コンポーネント名・メッセージテキストでフリーテキスト検索できる
- 取得する秒数範囲とコンポーネントを指定できる

#### ユーザーが得られること

- エラーログ・警告ログを素早く絞り込んで確認できる
- 特定コンポーネント（例: `qrserver`）のログだけを抽出できる
- `error` / `warning` の発生件数サマリーをヘッダーで把握できる

#### Log API が使えない場合の代替方法

コンテナ内で以下のコマンドを実行し、出力結果を「Paste Logs」モードに貼り付けてください：

```bash
# 直近のログをすべてのレベルで出力
vespa-logfmt -l all /opt/vespa/logs/vespa/vespa.log | tail -500

# エラーと警告のみ
vespa-logfmt -l error,warning /opt/vespa/logs/vespa/vespa.log | tail -200
```

---

## 既知の制約・注意事項

### トークン分析について

Vespa には Solr の `/analysis/field` 相当の API が存在しないため、入力テキストをリアルタイムにトークン分割して可視化する機能は実装できません。トークンの確認は `debug-summary` 経由でインデックス済みドキュメントを通じて行う必要があります。

### Config Server への接続

Config Server（port 19071）への接続は、Next.js のサーバーサイド（API Route）から行います。ブラウザから直接アクセスするわけではないため、**Next.js が動いているサーバーから Config Server に疎通できる**必要があります。

### ログの取得制限

Log API（`/log/v1/log`）はすべての環境で有効とは限りません。Docker Compose や Kubernetes など環境によっては API が応答しない場合があります。その場合は「Paste Logs」モードをご利用ください。

### スキーマファイルの編集・デプロイ

本ツールはスキーマファイルの**参照専用**です。編集・デプロイは `vespa deploy` コマンドまたは Deploy API を直接使用してください。

---

## Solr Admin との機能比較

| 機能 | Solr Admin | Vespa Admin UI | 備考 |
|------|-----------|----------------|------|
| クエリ実行・結果確認 | ✅ | ✅ | |
| レスポンスのツリー表示 | ✅ | ✅ | |
| パラメーター GUI 指定 | ✅ | ✅ | |
| Searcher チェーン実行トレース | ❌ | ✅ | trace.level で取得 |
| インデックス済みトークン確認 | ✅ Analysis タブ | △ | debug-summary 経由で可能 |
| リアルタイムテキスト分析 | ✅ Analysis タブ | ❌ | Vespa に API なし |
| スキーマ定義の参照 | ✅ | ✅ | |
| スキーマのオンライン編集 | ❌ | ❌ | `vespa deploy` で行う |
| ノード死活確認 | ✅ | ✅ | |
| 詳細メトリクス | △ | ❌ | Prometheus + Grafana 推奨 |
| ログ確認 | ✅ | ✅ | |
| ドキュメント操作（Insert/Update/Delete） | ✅ | ✅ | Document API 経由 |
| コア/インデックス管理 | ✅ | ❌ | `vespa document` コマンドで行う |

---

## Vespa API 対応表

本ツールが内部で使用している Vespa の API 一覧です。

| タブ | エンドポイント | ポート | 用途 |
|------|--------------|--------|------|
| Search | `GET /search/` | 8081 | クエリ実行 |
| Query Trace | `GET /search/?trace.level=N` | 8081 | トレース付きクエリ実行 |
| Documents | `POST /document/v1/{ns}/{type}/docid/{id}` | 8080 | ドキュメント挿入・全件更新 |
| Documents | `PUT /document/v1/{ns}/{type}/docid/{id}` | 8080 | ドキュメント部分更新 |
| Documents | `DELETE /document/v1/{ns}/{type}/docid/{id}` | 8080 | ドキュメント削除 |
| Health | `GET /state/v1/health` | 8081 | Container 死活確認 |
| Health | `GET /ApplicationStatus` | 8081 | Searcher チェーン構成 |
| Health | `GET /metrics/v2/values` | 8081 | ノード・メトリクス |
| Health | `GET /state/v1/health` | 19071 | Config Server 死活確認 |
| Schema | `GET /application/v2/tenant/{t}/application/{a}/environment/{e}/region/{r}/instance/{i}/content/?recursive=true` | 19071 | ファイル一覧取得 |
| Schema | `GET /application/v2/tenant/{t}/...content/{path}` | 19071 | ファイル内容取得 |
| Logs | `GET /log/v1/log` | 19071 | ログ取得 |
