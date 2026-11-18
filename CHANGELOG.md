# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `QP_CACHE_MAX_DISK_ENTRIES` (default `5000`): caps the on-disk cache layer.
  Expired files are pruned and, when the count still exceeds the cap, the
  oldest files are evicted (throttled to once per minute), so a long-running
  server's `QP_CACHE_DIR` can no longer grow unboundedly.
- Agent Plugins alignment: `plugin.json` + `mcp.json` (spec v1.0.0) make the
  package a portable [Agent Plugin](https://agent-plugins.org). `mcp.json`
  declares a `stdio` server (`npx -y quranpedia-mcp`) and a `streamable-http`
  server (`https://mcp.quranpedia.net/`); both files ship in the npm tarball.
- `.prettierignore` (`node_modules`, `dist`) so Prettier never formats the
  committed build output.

## [2.3.0]

### Added

- `compare_ayah_books` — read one ayah from two to five books concurrently and
  return them side by side, which is how tafsir is actually read. Books that
  cannot be read are reported in `unavailable` rather than failing the call, so
  one bad id does not cost the rest of the comparison.
## [2.2.0]

### Added

- `get_changes` — read Quranpedia's delta-sync feed (`/v1/changes?since=`) so a
  cached copy can be refreshed instead of going quietly stale. Each row carries
  a `refetch` path for the resource that changed.
- `quranpediaRequestFresh()` in `src/quranpedia-client.ts` — a cache-bypassing
  fetch for endpoints whose value is freshness. `get_changes` uses it; serving
  that endpoint from the 30-day cache would defeat its purpose.
## [2.1.0]

### Added

- `get_ayah_content` — fetch one of the twelve per-ayah Quranpedia services
  (`asbab`, `e3rab`, `fatwa`, `meanings`, `mutshabeh`, `nasekh`, `notes`,
  `qiraat`, `similar`, `tafsir`, `topics`, `translations`) for one ayah.
  `get_ayah_options` already told the model these existed, but only `tafsir`
  (via `get_ayah_book_content`) and `translations` could actually be read.
- `AYAH_SERVICES` / `AyahService` and `fetchAyahService()` in
  `src/quranpedia-client.ts`.

## [2.0.0] - 2026-08-09

### Changed

- Every tool is now backed by the Quranpedia API, named after its route, and
  annotated `openWorldHint: true` (23 tools total).
- Renamed to mirror routes: `get_ayah_content_options` → `get_ayah_options`,
  `get_tafsir` → `get_ayah_book_content`,
  `get_surah_background` → `get_surah_information`,
  `search_quranpedia` → `search`.

### Added

- 18 new route tools: mushaf, surah, translation, library, and index lookups.

## [1.0.0] - 2026-08-06

### Added

- **Five Quranpedia-backed MCP tools** that read from the external
  [Quranpedia API](https://api.quranpedia.net/v1), annotated
  `openWorldHint: true` (all other tools keep `openWorldHint: false`):
  - `get_ayah_content_options` — list the Quranpedia content available for one ayah (tafsir, e3rab, asbab, translations, meanings, and more).
  - `get_tafsir` — exegesis content for one ayah from a tafsir book (default: Taysir al-Tafsir by Ibrahim al-Qattan); falls back to the surah's available tafsir books when the book has no content.
  - `get_translation` — translations of one ayah in one language, or grouped by all available languages.
  - `get_surah_background` — scholarly surah background (introduction, revelation type, descent order, virtues, topics, purposes), distinct from the structural `get_sura_info`.
  - `search_quranpedia` — keyword search across the encyclopedia (books, fatwas, notes, topics).
- `src/quranpedia-client.ts` — typed Quranpedia client with env-tunable config
  (`QP_BASE_URL`, `QP_DEFAULT_TAFSIR_BOOK_ID`, `QP_FETCH_TIMEOUT_MS`,
  `QP_CACHE_TTL_MS`, `QP_CACHE_DIR`, `QP_CACHE_MAX_ENTRIES`), normalized
  `QuranpediaError` (status + url) for 404-vs-failure branching, and typed
  endpoint helpers returning `{ url, data }` for attribution.
- `src/quranpedia-cache.ts` — TTL cache (default 30 days) with an in-memory
  layer and an optional on-disk layer (`QP_CACHE_DIR`), plus in-flight
  de-duplication so concurrent callers share one upstream fetch.
- Every Quranpedia response carries a `source: { provider: 'quranpedia', url }`
  block for attribution. Missing resources (e.g. a non-existent ayah) return
  `null` — not an error.
- `GET /health` now reports `quranpediaCache: { memoryEntries, diskEntries, hits, misses }`.
- `server.json` `remotes` entry and `mcp.json` documenting the public
  Streamable HTTP endpoint `https://mcp.quranpedia.net/`; `.env.example` documents
  the `QP_*` variables.

### Changed

- (package name, `McpServer` name, npm bin `quranpedia-mcp`, `server.json`,
  `smithery.yaml`). Repository moved to
  <https://github.com/quranpedia/quranpedia-mcp>.
- Version bumped to `1.0.0` (check-versions parity across `package.json` and
  `server.json` maintained).
- `scripts/test.js` and `scripts/test-http.js` now assert all 13 tools and the
  `openWorldHint: true` annotation on the five Quranpedia tools, and exercise
  the Quranpedia tools against the live API (happy paths + missing-resource
  nulls + schema validation errors).
- `scripts/check-submission.js` annotation check now expects `openWorldHint:
true` for the Quranpedia tools.
- Docs (`README.md`, `docs/*`) updated for the 13-tool surface, the Quranpedia
  client/cache architecture, and the `QP_*` environment variables.
