# 🔍 Vespa Admin UI

Vespa Search Engine向けのデバッグ・管理画面です。Solr Adminのような操作をWebブラウザから行えます。

## 機能

| タブ | 機能 |
|------|------|
| 🔍 **Search** | YQLクエリエディタ、パラメーター指定、レスポンス確認（ツリー/Raw表示） |
| 📥 **Documents** | Document APIを使ったドキュメントのInsert・Update・Delete。単一・バッチ操作に対応 |
| 🔬 **Query Trace** | `trace.level`経由でのクエリ解析・トークナイザー処理確認 |
| 🗄️ **Schema / Config** | Config Server APIからアプリケーションパッケージファイル一覧・内容表示 |
| 💚 **Health** | ノードヘルスチェック・ApplicationStatus・メトリクスノード一覧 |
| 📋 **Logs** | Log APIまたはログの直接ペーストでのログ閲覧・フィルタリング |

## セットアップ

```bash
cd vespa-admin-ui
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## Docker

### Docker Hub / GitHub Container Registry から起動

```bash
docker run -p 3000:3000 \
  -e VESPA_URL=http://your-vespa:8081 \
  -e FEED_URL=http://your-vespa:8080 \
  -e CONFIG_URL=http://your-vespa:19071 \
  343mochi/vespa-admin-ui:latest
```

### docker-compose で起動

```bash
docker compose up
```

`docker-compose.yml` の `environment` セクションでVespaのエンドポイントを設定してください。

### ローカルでDockerイメージをビルド

```bash
docker build -t vespa-admin-ui .
docker run -p 3000:3000 \
  -e VESPA_URL=http://your-vespa:8081 \
  -e FEED_URL=http://your-vespa:8080 \
  -e CONFIG_URL=http://your-vespa:19071 \
  vespa-admin-ui
```

### 環境変数

| 環境変数 | デフォルト | 説明 |
|---------|-----------|------|
| `VESPA_URL` | `http://localhost:8081` | Queryコンテナ URL（検索・ヘルス・メトリクス） |
| `FEED_URL` | `http://localhost:8080` | FeedコンテナURL（Document API） |
| `CONFIG_URL` | `http://localhost:19071` | Config Server URL（スキーマ・ログ） |

> **Note:** 環境変数が設定されている場合は環境変数がlocalStorageより優先されます。UIの **⚙ Settings** でURLを変更すると、ブラウザのlocalStorageに保存されますが、環境変数が設定されている間はアクセスのたびに環境変数の値が適用されます。

### Kubernetes

```yaml
env:
  - name: VESPA_URL
    value: "http://vespa-container:8081"
  - name: FEED_URL
    value: "http://vespa-container:8080"
  - name: CONFIG_URL
    value: "http://vespa-configserver:19071"
```

## 設定

右上の **⚙ Settings** から接続先を変更できます：

| 設定項目 | デフォルト | 説明 |
|---------|-----------|------|
| Vespa Container URL | `http://localhost:8081` | 検索・ヘルス・メトリクスAPI |
| Feed Container URL | `http://localhost:8080` | Document API |
| Config Server URL | `http://localhost:19071` | アプリパッケージ・ログAPI |

### CORSについて

Next.jsのAPI Routeがプロキシとして機能するため、ブラウザのCORS制約は問題になりません。
Vespa AdminサーバーからVespaへアクセスします。

### Kubernetes/Docker環境

```bash
# port-forward例
kubectl port-forward svc/vespa-container 8080:8080
kubectl port-forward svc/vespa-configserver 19071:19071
```

## Vespa APIの対応表

| 機能 | API |
|------|-----|
| 検索 | `GET :8081/search/?yql=...` |
| クエリトレース | `GET :8081/search/?yql=...&trace.level=4` |
| ドキュメント挿入・更新 | `POST/PUT :8080/document/v1/{ns}/{type}/docid/{id}` |
| ドキュメント削除 | `DELETE :8080/document/v1/{ns}/{type}/docid/{id}` |
| ヘルスチェック | `GET :8081/state/v1/health` |
| アプリケーション状態 | `GET :8081/ApplicationStatus` |
| メトリクス | `GET :8081/metrics/v2/values` |
| Config Server ヘルス | `GET :19071/state/v1/health` |
| アプリパッケージ | `GET :19071/application/v2/tenant/{t}/application/{a}/content/` |
| ログ | `GET :19071/log/v1/log` |

## トークン解析の詳細確認

スキーマにデバッグサマリを追加すると、実際にインデックスされたトークンが確認できます：

```sd
document-summary debug-summary {
  summary myfield { }
  summary myfield_tokens { source: myfield tokens }
}
```

Query Traceタブで `summary=debug-summary` を指定して実行するとトークンが表示されます。

## テスト

### ユニットテスト

[Jest](https://jestjs.io/) + [Testing Library](https://testing-library.com/) を使用しています。テストファイルは `__tests__/` 配下に配置されています。

```
__tests__/
  api/        # API Route のユニットテスト
  components/ # React コンポーネントのテスト
  utils/      # ユーティリティ関数のテスト
```

#### 実行方法

```bash
# 全ユニットテストを実行
npm test

# ウォッチモードで実行（ファイル変更を監視）
npm test -- --watch

# CI環境向け（インタラクティブ入力なし）
npm run test:ci

# 特定ファイルのみ実行
npm test -- __tests__/components/HealthPanel.test.tsx
```

#### テスト環境

| 項目 | 内容 |
|------|------|
| テストフレームワーク | Jest |
| DOM環境 | jsdom |
| コンポーネントテスト | @testing-library/react |
| 対象ファイル | `__tests__/**/*.test.{ts,tsx}` |

### E2Eテスト

[Puppeteer](https://pptr.dev/) を使用した E2E テストです。実際にブラウザを起動し、画面操作を通じて UI の挙動を検証します。テストファイルは `__tests__/e2e/` 配下に配置されています。

```
__tests__/
  e2e/
    navigation.test.ts  # ページ読み込み・タブナビゲーション・設定パネル・フォントサイズ切り替えのテスト
e2e/
  global-setup.js       # テスト前にNext.js開発サーバーを起動
  global-teardown.js    # テスト後にサーバーを停止
jest.e2e.config.js      # E2Eテスト専用のJest設定
```

#### 実行方法

```bash
# E2Eテストを実行（内部で自動的に開発サーバーを起動・停止）
npm run test:e2e
```

> **Note:** E2E テストを実行すると、ポート `3001` で Next.js 開発サーバーが自動的に起動します。テスト完了後は自動的に停止します。ポート `3001` が使用中の場合はテストが失敗します。

#### テスト内容

| グループ | テスト数 | 内容 |
|---------|---------|------|
| ページ読み込み | 5件 | タイトル・ヘッダー・タブ数・ラベル・ヘルスインジケーターの表示確認 |
| タブナビゲーション | 6件 | 各タブクリック後に対応パネルが表示されることを確認 |
| 設定パネル | 3件 | Settings ボタンの開閉動作を確認 |
| フォントサイズ切り替え | 3件 | フォントサイズ切り替えボタンの状態変化を確認 |

#### テスト環境

| 項目 | 内容 |
|------|------|
| テストフレームワーク | Jest |
| ブラウザ操作 | Puppeteer（ヘッドレスChrome） |
| 対象ファイル | `__tests__/e2e/**/*.test.ts` |

## ビルド・本番起動

```bash
npm run build
npm start
```

## 開発者向け情報

### ディレクトリ構成

```
vespa-admin-ui/
├── app/
│   ├── api/
│   │   ├── config/     # 環境変数を返す API Route
│   │   └── vespa/      # Vespa へのプロキシ API Route
│   ├── layout.tsx      # アプリケーションレイアウト
│   └── page.tsx        # メインページ（タブ管理・設定）
├── components/
│   ├── DocumentPanel.tsx  # Documents タブ
│   ├── HealthPanel.tsx    # Health タブ
│   ├── LogsPanel.tsx      # Logs タブ
│   ├── SchemaPanel.tsx    # Schema / Config タブ
│   ├── SearchPanel.tsx    # Search タブ
│   └── TracePanel.tsx     # Query Trace タブ
├── __tests__/
│   ├── api/        # API Route のユニットテスト
│   ├── components/ # React コンポーネントのテスト
│   ├── e2e/        # E2E テスト（Puppeteer）
│   └── utils/      # ユーティリティ関数のテスト
├── e2e/
│   ├── global-setup.js     # E2E テスト用サーバー起動
│   └── global-teardown.js  # E2E テスト用サーバー停止
├── docs/
│   └── VESPA_ADMIN_UI.md  # 詳細ドキュメント
├── jest.config.js          # ユニットテスト用 Jest 設定
├── jest.e2e.config.js      # E2E テスト用 Jest 設定
├── Dockerfile
├── docker-compose.yml
└── next.config.js
```

### 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| ユニットテスト | Jest + @testing-library/react |
| E2Eテスト | Jest + Puppeteer |
| コンテナ | Docker / Docker Compose |

### アーキテクチャ

- **Next.js API Route (`/api/vespa`)** がブラウザとVespaの間のプロキシとして動作し、CORSの問題を回避します
- **`/api/config`** が環境変数（`VESPA_URL`, `FEED_URL`, `CONFIG_URL`）をクライアントに返します
- 各タブはそれぞれ独立したコンポーネント（`components/`配下）として実装されています

### 新しいタブ・機能の追加

1. `components/` に新しいパネルコンポーネントを作成する
2. `app/page.tsx` の `TABS` 配列にエントリを追加する
3. `app/page.tsx` の Content セクションで新しいコンポーネントをレンダリングする
