# 🔍 Vespa Admin UI

A debug and administration UI for the Vespa Search Engine. Perform Solr Admin-like operations directly from your web browser.

> 🇯🇵 日本語ドキュメントは [docs/README_ja.md](docs/README_ja.md) をご覧ください。

## Features

| Tab | Description |
|-----|-------------|
| 🔍 **Search** | YQL query editor, parameter configuration, response viewer (tree / raw) |
| 📥 **Documents** | Insert, Update, and Delete documents via the Document API. Supports single and batch operations |
| 🔬 **Query Trace** | Query analysis and tokenizer inspection via `trace.level` |
| 🗄️ **Schema / Config** | Browse application package files and their contents via the Config Server API |
| 💚 **Health** | Node health checks, ApplicationStatus, and metrics node listing |
| 📋 **Logs** | Log browsing and filtering via the Log API or by pasting logs directly |

## Setup

```bash
cd vespa-admin-ui
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Docker

### Run from Docker Hub / GitHub Container Registry

```bash
docker run -p 3000:3000 \
  -e VESPA_URL=http://your-vespa:8081 \
  -e FEED_URL=http://your-vespa:8080 \
  -e CONFIG_URL=http://your-vespa:19071 \
  343mochi/vespa-admin-ui:latest
```

### Run with docker-compose

```bash
docker compose up
```

Configure the Vespa endpoints in the `environment` section of `docker-compose.yml`.

### Build the Docker image locally

```bash
docker build -t vespa-admin-ui .
docker run -p 3000:3000 \
  -e VESPA_URL=http://your-vespa:8081 \
  -e FEED_URL=http://your-vespa:8080 \
  -e CONFIG_URL=http://your-vespa:19071 \
  vespa-admin-ui
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VESPA_URL` | `http://localhost:8081` | Query container URL (search, health, metrics) |
| `FEED_URL` | `http://localhost:8080` | Feed container URL (Document API) |
| `CONFIG_URL` | `http://localhost:19071` | Config Server URL (schema, logs) |

> **Note:** When environment variables are set, they take precedence over values stored in localStorage. Changing the URL via **⚙ Settings** in the UI saves it to the browser's localStorage, but environment variable values will be applied on each page load as long as they are set.

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

## Configuration

Use **⚙ Settings** in the upper right corner to change connection targets:

| Setting | Default | Description |
|---------|---------|-------------|
| Vespa Container URL | `http://localhost:8081` | Search, health, and metrics API |
| Feed Container URL | `http://localhost:8080` | Document API |
| Config Server URL | `http://localhost:19071` | Application package and logs API |

### About CORS

Since Next.js API Routes act as a proxy, browser CORS restrictions are not an issue.
Requests to Vespa are made from the Vespa Admin server.

### Kubernetes / Docker Environments

```bash
# Example port-forward
kubectl port-forward svc/vespa-container 8080:8080
kubectl port-forward svc/vespa-configserver 19071:19071
```

## Vespa API Reference

| Feature | API |
|---------|-----|
| Search | `GET :8081/search/?yql=...` |
| Query Trace | `GET :8081/search/?yql=...&trace.level=4` |
| Document Insert / Update | `POST/PUT :8080/document/v1/{ns}/{type}/docid/{id}` |
| Document Delete | `DELETE :8080/document/v1/{ns}/{type}/docid/{id}` |
| Health Check | `GET :8081/state/v1/health` |
| Application Status | `GET :8081/ApplicationStatus` |
| Metrics | `GET :8081/metrics/v2/values` |
| Config Server Health | `GET :19071/state/v1/health` |
| Application Package | `GET :19071/application/v2/tenant/{t}/application/{a}/content/` |
| Logs | `GET :19071/log/v1/log` |

## Inspecting Indexed Tokens

Adding a debug summary to your schema lets you inspect the actual tokens indexed for a field:

```sd
document-summary debug-summary {
  summary myfield { }
  summary myfield_tokens { source: myfield tokens }
}
```

Run a query in the Query Trace tab with `summary=debug-summary` to view the tokens.

## Testing

### Unit / Component Tests

Uses [Jest](https://jestjs.io/) + [Testing Library](https://testing-library.com/). Test files are located under `__tests__/`.

```
__tests__/
  api/        # Unit tests for API Routes
  components/ # React component tests
  utils/      # Utility function tests
```

#### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode (monitors file changes)
npm test -- --watch

# For CI environments (no interactive input)
npm run test:ci

# Run a specific file
npm test -- __tests__/components/HealthPanel.test.tsx
```

#### Test Environment

| Item | Details |
|------|---------|
| Test framework | Jest |
| DOM environment | jsdom |
| Component testing | @testing-library/react |
| Target files | `__tests__/**/*.test.{ts,tsx}` |

### E2E Tests

Browser-based E2E tests using [Playwright](https://playwright.dev/). Tests are located under `e2e/`.

```
e2e/
  home.spec.ts    # Main page (tab navigation, settings panel, font size toggle)
  search.spec.ts  # Search panel interactions
  health.spec.ts  # Health panel interactions
```

#### First-time Setup

```bash
# Install Playwright browsers
npx playwright install chromium
```

#### Running E2E Tests

```bash
# Run E2E tests (auto-starts the Next.js server)
npm run test:e2e

# Run in UI mode (interactive test runner)
npm run test:e2e:ui

# Run a specific file
npx playwright test e2e/home.spec.ts
```

#### E2E Test Environment

| Item | Details |
|------|---------|
| Test framework | Playwright |
| Browser | Chromium |
| Target files | `e2e/**/*.spec.ts` |
| API mocking | `/api/config` and `/api/vespa` mocked via `page.route()` |

## Build / Production Start

```bash
npm run build
npm start
```

## Developer Guide

### Directory Structure

```
vespa-admin-ui/
├── app/
│   ├── api/
│   │   ├── config/     # API Route returning environment variables
│   │   └── vespa/      # Proxy API Route to Vespa
│   ├── layout.tsx      # Application layout
│   └── page.tsx        # Main page (tab management, settings)
├── components/
│   ├── DocumentPanel.tsx  # Documents tab
│   ├── HealthPanel.tsx    # Health tab
│   ├── LogsPanel.tsx      # Logs tab
│   ├── SchemaPanel.tsx    # Schema / Config tab
│   ├── SearchPanel.tsx    # Search tab
│   └── TracePanel.tsx     # Query Trace tab
├── __tests__/
│   ├── api/        # Unit tests for API Routes
│   ├── components/ # React component tests
│   └── utils/      # Utility function tests
├── docs/
│   ├── README_ja.md       # Japanese README
│   └── VESPA_ADMIN_UI.md  # Detailed documentation (Japanese)
├── Dockerfile
├── docker-compose.yml
└── next.config.js
```

### Tech Stack

| Item | Details |
|------|---------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Testing | Jest + @testing-library/react |
| Container | Docker / Docker Compose |

### Architecture

- **Next.js API Route (`/api/vespa`)** acts as a proxy between the browser and Vespa, avoiding CORS issues
- **`/api/config`** returns environment variables (`VESPA_URL`, `FEED_URL`, `CONFIG_URL`) to the client
- Each tab is implemented as an independent component under `components/`

### Adding New Tabs / Features

1. Create a new panel component in `components/`
2. Add an entry to the `TABS` array in `app/page.tsx`
3. Render the new component in the Content section of `app/page.tsx`
