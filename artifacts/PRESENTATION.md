# Quranpedia MCP — Project Presentation

> A walkthrough of `quranpedia-mcp` v2.0.0 (MIT).
> An MCP server exposing **23 read-only tools**, all backed by the Quranpedia
> API (`https://api.quranpedia.net/v1`) — every tool named to mirror the API
> route it calls. No bundled dataset; network access required for all tools.

---

## 1. Principal files & folder structure

```
quranpedia-mcp/
├── README.md                # Landing page, badges, quick starts
├── CHANGELOG.md             # Keep-a-Changelog format, semver history
├── CONTRIBUTING.md          # Contribution guide
├── LICENSE                  # MIT (Copyright 2026 Quranpedia)
├── package.json             # Scripts, deps, bin, files, packageManager
├── yarn.lock                # Yarn 1 lockfile ("yarn lockfile v1")
├── tsconfig.json            # NodeNext, ES2022, strict
├── server.json              # MCP registry manifest (npm stdio + remote HTTP)
├── plugin.json              # Agent Plugins manifest (agent-plugins.org)
├── mcp.json                 # MCP client config → mcp.quranpedia.net; also the Agent Plugins mcp.json
├── smithery.yaml            # Smithery.ai deploy/install manifest
├── Dockerfile               # 2-stage build
├── docker-compose.yml       # Local prod compose (env_file, 256m, healthcheck)
├── .env.example             # All 14 documented env vars
├── .gitignore                # node_modules, dist, .env
├── .dockerignore             # Slim build context
├── .prettierrc               # Prettier options
├── .yarnrc.yml                # Yarn Berry config — inert under Yarn 1
├── eslint.config.mjs         # ESLint 9 flat config
├── commitlint.config.cjs     # Conventional commits
├── .husky/                   # pre-commit (lint) + commit-msg (commitlint)
├── .github/                  # Issue templates + PR template (no CI workflows)
├── assets/                   # Screenshots
├── dist/                     # Compiled output (committed)
├── docs/                     # index / tools / integrations / architecture / development
├── scripts/                  # test.js, test-http.js, check-submission.js
└── src/
    ├── server.ts              # Transport resolver (CLI flag → TRANSPORT env → stdio)
    ├── create-server.ts       # McpServer factory (name + version + registerTools)
    ├── stdio.ts                # stdio transport
    ├── http.ts                 # Streamable HTTP transport + hardening
    ├── quranpedia-client.ts    # Typed Quranpedia API client + env config
    ├── quranpedia-cache.ts     # TTL cache: memory + optional disk layer
    ├── version.ts               # Reads version from package.json
    └── tools/                   # 26 tools, one file each + index.ts + _shared.ts
```

---

## 2. Protocols

| Layer            | Protocol / mechanism                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| MCP              | **Model Context Protocol** — stdio (local) and **Streamable HTTP** (remote, SSE)                                                      |
| Wire format      | JSON-RPC 2.0 messages: `initialize`, `tools/list`, `tools/call`, etc.                                                                 |
| MCP version      | `2024-11-05` per docs — TODO: confirm this matches what the server actually advertises at runtime (SDK may negotiate a newer version) |
| HTTP surface     | `POST/GET/DELETE /` (MCP), `GET /health`, `OPTIONS *` (CORS preflight)                                                                |
| Tool annotations | Anthropic hints: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`                                                 |

Transport selection precedence (src/server.ts):

1. CLI flag `--http` / `--stdio`
2. CLI flag `--transport=http|stdio`
3. Env var `TRANSPORT` (default `stdio`)

Both transports share the same `createServer()` path → identical tool surface.

### Agent Plugins alignment

`quranpedia-mcp` is packaged as a conformant [Agent Plugins](https://agent-plugins.org/)
package — the emerging vendor-neutral standard (Technical Steering Committee includes
Amazon, Cursor, Microsoft, OpenAI, and Vercel) for portable AI-agent components:

- `plugin.json` — the required Agent Plugins manifest, identifying the plugin and the
  spec version it targets.
- `mcp.json` — doubles as the MCP client config (§1) and the Agent Plugins-format
  description of the server's stdio/Streamable HTTP transports.
- No `skills/` directory — this plugin only ships an MCP server, which the spec supports
  standalone (skills are optional).

Because the package already follows the shared structure, any Agent Plugins-compatible
client can discover and load `quranpedia-mcp` without client-specific adaptation, on top
of the existing MCP registry (`server.json`) and Smithery (`smithery.yaml`) listings.

---

## 3. stdio vs Streamable HTTP — deeper look

|           | stdio                                                                                | Streamable HTTP (HTTPS)                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire      | JSON-RPC over stdin/stdout of a child process                                        | JSON-RPC over HTTPS `POST` + SSE stream                                                                                                                                                     |
| Spawn     | client starts `node dist/server.js` or `npx -y quranpedia-mcp`                       | client connects to `https://mcp.quranpedia.net/`                                                                                                                                            |
| Use case  | local dev, desktop apps (Claude Desktop, Cursor, Zed) — no server to run or maintain | remote/hosted, multi-user, browser clients, ChatGPT developer mode — anywhere the server can't be spawned locally                                                                           |
| Auth      | none (local process)                                                                 | none — open endpoint, Cloudflare-fronted; acceptable here since all 26 tools are read-only against a public API, but worth stating explicitly rather than leaving as an implicit assumption |
| Hardening | trust your own machine                                                               | host allow-list, per-IP rate limit, session TTL                                                                                                                                             |

---

## 4. Tools (23, all read-only)

Every tool is a thin typed wrapper over `https://api.quranpedia.net/v1`, named
after the route it calls, and annotated `openWorldHint: true`.

| #   | Tool                                  | API route                                                        |
| --- | ------------------------------------- | ---------------------------------------------------------------- |
| 1   | `get_ayah_book_content`               | `GET /ayah/{surah_id}/{ayah_number}/book/{book_id}`              |
| 2   | `get_ayah_options`                    | `GET /ayah/{surah_id}/{ayah_number}/options`                     |
| 3   | `get_book`                            | `GET /book/{book_id}`                                            |
| 4   | `get_categories`                      | `GET /categories/{type?}`                                        |
| 5   | `get_category_items`                  | `GET /category/{category_id}/{type}`                             |
| 6   | `get_fatwa`                           | `GET /fatwa/{fatwa_id}`                                          |
| 7   | `get_mushaf`                          | `GET /mushafs/{id}`                                              |
| 8   | `get_mushaf_ayah`                     | `GET /mushafs/{mushaf_id}/{surah_id}/{ayah_number}`              |
| 9   | `get_mushaf_surah`                    | `GET /mushafs/{mushaf_id}/{surah_id}`                            |
| 10  | `get_mushafs`                         | `GET /mushafs`                                                   |
| 11  | `get_note`                            | `GET /note/{note_id}`                                            |
| 12  | `get_reciters`                        | `GET /reciters`                                                  |
| 13  | `get_related_books`                   | `GET /related-books/{book_id}`                                   |
| 14  | `get_surah_books`                     | `GET /surah/books/{surah_id}`                                    |
| 15  | `get_surah_fatwas`                    | `GET /surah/fatwas/{surah_id}`                                   |
| 16  | `get_surah_information`               | `GET /surah/information/{surah_id}`                              |
| 17  | `get_surah_tafsirs`                   | `GET /surah/tafsirs/{surah_id}`                                  |
| 18  | `get_topics`                          | `GET /topics`                                                    |
| 19  | `get_translation`                     | `GET /translations/{surah_id}/{ayah_number}/{language?}`         |
| 20  | `get_translation_available_languages` | `GET /translations/available-languages/{surah_id}/{ayah_number}` |
| 21  | `get_translation_books`               | `GET /translation-books/{language_code?}`                        |
| 22  | `get_translation_by_book`             | `GET /translation/{book_id}/{surah_id}/{ayah_number?}`           |
| 23  | `search`                              | `GET /search/{query}/{type?}`                                    |

Conventions: success = `{content:[{type:"text",text:JSON}]}`; errors = `isError:true`;
genuinely missing resources return `null` (not an error). Every Quranpedia response
carries a `source: {provider, url}` block for attribution.

---

## 5. Docs

| File                   | Contents                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| `docs/index.md`        | Overview, public endpoint, tool table                                        |
| `docs/tools.md`        | Full reference: schema, response shapes, examples for every tool (623 lines) |
| `docs/integrations.md` | Claude Desktop/Web, ChatGPT, Cursor, VS Code, Smithery, Docker               |
| `docs/architecture.md` | Internals: transports, API client, HTTP hardening, Docker, env tables        |
| `docs/development.md`  | Build, test, lint, add a tool, deploy, release, repo layout                  |
| `README.md`            | Landing page + badges (npm, Smithery, license, engine)                       |
| `CHANGELOG.md`         | Keep-a-Changelog; 1.0.0 → 2.0.0 (Quranpedia-only history)                    |
| `CONTRIBUTING.md`      | Contribution workflow, commit/hook guidance                                  |

---

## 6. Package scripts & packages

### Scripts (package.json)

| Script                     | Command                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `prebuild`                 | `rimraf dist`                                              |
| `build`                    | `tsc`                                                      |
| `start`                    | `node dist/server.js` (stdio)                              |
| `start:http`               | `cross-env TRANSPORT=http node dist/server.js`             |
| `dev`                      | `tsx src/server.ts` (stdio)                                |
| `dev:http`                 | `cross-env TRANSPORT=http tsx src/server.ts`               |
| `lint` / `lint:fix`        | ESLint over `src/**/*.{ts,tsx}` (+ `--fix`)                |
| `format`                   | Prettier write over `src/**/*.{ts,tsx,js,jsx,json,css,md}` |
| `test`                     | `yarn build && yarn test:stdio && yarn test:http`          |
| `test:stdio` / `test:http` | E2E against compiled server (spawns MCP client)            |
| `check:submission`         | ChatGPT developer-mode pre-submission linter               |
| `inspect`                  | MCP Inspector web UI — browse & call the 26 tools (§7)     |
| `prepare`                  | `husky` (installs git hooks on `yarn install`)             |

### Dependencies (runtime, 2)

`@modelcontextprotocol/sdk` (MCP primitives) · `zod` (tool input schemas)

### DevDependencies

`typescript`, `tsx`, `rimraf`, `@types/node`, `cross-env`, `eslint` + `@eslint/js`, `typescript-eslint`,
`eslint-plugin-prettier`, `eslint-config-prettier`, `globals`, `prettier`, `husky`, `@commitlint/cli`,
`@commitlint/config-conventional`.

Also: `bin: quranpedia-mcp → dist/server.js` (npm package is runnable via `npx -y quranpedia-mcp`),
`files: [dist, CHANGELOG.md]`, `type: module`.

---

## 7. Local dev: MCP Inspector + Claude Desktop

### MCP Inspector — `yarn inspect`

`yarn inspect` compiles `dist/` first (it runs `yarn build`), then launches the
**MCP Inspector** — an interactive web UI that connects to the local build over
stdio. You can browse all 26 tools, inspect their input schemas, and call them
one by one against the live Quranpedia API, no MCP client required:

```bash
yarn inspect
# → builds dist/, opens the Inspector in your browser
#   (tools/list, tools/call, raw JSON-RPC inspection)
```

The long form is `yarn build && npx -y @modelcontextprotocol/inspector --transport stdio -- node dist/server.js`.
The Inspector drives `dist/server.js`, so run `yarn build` again after any `src/` change.

### Claude Desktop — local stdio via Settings → Developer → Edit Config

Claude Desktop needs the full path to the compiled server (it does **not**
resolve relative to the project). To point it at the local `dist/server.js`:

1. Open **Claude Desktop → Settings → Developer → Edit Config**.
2. Add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "quranpedia-mcp": {
      "command": "node",
      "args": ["C:\\path\\to\\quranpedia-mcp\\dist\\server.js"]
    }
  }
}
```

3. Save the file, **fully quit** Claude Desktop (check the tray/menu bar), and
   reopen it.
4. Confirm the tools appear via the hammer icon in the chat input box.

> Windows MSIX caveat: if "Edit Config" edits don't take effect, the app may be
> reading the virtualized copy under
> `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`.

---

## 8. Environment variables

All **14 vars documented in `.env.example` are used in code — unchanged in v2.0.0
(no new vars added, none removed)**. Table of what reads what:

| Variable                    | Default                 | Read by              | Purpose                               |
| --------------------------- | ----------------------- | -------------------- | ------------------------------------- |
| `TRANSPORT`                 | `stdio`                 | src/server.ts        | stdio vs http                         |
| `PORT`                      | `4000`                  | src/server.ts        | HTTP listen port                      |
| `HOST`                      | `0.0.0.0`               | src/server.ts        | HTTP bind host                        |
| `MCP_ALLOWED_HOSTS`         | unset (allow all)       | src/server.ts        | Host-header allow-list                |
| `MCP_SESSION_TTL_MS`        | `300000`                | src/server.ts        | Idle session TTL                      |
| `MCP_MAX_SESSIONS`          | `500`                   | src/server.ts        | Session cap (503)                     |
| `MCP_MAX_BODY_BYTES`        | `1048576`               | src/server.ts        | 1 MiB body cap                        |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60`                    | src/server.ts        | Per-IP token bucket                   |
| `QP_BASE_URL`               | `api.quranpedia.net/v1` | quranpedia-client.ts | Upstream base URL                     |
| `QP_DEFAULT_TAFSIR_BOOK_ID` | `1`                     | quranpedia-client.ts | Default tafsir book                   |
| `QP_FETCH_TIMEOUT_MS`       | `30000`                 | quranpedia-client.ts | Upstream timeout                      |
| `QP_CACHE_TTL_MS`           | `2592000000` (30 d)     | quranpedia-client.ts | Cache lifetime                        |
| `QP_CACHE_DIR`              | unset (memory only)     | quranpedia-client.ts | Optional disk cache dir               |
| `QP_CACHE_MAX_ENTRIES`      | `5000`                  | quranpedia-client.ts | In-memory cap                         |
| `QP_CACHE_MAX_DISK_ENTRIES` | `5000`                  | quranpedia-client.ts | On-disk cap (prunes expired + oldest) |

---

## 9. Husky · commitlint · ESLint · Prettier

### Husky (v9, installed via `prepare: husky`)

- `.husky/pre-commit` → `yarn lint`
- `.husky/commit-msg` → `yarn commitlint --edit "$1"`

### commitlint (`commitlint.config.cjs`)

- Extends `@commitlint/config-conventional`
- `type-enum` pinned to the 11 conventional types:
  `feat fix chore docs style refactor perf test build ci revert`

### ESLint 9 flat config (`eslint.config.mjs`)

- `ignores: ['dist/', 'node_modules/']`
- `eslint.recommended` + `typescript-eslint` recommended
- `prettier/prettier: error` (via `eslint-plugin-prettier`)
- Strict TS rules: `explicit-function-return-type`, `no-explicit-any`, `consistent-type-imports`
- `sort-imports` (case-insensitive, declaration-sort off)
- `eslint-config-prettier` appended **last** to disable conflicting style rules

### Prettier (`.prettierrc`)

`semi: true · singleQuote: true · printWidth: 100 · tabWidth: 2 · trailingComma: "all" · endOfLine: "auto"`

### Ignores

- No `.eslintignore` (flat config uses the `ignores` key, which is scoped to `src/**` anyway).
- `.gitignore`: `node_modules`, `dist`, `.env`.

---

## 10. Docker — multi-stage build, compose, ignore

### `.dockerignore` (why each line)

| Entry                                                    | Reason                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `node_modules`, `dist`                                   | Rebuilt inside the image — don't ship host artifacts                 |
| `.git`, `.github`, `.husky`, `assets`, `scripts`, `*.md` | Not needed at build/runtime; smaller context                         |
| `.env*`                                                  | **Secrets never baked into the image** (config comes via `env_file`) |

### `Dockerfile` — two-stage build

```
Stage 1 (build)  node:22-alpine
   COPY package.json yarn.lock → yarn install --frozen-lockfile   # all deps
   COPY tsconfig.json src → yarn build                            # → dist/
Stage 2 (runtime) node:22-alpine
   ENV NODE_ENV=production TRANSPORT=http HOST=0.0.0.0 PORT=4000
   COPY package.json yarn.lock → yarn install --frozen-lockfile --production
   yarn cache clean                                              # slim image
   COPY --from=build /app/dist ./dist
   USER node                                                      # unprivileged
   EXPOSE 4000
   HEALTHCHECK (30s / 15s start / 3 retries) → GET /health        # via node fetch
   CMD ["node", "dist/server.js"]
```

Why two installs: stage 1 needs devDeps to compile; stage 2 installs **production
deps only** (no TS, eslint, husky…) → smaller, safer runtime image.

### `docker-compose.yml`

- `build: .` + `container_name: quranpedia-mcp`, `restart: unless-stopped`
- `env_file: .env` (PORT/HOST/all MCP*\*/QP*\* come from the host `.env`)
- Ports: `127.0.0.1:${PORT:-4000}:${PORT:-4000}` — **bound to loopback only** (not public)
- `mem_limit: 256m`
- Mirrored healthcheck using the same `${PORT:-4000}` interpolation

---

## 11. `smithery.yaml` — why it's in the repo

**Smithery** (smithery.ai) is a marketplace + hosting platform for MCP servers — the MCP
equivalent of "one-click install" (similar to Vercel for MCP). This manifest tells Smithery
how to launch the server:

```yaml
startCommand:
  type: stdio
  commandFunction: (_config) => ({
    command: "npx",
    args: ["-y", "quranpedia-mcp"]   # install from npm, run over stdio
  })
configSchema:
  type: object
  properties: {}                      # no user-configurable options
```

- Allows users to add `quranpedia-mcp` to any MCP client through Smithery's registry UI.
- The `npx -y quranpedia-mcp` command mirrors the README's local stdio quick start.
- Backed by the npm package (`bin: dist/server.js`); the badge in README links to it.
- Empty `configSchema` = server takes no parameters; Smithery just spawns the command.

---

## 12. What's next (roadmap)

### License — keep MIT or change?

Current state:

- **MIT License**, `LICENSE` file, **Copyright (c) 2026 quranpedia**.
- Mirrored in `package.json` → `"license": "MIT"` and the README license badge.
- Permissive: anyone may use/copy/modify/publish/distribute/sublicense/sell, with the
  copyright + permission notice kept; software provided "AS IS", no warranty,
  no liability for authors/holders.

Worth deciding deliberately rather than by default, since this is a wrapper around
the Quranpedia API surface and Islamic content is being exposed through it:

- **Keep MIT** — maximizes adoption and reuse; matches the rest of the MCP/npm
  ecosystem (most comparable MCP servers ship MIT or Apache-2.0), so it's the
  path of least friction for anyone wiring this into their own client or fork.
- **Consider a more restrictive license** (e.g. Apache-2.0 with patent grant,
  or a source-available/non-commercial variant) if there's a concern about
  downstream commercial use of Quranpedia-sourced content without attribution,
  or about forks being republished without the `source` attribution block the
  API already returns (§4).
- No action is being taken here — this is flagged as a decision point, not a
  problem. If MIT stays, no changes needed anywhere (license file, badges, and
  `package.json` already agree).

### Publish to npm (`quranpedia-mcp`)

- Publish the package to the npm registry as **`quranpedia-mcp`** so clients can
  run `npx -y quranpedia-mcp` over **stdio** instead of pointing an MCP client
  at a local `dist/server.js`.
- No rename needed: the name already matches `package.json`, `bin`, `server.json`,
  Smithery, and every doc. Verify after publishing with `npm view quranpedia-mcp version`.

### Contact email

- Replace the `contact@quranpedia.net` placeholder with the real support
  address in `package.json`, `README.md`, `CONTRIBUTING.md`, and
  `PRESENTATION.md` (real address TBD).

### Deploy Docker to `mcp.quranpedia.net`

- Run the hardened `Dockerfile` / `docker-compose.yml` on a server behind the
  `mcp.quranpedia.net` subdomain (Cloudflare-fronted) to serve the **HTTPS
  Streamable HTTP** protocol publicly.
- Set `MCP_ALLOWED_HOSTS=mcp.quranpedia.net`; verify with
  `curl https://mcp.quranpedia.net/health`.

### Publish to Smithery

- List `quranpedia-mcp` on [Smithery](https://smithery.ai) for one-click
  discoverability. `smithery.yaml` already spawns `npx -y quranpedia-mcp` over
  stdio, so the listing needs no new wiring.

### Transfer repo to `quranpedia` org

- **Action:** transfer the repository from the personal account
  (`github.com/adelpro/quranpedia-mcp`) to the `quranpedia` GitHub organization
  (`github.com/quranpedia/quranpedia-mcp`). Docs, `server.json`, and `package.json`
  already reference the `quranpedia` org URL, so this brings the actual repo location
  in line with what's already published — right now it's a mismatch.
- GitHub auto-redirects the old URL after transfer, so existing clones and links
  keep working, and npm/Smithery metadata will then match the org.
- **Do this before the npm publish** to avoid churn — published package metadata is
  harder to correct after the fact.
