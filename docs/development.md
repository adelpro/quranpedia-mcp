# Development

Everything you need to build, test, lint, and deploy `quranpedia-mcp`.

## Prerequisites

- Node.js 20+ (LTS recommended; Dockerfile uses `node:22-alpine`)
- npm, pnpm, or yarn (project is `yarn@1.22.22` per `packageManager`)

## Install

```bash
yarn install
# or: npm install / pnpm install
```

## Build

```bash
yarn build
```

This runs `rimraf dist` and `tsc`. The output is committed to `dist/`.

## Local dev

```bash
# stdio transport (talks to a local MCP client like Claude Desktop)
yarn dev

# HTTP transport on http://localhost:4000/
yarn dev:http
```

The HTTP dev server is also reachable for ad-hoc testing with `curl`.

### Testing stdio interactively

A stdio server expects JSON-RPC on stdin, so running it in a plain terminal just
hangs. Drive it through an MCP client instead:

```bash
# MCP Inspector — interactive web UI to browse tools and call them
yarn inspect
```

This builds `dist/` and launches the inspector against `node dist/server.js`.
The equivalent long form is `yarn build && npx -y
@modelcontextprotocol/inspector --transport stdio -- node dist/server.js`.

> Inspector v1 (the current npm default tag) is deprecated. After upgrading to
> Node ≥ 22.19, switch to v2, which auto-detects stdio and drops the transport
> flag: `npx -y @modelcontextprotocol/inspector node dist/server.js`.

Or point an MCP client (Claude Desktop, Cursor, ...) at your local build — use a
path relative to your checkout, e.g. `node dist/server.js` with `cwd` set to the
repo root, or an absolute path in place of `<project-root>`:

```json
{
  "mcpServers": {
    "quranpedia-mcp": {
      "command": "node",
      "args": ["<project-root>/dist/server.js"]
    }
  }
}
```

## Configuring MCP servers for Claude

Claude Code and Claude Desktop are separate products with separate configuration systems. An MCP server has to be registered in each one separately if you want it available in both.

### Claude Code (CLI)

**Recommended: use the CLI command**

```bash
claude mcp add <server-name> -- node /path/to/server.js
```

This handles the config file for you — no manual JSON editing needed.

**Check what's registered:**

```bash
claude mcp list
claude mcp get <server-name>
```

**Manual config (if you prefer editing files directly):**

- **Project-level** (shared with anyone who clones the repo): `.mcp.json` at the **project root** — not inside a `.claude/` subfolder.
- **User-level** (global, applies across all your projects): `~/.claude.json` — this sits *outside* the `.claude/` directory. Don't confuse it with `~/.claude/settings.json`, which controls permissions and behavior, not MCP servers.

Example `.mcp.json`:

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}
```

### Claude Desktop (app)

Config lives in `claude_desktop_config.json`. Location depends on OS:

| OS | Path |
|---|---|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

Easiest way to find/create it: open Claude Desktop → **Settings → Developer → Edit Config**.

Example config:

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}
```

After editing:

1. Save the file
2. **Fully quit** Claude Desktop (check it's not still running in the tray/menu bar)
3. Reopen it
4. Look for the hammer/tools icon in the chat input box to confirm the server loaded

**Windows-specific caveat:** if you installed the MSIX-packaged build from claude.ai/download, there's a known bug where "Edit Config" opens `%APPDATA%\Claude\...` but the app actually reads a virtualized copy at:

```
%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json
```

If your edits don't seem to take effect, check that path directly.

### Quick reference

| | Claude Code | Claude Desktop |
|---|---|---|
| Project config | `.mcp.json` (project root) | — |
| User/global config | `~/.claude.json` | OS-specific path above |
| CLI helper | `claude mcp add / list / get` | — |
| Restart needed? | No (re-run `claude mcp list` to confirm) | Yes, full quit + reopen |

## Test

```bash
yarn test
```

This runs `yarn build` (via the `test` script), then `test:stdio` and
`test:http`. Both scripts:

- spawn the compiled `dist/server.js`
- open a real MCP client (stdio or Streamable HTTP)
- call `tools/list` and assert that all 23 required tools are registered
- call each tool with a happy-path argument
- assert that annotations are present, including `openWorldHint: true` for
  every tool (all 23 contact the external Quranpedia API)
- close the session and verify the server cleans up

Both suites call the Quranpedia tools against the live
`api.quranpedia.net`, so they require network access.

You can run the stdio or HTTP suite on its own:

```bash
yarn test:stdio
yarn test:http
```

## Lint

```bash
yarn lint
yarn lint:fix
```

## Submission check

Before publishing or submitting to the ChatGPT developer mode, run:

```bash
yarn build
yarn check:submission
```

This lints the deployed server: fetches `https://mcp.quranpedia.net/health`,
calls `tools/list`, and verifies every tool satisfies the submission
requirements (description length, forbidden words, annotations).

## Adding a new tool

The tool surface is structured one file per tool under `src/tools/`. Every
tool is a typed wrapper over a Quranpedia API route. To add a new tool:

1. **Create `src/tools/<name>.ts`** with this shape:

   ```ts
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
   import { z } from 'zod';
   import { fetchYourRoute } from '../quranpedia-client.js';
   import {
     EXTERNAL_READ_ONLY_ANNOTATIONS,
     isQuranpediaNotFound,
     quranpediaErrorResponse,
     quranpediaOk,
   } from './_shared.js';

   export function register<Name>(server: McpServer): void {
     server.registerTool(
       '<name>',
       {
         title: '<Human title>',
         description: '<≤299 chars, no MUST/ALWAYS/NEVER/REQUIRED/SHALL words>',
         inputSchema: z.object({ /* your Zod schema, mirroring the API params */ }),
         annotations: EXTERNAL_READ_ONLY_ANNOTATIONS,
       },
       async (args) => {
         try {
           const { url, data } = await fetchYourRoute(args);
           return quranpediaOk(url, { ...args, data });
         } catch (error) {
           if (isQuranpediaNotFound(error)) {
             // genuinely missing → return null-style payload, not an error
           }
           return quranpediaErrorResponse(error);
         }
       },
     );
   }
   ```

   Add a typed endpoint helper in `src/quranpedia-client.ts` that routes
   through `quranpediaRequest()` (shared TTL cache + `source` attribution), and
   name both the tool and the helper after the API route. See
   `src/tools/get-book.ts` as a worked example.

2. **Wire it in `src/tools/index.ts`** in alphabetical order (so `tools/list`
   output is stable).

3. **Add a positive test** in `scripts/test.js` and `scripts/test-http.js`,
   plus a negative test if your tool has a `Zod.refine()` or non-trivial
   validation. Every tool is external, so the `openWorldHint: true`
   annotation assertion already covers it.

4. **Document the tool** in `docs/tools.md` (description, schema, output,
   example, annotations).

5. **Run the full pipeline**:

   ```bash
   yarn build
   yarn test
   yarn check:submission
   ```

6. **Bump the version** in `package.json` and `server.json` (keep them in
   sync).

7. **Add a CHANGELOG entry** under the new version heading.

## Deploy

The public endpoint at `https://mcp.quranpedia.net/` is rebuilt and restarted
from the repo via the standard `docker compose` flow:

```bash
docker compose up -d --build
```

Verify the new version is live:

```bash
curl -sS https://mcp.quranpedia.net/health
# → {"status":"ok","version":"2.0.0","sessions":0,"quranpediaCache":{"memoryEntries":0,"diskEntries":0,"hits":0,"misses":0}}
```

## Release

Publish the package to npm:

```bash
npm login                              # once per machine (verify: npm whoami)
yarn version patch                     # or minor / major
npm publish --dry-run                  # sanity-check the tarball contents
yarn publish --access public           # or: npm publish --access public
```

`prepublishOnly: yarn build` runs automatically before publishing, so the
tarball always contains a fresh build — no manual `yarn build` needed.

Notes:

- `dist/server.js` is the executable (`bin`); `main` points at `dist/server.js`,
  so consumers get a working module entry even without the bin.
- `files` in `package.json` ships only `dist/` and `CHANGELOG.md` — anything else
  you want in the tarball must be listed there.
- After publishing, verify with `npm view quranpedia-mcp version` and
  `npx -y quranpedia-mcp`.

## Repository layout

```
quranpedia-mcp/
├── README.md                    # short landing page
├── CHANGELOG.md
├── docs/                        # detailed documentation (this folder)
│   ├── index.md
│   ├── tools.md
│   ├── integrations.md
│   ├── architecture.md
│   └── development.md
├── src/
│   ├── server.ts                # transport resolver
│   ├── create-server.ts         # McpServer factory
│   ├── quranpedia-client.ts     # typed Quranpedia API client + config
│   ├── quranpedia-cache.ts      # TTL memory + optional disk cache
│   ├── stdio.ts                 # stdio transport
│   ├── http.ts                  # Streamable HTTP transport
│   ├── version.ts
│   └── tools/
│       ├── index.ts             # registerTools() — wires all 26 tools
│       ├── _shared.ts           # jsonOk / jsonError / quranpediaOk / annotations
│       ├── get-ayah-book-content.ts
│       ├── get-ayah-options.ts
│       ├── get-book.ts
│       ├── get-categories.ts
│       ├── get-category-items.ts
│       ├── get-fatwa.ts
│       ├── get-mushaf.ts
│       ├── get-mushaf-ayah.ts
│       ├── get-mushaf-surah.ts
│       ├── get-mushafs.ts
│       ├── get-note.ts
│       ├── get-reciters.ts
│       ├── get-related-books.ts
│       ├── get-surah-books.ts
│       ├── get-surah-fatwas.ts
│       ├── get-surah-information.ts
│       ├── get-surah-tafsirs.ts
│       ├── get-topics.ts
│       ├── get-translation.ts
│       ├── get-translation-available-languages.ts
│       ├── get-translation-books.ts
│       ├── get-translation-by-book.ts
│       └── search.ts
├── scripts/
│   ├── test.js                  # stdio end-to-end
│   ├── test-http.js             # HTTP end-to-end
│   └── check-submission.js      # ChatGPT submission linter
├── Dockerfile
├── docker-compose.yml
├── server.json                  # MCP registry manifest (npm stdio + remote HTTP)
├── plugin.json                  # Agent Plugins manifest (agent-plugins.org)
├── mcp.json                     # Agent Plugins MCP config (stdio + Streamable HTTP)
└── smithery.yaml                # Smithery stdio manifest
```
