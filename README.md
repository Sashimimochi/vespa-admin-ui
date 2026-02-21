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

### ローカル開発

```bash
npm ci
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### Docker

```bash
# イメージをビルドして起動
docker build -t vespa-admin-ui .
docker run -p 3000:3000 vespa-admin-ui

# 接続先を環境変数で指定する場合
docker run -p 3000:3000 \
  -e VESPA_URL=http://my-vespa:8080 \
  -e CONFIG_URL=http://my-configserver:19071 \
  vespa-admin-ui
```

### docker-compose

```bash
# デフォルト設定で起動
docker compose up

# 接続先を環境変数で上書きして起動
VESPA_URL=http://my-vespa:8080 \
CONFIG_URL=http://my-configserver:19071 \
docker compose up
```

## 設定

### 環境変数

| 環境変数 | デフォルト | 説明 |
|---------|-----------|------|
| `VESPA_URL` | `http://localhost:8080` | Vespa Containerエンドポイント |
| `CONFIG_URL` | `http://localhost:19071` | Config Serverエンドポイント |

環境変数を設定すると、起動時のデフォルト接続先として使用されます（ビルド不要）。
起動後は右上の **⚙ Settings** から画面上でも変更できます。

### CORSについて

Next.jsのAPI Routeがプロキシとして機能するため、ブラウザのCORS制約は問題になりません。
Vespa AdminサーバーからVespaへアクセスします。

### Kubernetes環境

```yaml
# Kubernetes Deployment例
env:
  - name: VESPA_URL
    value: "http://vespa-container-svc:8080"
  - name: CONFIG_URL
    value: "http://vespa-configserver-svc:19071"
```

```bash
# port-forward例
kubectl port-forward svc/vespa-container 8080:8080
kubectl port-forward svc/vespa-configserver 19071:19071
```

## Vespa APIの対応表

| 機能 | API |
|------|-----|
| 検索 | `GET :8080/search/?yql=...` |
| クエリトレース | `GET :8080/search/?yql=...&trace.level=4` |
| ヘルスチェック | `GET :8080/state/v1/health` |
| アプリケーション状態 | `GET :8080/ApplicationStatus` |
| メトリクス | `GET :8080/metrics/v2/values` |
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
