# Architecture

This page explains how `quranpedia-mcp` is wired together internally.
For client-facing docs (tools, integrations, deployment), see the other pages
under `docs/`.

## High-level overview

```
        ┌────────────────────────────────────────────┐
        │           src/create-server.ts             │
        │  new McpServer({ name, version }) +        │
        │  registerTools(server)                     │
        └────────┬──────────────────────┬────────────┘
                 │                      │
                 ▼                      ▼
   ┌────────────────────┐   ┌──────────────────────┐
   │   src/stdio.ts     │   │     src/http.ts      │
   │  StdioServerTrans… │   │  StreamableHTTP…     │
   │                    │   │  + hardening         │
   └────────────────────┘   └──────────────────────┘
```

Every one of the 26 tools is a thin typed wrapper over a Quranpedia API route,
reaching the external service through a shared typed client:

```
   src/tools/*.ts (26 tools, mirroring API routes)
        │
        ▼
   src/quranpedia-client.ts ─────>  api.quranpedia.net (HTTPS /v1)
   (typed endpoint helpers)  ▲
                             │ cache
                  src/quranpedia-cache.ts
                  (memory + optional QP_CACHE_DIR disk layer)
```

## Transport selection

`src/server.ts` picks the transport at startup, in this order of precedence:

1. CLI flags `--http` / `--stdio`
2. CLI flag `--transport=http|stdio`
3. Environment variable `TRANSPORT` (default `stdio`)

Then it dispatches to either `runStdio()` or `runHttp(opts)`. Both call
`createServer()` from `create-server.ts`, which:

1. Constructs a fresh `McpServer({ name: 'quranpedia-mcp', version: VERSION })`.
2. Calls `registerTools(server)`, which registers all 26 tools in alphabetical
   order for a stable `tools/list` output.

Because both transports share the same `createServer()` + `registerTools()` path,
the advertised tool surface is identical regardless of transport.

## Quranpedia client and cache

`src/quranpedia-client.ts` is a thin, typed wrapper around the Quranpedia API
(`https://api.quranpedia.net/v1`). It centralizes:

- **Config** — base URL and defaults, all env-tunable (see table below).
- **Error normalization** — Quranpedia's `{ error: "…" }` bodies (400/404) are
  thrown as `QuranpediaError` instances carrying the HTTP `status` and `url`.
  Handlers branch on status: a 404 means "genuinely missing" (→ `null` payload),
  anything else becomes an `isError` response.
- **Typed endpoint helpers** — one per tool, each returning `{ url, data }` for
  attribution: `fetchAyahOptions`, `fetchAyahBook`, `fetchSurahTafsirs`,
  `fetchTranslation`, `fetchSurahInformation`, `searchQuranpedia`,
  `fetchMushafs`, `fetchMushaf`, `fetchMushafAyah`, `fetchMushafSurah`,
  `fetchSurahBooks`, `fetchSurahFatwas`, `fetchTranslationBooks`,
  `fetchAyahTranslationByBook`, `fetchTranslationAvailableLanguages`,
  `fetchBook`, `fetchRelatedBooks`, `fetchFatwa`, `fetchNote`, `fetchTopics`,
  `fetchReciters`, `fetchCategories`, `fetchCategoryItems`.

Every request flows through `src/quranpedia-cache.ts` (`getOrSet`):

| Layer                    | When used | Notes                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In-memory `Map`          | always    | Shared across HTTP sessions; capped at `QP_CACHE_MAX_ENTRIES` (oldest evicted first).                                                                                                                                                                                                                                                                                         |
| On-disk (`QP_CACHE_DIR`) | when set  | SHA-1-keyed JSON files that survive restarts, so a long-running server keeps serving cached ayahs even if the upstream is down. Point it at a mounted volume (e.g. rclone/FUSE Garage S3) for durable caching. Bounded: expired entries are pruned and, when the file count exceeds `QP_CACHE_MAX_DISK_ENTRIES`, the oldest files are evicted (throttled to once per minute). |

Concurrent callers with the same key share one in-flight fetch (a `pending`
map), so popular ayahs never hammer the upstream in parallel.

### Quranpedia environment variables

| Variable                    | Default                         | Purpose                                                                         |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------------------- |
| `QP_BASE_URL`               | `https://api.quranpedia.net/v1` | Upstream base URL.                                                              |
| `QP_DEFAULT_TAFSIR_BOOK_ID` | `1`                             | Book used by `get_ayah_book_content` when `book_id` is omitted (تيسير التفسير). |
| `QP_FETCH_TIMEOUT_MS`       | `30000`                         | Per-request upstream timeout.                                                   |
| `QP_CACHE_TTL_MS`           | `2592000000` (30 d)             | Cache entry lifetime; Quranic text is static.                                   |
| `QP_CACHE_DIR`              | _(unset)_                       | Optional persistent cache directory.                                            |
| `QP_CACHE_MAX_ENTRIES`      | `5000`                          | In-memory cache cap.                                                            |
| `QP_CACHE_MAX_DISK_ENTRIES` | `5000`                          | On-disk cache cap (expired + oldest entries pruned on writes).                  |

`/health` reports `quranpediaCache: { memoryEntries, diskEntries, hits, misses }`
alongside the existing `status` / `version` / `sessions` fields.

## HTTP transport

`src/http.ts` implements a hardened Streamable HTTP transport on top of
Node's built-in `http.createServer`. The same `McpServer` factory is used,
but each session gets its own `StreamableHTTPServerTransport` with a UUID
session id. Sessions are tracked in a `Map<sessionId, Session>`.

### Endpoints

| Method    | Path      | Purpose                                                            |
| --------- | --------- | ------------------------------------------------------------------ |
| `POST`    | `/`       | Initialize new sessions and send JSON-RPC requests                 |
| `GET`     | `/`       | Server-sent events for streaming responses                         |
| `DELETE`  | `/`       | Close a session                                                    |
| `GET`     | `/health` | `{"status":"ok","version":"…","sessions":N,"quranpediaCache":{…}}` |
| `OPTIONS` | `*`       | CORS preflight                                                     |

### Hardening

| Control           | Variable                    | Default   | Notes                                                    |
| ----------------- | --------------------------- | --------- | -------------------------------------------------------- |
| Host allow-list   | `MCP_ALLOWED_HOSTS`         | _(unset)_ | Comma-separated `Host` header values. Unset = allow all. |
| Request body cap  | `MCP_MAX_BODY_BYTES`        | `1048576` | 1 MiB.                                                   |
| Per-IP rate limit | `MCP_RATE_LIMIT_PER_MINUTE` | `60`      | Token bucket, 60-second window.                          |
| Session TTL       | `MCP_SESSION_TTL_MS`        | `300000`  | 5 minutes. Reaper runs every 60 s.                       |
| Max sessions      | `MCP_MAX_SESSIONS`          | `500`     | Returns 503 when exceeded.                               |
| CORS              | _baked in_                  | `*`       | Open CORS for browser-based clients.                     |

`uncaughtException` and `unhandledRejection` are logged to stderr but not
crashing the process. Graceful shutdown on `SIGTERM` / `SIGINT` with a 10-second
hard-exit timer.

## stdio transport

`src/stdio.ts` connects a single `McpServer` to `StdioServerTransport`. The
server is `connect()`-ed immediately so clients can `initialize` and
`tools/list` right away; every tool contacts the Quranpedia API on demand
through the shared cache.

## Docker

`Dockerfile` is a two-stage build:

- **Build stage** (`node:22-alpine`): `yarn install --frozen-lockfile`,
  copies `tsconfig.json` and `src/`, runs `yarn build`.
- **Runtime stage** (`node:22-alpine`): installs production deps only, copies
  the compiled `dist/`, runs as the unprivileged `node` user.

Default env: `TRANSPORT=http HOST=0.0.0.0 PORT=4000`. A `HEALTHCHECK` hits
`http://127.0.0.1:${PORT}/health` every 30 seconds (15 s start period,
3 retries).

`docker-compose.yml` adds a `mem_limit: 256m`, binds `127.0.0.1:${PORT:-4000}:${PORT:-4000}`,
and reads the same env file (typically `.env`).

## Cloudflare proxy

The publicly hosted endpoint at `https://mcp.quranpedia.net/` is fronted by
Cloudflare. The container runs behind Cloudflare's edge; the
`Host`-header allow-list in `MCP_ALLOWED_HOSTS` is set to `mcp.quranpedia.net`
in the `.env` so requests from any other hostname are rejected at the
application layer. The `Dockerfile` healthcheck still works because it
connects to `127.0.0.1:${PORT}` directly.
