# 🔍 Vespa Admin UI

Vespa Search Engine向けのデバッグ・管理画面です。Solr Adminのような操作をWebブラウザから行えます。

## 機能

| タブ | 機能 |
|------|------|
| 🔍 **Search** | YQLクエリエディタ、パラメーター指定、レスポンス確認（ツリー/Raw表示） |
| 🔬 **Query Trace** | `trace.level`経由でのクエリ解析・トークナイザー処理確認 |
| 🗄️ **Schema / Config** | Config Server APIからアプリケーションパッケージファイル一覧・内容表示 |
| 💚 **Health** | ノードヘルスチェック・ApplicationStatus・メトリクスノード一覧 |
| 📋 **Logs** | Log APIまたはログの直接ペーストでのログ閲覧・フィルタリング |

## セットアップ

```bash
cd vespa-admin
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 設定

右上の **⚙ Settings** から接続先を変更できます：

| 設定項目 | デフォルト | 説明 |
|---------|-----------|------|
| Query Container URL | `http://localhost:8081` | 検索・ヘルス・メトリクスAPI |
| Feed Container URL | `http://localhost:8080` | Document API |
| Config Server URL | `http://localhost:19071` | アプリパッケージ・ログAPI |

### CORSについて

Next.jsのAPI Routeがプロキシとして機能するため、ブラウザのCORS制約は問題になりません。
Vespa AdminサーバーからVespaへアクセスします。

## Docker

### Docker Hubからpullして実行

```bash
docker run -p 3000:3000 \
  -e VESPA_URL=http://your-vespa-host:8081 \
  -e FEED_URL=http://your-vespa-host:8080 \
  -e CONFIG_URL=http://your-vespa-host:19071 \
  sashimimochi/vespa-admin-ui:latest
```

### ローカルでビルドして実行

```bash
docker build -t vespa-admin-ui .
docker run -p 3000:3000 \
  -e VESPA_URL=http://your-vespa-host:8081 \
  -e FEED_URL=http://your-vespa-host:8080 \
  -e CONFIG_URL=http://your-vespa-host:19071 \
  vespa-admin-ui
```

### docker-compose

```bash
# docker-compose.yml を編集して環境変数を設定してから起動
docker compose up
```

### 環境変数

| 環境変数 | デフォルト | 説明 |
|---------|-----------|------|
| `VESPA_URL` | `http://localhost:8081` | クエリコンテナURL（Search / Health 用） |
| `FEED_URL` | `http://localhost:8080` | フィードコンテナURL（Documents 用） |
| `CONFIG_URL` | `http://localhost:19071` | コンフィグサーバーURL（Schema / Logs 用） |

### Kubernetes環境

```yaml
# Deployment例
env:
  - name: VESPA_URL
    value: "http://vespa-container:8081"
  - name: FEED_URL
    value: "http://vespa-container:8080"
  - name: CONFIG_URL
    value: "http://vespa-configserver:19071"
```

```bash
# port-forward例
kubectl port-forward svc/vespa-container 8081:8081
kubectl port-forward svc/vespa-configserver 19071:19071
```

## Vespa APIの対応表

| 機能 | API |
|------|-----|
| 検索 | `GET :8081/search/?yql=...` |
| クエリトレース | `GET :8081/search/?yql=...&trace.level=4` |
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

## ビルド・本番起動

```bash
npm run build
npm start
```

