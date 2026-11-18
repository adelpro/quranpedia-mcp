# Integrations

The public MCP server at **<https://mcp.quranpedia.net/>** works with any MCP-compatible
client — Claude, ChatGPT, Cursor, VS Code, and others. Each section below shows a
copy-pasteable config snippet for that client.

If your client is missing here, the server follows the standard MCP wire protocol;
just point it at the URL and it will work.

## Table of contents

- [Claude Desktop](#claude-desktop)
- [Claude Web (claude.ai)](#claude-web)
- [ChatGPT (developer mode)](#chatgpt-developer-mode)
- [Cursor](#cursor)
- [VS Code (GitHub Copilot Chat)](#vs-code)
- [Other MCP-compatible clients](#other-mcp-compatible-clients)
- [Agent Plugins](#agent-plugins)
- [Smithery](#smithery)
- [Self-hosting with Docker](#self-hosting-with-docker)

---

## Claude Desktop

Claude Desktop supports both transports. Edit the config file at:

| OS      | Path                                                              |
| ------- | ----------------------------------------------------------------- |
| macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json`                     |
| Linux   | `~/.config/Claude/claude_desktop_config.json`                     |

### Option A — public HTTPS (recommended, no install)

```json
{
  "mcpServers": {
    "quran": {
      "url": "https://mcp.quranpedia.net/"
    }
  }
}
```

The MCP server is hosted at `https://mcp.quranpedia.net/`. Restart Claude Desktop
after editing the config and the tools will appear in the tool picker.

### Option B — local stdio

```json
{
  "mcpServers": {
    "quran": {
      "command": "npx",
      "args": ["-y", "quranpedia-mcp"]
    }
  }
}
```

This spawns the server as a child process. The tools still contact the
Quranpedia API over the network, so `api.quranpedia.net` must be reachable.

---

## Claude Web

[claude.ai](https://claude.ai) supports MCP connectors for Pro / Team / Enterprise
plans.

1. Open **Settings → Connectors → Add custom connector**.
2. Enter the URL: `https://mcp.quranpedia.net/`.
3. Save. The connector appears as **Quranpedia MCP** in the tool picker.
4. The server requires no API key — CORS is open and the endpoint is public.

If your plan does not show the "Add custom connector" option, use Claude Desktop
(see above) or a different MCP-compatible client.

---

## ChatGPT (developer mode)

ChatGPT's developer mode supports MCP servers. The submission checklist has four
hard requirements; all of them are satisfied by this server:

1. **Public HTTPS URL** — `https://mcp.quranpedia.net/`.
2. **Tool descriptions under 300 characters** — every tool's `description` is concise
   and free of system-prompt directive words. See [tools.md](tools.md) for the
   exact strings.
3. **Explicit tool annotations** — every tool declares `readOnlyHint: true`,
   `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: true`
   (all 26 tools contact the external Quranpedia API).
4. **No localhost / temporary tunnels** — the endpoint is a stable Cloudflare-fronted
   subdomain.

### Pre-submission check

Run the linter before submitting:

```bash
yarn build
yarn check:submission
```

The script fetches `https://mcp.quranpedia.net/health`, lists all tools, and
verifies every description length, forbidden word, and annotation.

### Submit

1. Open the ChatGPT developer submission form.
2. Provide the public URL: `https://mcp.quranpedia.net/`.
3. Upload the `server.json` manifest from this repo.
4. Approve the listed tools.

---

## Cursor

Cursor reads MCP servers from `~/.cursor/mcp.json` (or `.cursor/mcp.json` in
the project).

```json
{
  "mcpServers": {
    "quran": {
      "url": "https://mcp.quranpedia.net/"
    }
  }
}
```

Stdio also works:

```json
{
  "mcpServers": {
    "quran": {
      "command": "npx",
      "args": ["-y", "quranpedia-mcp"]
    }
  }
}
```

---

## VS Code

VS Code (with GitHub Copilot Chat) reads MCP servers from `.vscode/mcp.json` in
the workspace, or from `settings.json` for user-wide.

```json
{
  "servers": {
    "quran": {
      "type": "http",
      "url": "https://mcp.quranpedia.net/"
    }
  }
}
```

For a stdio setup, omit `type` and `url` and supply `command` + `args`:

```json
{
  "servers": {
    "quran": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "quranpedia-mcp"]
    }
  }
}
```

---

## Other MCP-compatible clients

The server follows the standard MCP wire protocol (`2024-11-05`) over either
stdio or Streamable HTTP. Any client that supports one of those transports
will work.

| Client                             | Transport    | Config                                                                  |
| ---------------------------------- | ------------ | ----------------------------------------------------------------------- |
| **Cline** (VS Code)                | stdio        | `command: "npx"`, `args: ["-y", "quranpedia-mcp"]`                      |
| **Continue** (VS Code / JetBrains) | stdio        | same as Cline                                                           |
| **Roo Code**                       | stdio        | same as Cline                                                           |
| **Zed**                            | stdio        | `npx -y quranpedia-mcp`                                                 |
| **Windsurf**                       | HTTP         | `url: "https://mcp.quranpedia.net/"`                                    |
| **MCP Inspector**                  | HTTP / stdio | `npx @modelcontextprotocol/inspector --url https://mcp.quranpedia.net/` |
| **Any MCP client**                 | HTTP         | `url: "https://mcp.quranpedia.net/"`                                    |

---

## Agent Plugins

This repo is also a portable [Agent Plugin](https://agent-plugins.org) (spec v1.0.0): a
compatible client can load it from a directory and discover the MCP servers
declared in `mcp.json` — no client-specific wiring needed.

| File | Purpose |
| --- | --- |
| `plugin.json` | Agent Plugins manifest: `$schema`, `name`, version, author, license, keywords. |
| `mcp.json` | Portable MCP config: a `stdio` server (`npx -y quranpedia-mcp`) and a `streamable-http` server (`https://mcp.quranpedia.net/`). |

The `$schema` identifiers in both files target Agent Plugins **1.0.0**. The
package ships `plugin.json` and `mcp.json` in the npm tarball, so the installed
`node_modules/quranpedia-mcp` is itself a valid plugin root.

---

## Smithery

This server is published on Smithery as
`io.github.quranpedia/quranpedia-mcp`. Smithery's hosted runner uses the
stdio transport; the public URL there is automatically wired to this same
package.

---

## Self-hosting with Docker

If you prefer to host the server yourself (e.g. for a private deployment, or to
expose it on a different domain), the repo includes a hardened multi-stage
`Dockerfile` and `docker-compose.yml`.

```bash
# from the repo root
docker compose up --build -d
# → "Quran MCP HTTP server listening on http://0.0.0.0:4000/"
```

By default the container binds to `127.0.0.1:4000`. To expose it on a public
URL, edit `docker-compose.yml` to bind `0.0.0.0:4000` and set
`MCP_ALLOWED_HOSTS=your.domain.example`. See [architecture.md](architecture.md)
for the full deployment guide.
