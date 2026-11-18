# Quranpedia MCP

[![npm version](https://img.shields.io/npm/v/quranpedia-mcp.svg)](https://www.npmjs.com/package/quranpedia-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue?style=flat&logo=github)](https://github.com/modelcontextprotocol/servers)
[![smithery badge](https://smithery.ai/badge/quranpedia/quranpedia-mcp)](https://smithery.ai/servers/quranpedia/quranpedia-mcp)
[![license](https://img.shields.io/npm/l/quranpedia-mcp.svg)](LICENSE)

An MCP (Model Context Protocol) server that gives AI clients fast, accurate,
hallucination-free access to the Quran — **mushafs, ayahs, surahs, tafsir,
translations, books, fatwas, notes, topics, reciters, and categories** — over
**stdio** and **Streamable HTTP**.

> Explore the Quran through 26 MCP tools — mushafs, ayahs, surahs, tafsir, translations, books, fatwas, notes, topics, reciters, and categories. Hosted at mcp.quranpedia.net.
> Instead of relying on an AI to "hallucinate" or predict Quranic content, this
> tool routes every request to the Quranpedia API
> (https://api.quranpedia.net/v1). The AI handles the natural language; the
> server returns the exact, literal content with each answer attributed to its
> source.

## Public endpoint

The server is publicly hosted at **<https://mcp.quranpedia.net/>**
(Cloudflare-fronted, stable). No API key, no auth — the endpoint is open and
CORS-enabled for any client.

| Resource                     | URL                                 |
| ---------------------------- | ----------------------------------- |
| MCP server (Streamable HTTP) | `https://mcp.quranpedia.net/`       |
| Health check                 | `https://mcp.quranpedia.net/health` |

## Features

- 🔌 **MCP compatible** — Claude Desktop, Claude Web, ChatGPT, Cursor, VS Code, and others.
- 🌐 **Two transports** — stdio for local integrations, Streamable HTTP for remote/hosted.
- 🔍 **Twenty-six tools** — mushafs, ayahs, surahs, tafsir, translations, books, fatwas, notes, topics, reciters, and categories — all backed by the Quranpedia API.
- 📖 **Accurate results** — every answer comes from the Quranpedia API; no LLM in the loop. Each response carries a `source` URL so it can be attributed to its upstream endpoint.
- 🛡️ **Hardened HTTP** — host allow-list, per-IP rate limit, body cap, session reaper, `/health`.
- 🗄️ **Shared TTL cache** — responses cached in memory (and optionally on disk) for 30 days, so repeat calls are instant.

## Install

```bash
# Use the public endpoint
# → point your MCP client at https://mcp.quranpedia.net/

# Or run the server locally (stdio)
npx -y quranpedia-mcp
```

## Documentation

Detailed docs live under [`docs/`](docs/index.md):

- [Tools reference](docs/tools.md) — every tool, its schema, response shape, and examples.
- [Integrations](docs/integrations.md) — Claude Desktop, Claude Web, ChatGPT, Cursor, and others.
- [Architecture](docs/architecture.md) — internals: transports, HTTP hardening.
- [Development](docs/development.md) — build, test, add a new tool, deploy.

## Quick start (HTTP)

The shortest path: use any MCP client and point it at `https://mcp.quranpedia.net/`.
For ad-hoc testing, the [integrations page](docs/integrations.md#other-mcp-compatible-clients)
shows a one-off Node snippet that uses `@modelcontextprotocol/sdk` directly.

## Quick start (Docker)

```bash
docker compose up --build
# → "Quran MCP HTTP server listening on http://0.0.0.0:4000/"
```

## Requirements

- Node.js 20+ (LTS recommended)
- npm, pnpm, or yarn
- Network access to `api.quranpedia.net` — required for **all** 26 tools (there is no bundled dataset).

## License

MIT — see [LICENSE](LICENSE).

## Contact

Email: <contact@quranpedia.net>
