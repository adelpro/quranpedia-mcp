# Quranpedia MCP

[![npm version](https://img.shields.io/npm/v/quranpedia-mcp.svg)](https://www.npmjs.com/package/quranpedia-mcp)
[![license](https://img.shields.io/npm/l/quranpedia-mcp.svg)](LICENSE)

An [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that gives AI
clients fast, accurate, hallucination-free access to the Quran — mushafs, ayahs,
surahs, tafsir, translations, books, fatwas, notes, topics, reciters, and
categories — all backed by the [Quranpedia API](https://api.quranpedia.net/v1) API.

> Explore the Quran through 26 MCP tools — mushafs, ayahs, surahs, tafsir, translations, books, fatwas, notes, topics, reciters, and categories. Hosted at mcp.quranpedia.net.

The server is publicly hosted at **<https://mcp.quranpedia.net>** (Cloudflare-fronted, stable
subdomain of `Quranpedia.net`) and exposes its full tool surface over both
**stdio** (for local AI clients) and **MCP Streamable HTTP** (for remote/hosted
clients).

## Public endpoint

| Resource                     | URL                                 |
| ---------------------------- | ----------------------------------- |
| MCP server (Streamable HTTP) | `https://mcp.quranpedia.net/`       |
| Health check                 | `https://mcp.quranpedia.net/health` |

The HTTP server speaks the standard MCP protocol (`2024-11-05`) over Server-Sent Events.
No API key, no auth — the endpoint is open and CORS-enabled for any client.

## Quick start (HTTP)

The shortest path: use any MCP client and point it at `https://mcp.quranpedia.net/`.
For ad-hoc testing with `curl` + a one-off Node script, see
[integrations.md](integrations.md#other-mcp-compatible-clients).

## Quick start (stdio)

```bash
npx -y quranpedia-mcp
```

This runs the server over stdio. Use it with Claude Desktop, Cursor, or any other
MCP client that supports the stdio transport.

## What can the server do?

Twenty-six tools, all read-only and all backed by the Quranpedia API
(`https://api.quranpedia.net/v1`). Each tool mirrors the API route it calls and
is annotated `openWorldHint: true`:

| Tool                                  | API route                                                        | API docs                                             |
| ------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `get_ayah_book_content`               | `GET /ayah/{surah_id}/{ayah_number}/book/{book_id}`              | [docs](https://api.quranpedia.net/docs#ayahs)        |
| `get_ayah_options`                    | `GET /ayah/{surah_id}/{ayah_number}/options`                     | [docs](https://api.quranpedia.net/docs#ayahs)        |
| `get_book`                            | `GET /book/{book_id}`                                            | [docs](https://api.quranpedia.net/docs#books)        |
| `get_categories`                      | `GET /categories/{type?}`                                        | [docs](https://api.quranpedia.net/docs#categories)   |
| `get_category_items`                  | `GET /category/{category_id}/{type}`                             | [docs](https://api.quranpedia.net/docs#categories)   |
| `get_fatwa`                           | `GET /fatwa/{fatwa_id}`                                          | [docs](https://api.quranpedia.net/docs#fatwas)       |
| `get_mushaf`                          | `GET /mushafs/{id}`                                              | [docs](https://api.quranpedia.net/docs#mushafs)      |
| `get_mushaf_ayah`                     | `GET /mushafs/{mushaf_id}/{surah_id}/{ayah_number}`              | [docs](https://api.quranpedia.net/docs#ayahs)        |
| `get_mushaf_surah`                    | `GET /mushafs/{mushaf_id}/{surah_id}`                            | [docs](https://api.quranpedia.net/docs#ayahs)        |
| `get_mushafs`                         | `GET /mushafs`                                                   | [docs](https://api.quranpedia.net/docs#mushafs)      |
| `get_note`                            | `GET /note/{note_id}`                                            | [docs](https://api.quranpedia.net/docs#notes)        |
| `get_reciters`                        | `GET /reciters`                                                  | [docs](https://api.quranpedia.net/docs#reciters)     |
| `get_related_books`                   | `GET /related-books/{book_id}`                                   | [docs](https://api.quranpedia.net/docs#books)        |
| `get_surah_books`                     | `GET /surah/books/{surah_id}`                                    | [docs](https://api.quranpedia.net/docs#surah)        |
| `get_surah_fatwas`                    | `GET /surah/fatwas/{surah_id}`                                   | [docs](https://api.quranpedia.net/docs#surah)        |
| `get_surah_information`               | `GET /surah/information/{surah_id}`                              | [docs](https://api.quranpedia.net/docs#surah)        |
| `get_surah_tafsirs`                   | `GET /surah/tafsirs/{surah_id}`                                  | [docs](https://api.quranpedia.net/docs#surah)        |
| `get_topics`                          | `GET /topics`                                                    | [docs](https://api.quranpedia.net/docs#topics)       |
| `get_translation`                     | `GET /translations/{surah_id}/{ayah_number}/{language?}`         | [docs](https://api.quranpedia.net/docs#translations) |
| `get_translation_available_languages` | `GET /translations/available-languages/{surah_id}/{ayah_number}` | [docs](https://api.quranpedia.net/docs#translations) |
| `get_translation_books`               | `GET /translation-books/{language_code?}`                        | [docs](https://api.quranpedia.net/docs#translations) |
| `get_translation_by_book`             | `GET /translation/{book_id}/{surah_id}/{ayah_number?}`           | [docs](https://api.quranpedia.net/docs#translations) |
| `search`                              | `GET /search/{query}/{type?}`                                    | [docs](https://api.quranpedia.net/docs#search)       |

Responses are cached for 30 days in memory (and on disk when `QP_CACHE_DIR` is
set), and each response carries a `source` block so the answer can be attributed
to its upstream URL.

Set `QP_CACHE_DIR` to persist the cache to disk (SHA-1-keyed JSON files that
survive restarts):

```bash
# Linux / macOS
QP_CACHE_DIR=/var/cache/quranpedia npx -y quranpedia-mcp
```

```powershell
# Windows (PowerShell)
$env:QP_CACHE_DIR = "C:\quranpedia-cache"
npx -y quranpedia-mcp
```

On Windows `cmd.exe` use `set QP_CACHE_DIR=C:\quranpedia-cache` instead.

Full reference with schemas and examples: [tools.md](tools.md).

## Documentation

- [Tools reference](tools.md) — every tool, its schema, response shape, and a live example.
- [Integrations](integrations.md) — Claude Desktop, Claude Web, ChatGPT, Cursor, VS Code, and others.
- [Architecture](architecture.md) — internals: transports, HTTP hardening, Docker.
- [Development](development.md) — build, test, lint, add a new tool, deploy.
