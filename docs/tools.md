# Tools reference

Every tool exposed by `quranpedia-mcp`. All 26 tools are read-only, typed
wrappers over the Quranpedia API (`https://api.quranpedia.net/v1`) — no state is
mutated and no data is written. Every tool is annotated `openWorldHint: true`
because each one contacts an external service.

## Conventions

- Every tool returns `{ content: [{ type: 'text', text: JSON.stringify(payload) }] }` on success.
- Errors return `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }] }`.
- A resource that genuinely does not exist upstream (e.g. `get_ayah_options` for
  a non-existent ayah, `get_book` for a bogus id) returns a successful payload
  with `null` or an empty array — it does **not** return `isError: true`.
  Upstream 400/5xx responses surface their message as `isError: true`.
- Out-of-range inputs (surah > 114, ayah > 286, invalid enum values) fail zod
  validation and return `isError: true`.
- Every response carries a `source` block
  (`{ provider: 'quranpedia', url }`) so clients can attribute the answer to
  the exact upstream endpoint.
- Responses are cached in memory for 30 days by default (and on disk when
  `QP_CACHE_DIR` is set), so repeat calls are instant.

## Tool annotations

All 26 tools declare the same four hints:

| Annotation | Value | Why |
| --- | --- | --- |
| `readOnlyHint` | `true` | No state changes. |
| `destructiveHint` | `false` | Nothing is deleted or altered. |
| `idempotentHint` | `true` | Repeated calls with the same inputs return the same payload. |
| `openWorldHint` | `true` | Every tool contacts the external Quranpedia service, so clients should surface a permission prompt. |

### Terminology

- **Mushaf** — a Quran edition (Hafs, Warsh, …), addressed by `mushaf_id`
  (defaults to `1`, the Hafs mushaf). A mushaf may bundle font files, image
  packages, and a riwaya.
- **Ayah** — one verse, addressed by `surah_id` (1–114) and `ayah_number`
  (1–286).
- **Surah** — one of the 114 chapters of the Quran.
- **Tafsir book** — a scholarly commentary; Quranpedia hosts many (Taysir
  al-Tafsir, Ibn Kathir, al-Sa'di, al-Tabari, and more).
- **Book** — any Quranpedia library work (tafsir, e3rab, or other content),
  identified by `book_id`.
- **Fatwa / note / topic** — Quranpedia encyclopedia content; fatwas pair a
  question with an answer, notes are scholarly remarks linked to ayahs, and
  topics are hierarchical Quranic themes.
- **Translation** — a translation book renders an ayah (or surah) in a
  language (`en`, `fr`, `es`, `ur`, and others).

---

## `compare_ayah_books`

Title: **Compare Ayah Books**

Read one ayah from several books at once and return them side by side.

| Field | Value |
| --- | --- |
| Description | "Read one ayah from several books at once and return them side by side, for comparing how two to five tafsirs treat the same verse. Get candidate book ids from get_ayah_content with service tafsir. Books with no content for the ayah come back listed as unavailable." (262 chars) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah":    "integer 1-114",
  "ayah":     "integer 1-286",
  "book_ids": "array of 2-5 book ids"
}
```

Duplicate ids are collapsed, so the same book asked for twice costs one request
and appears once rather than being compared with itself.

### Output

```json
{
  "source": { "provider": "quranpedia" },
  "ayah": "2:255",
  "requested": [3, 136, 4],
  "books": [
    {
      "book_id": 3,
      "source": "https://api.quranpedia.net/v1/ayah/2/255/book/3",
      "book": { "id": 3, "name": "...", "author": { "...": "..." } },
      "content": [{ "text": "...", "part": "1", "page": 110 }]
    }
  ],
  "unavailable": [{ "book_id": 99999999, "reason": "Book not found" }]
}
```

Each entry carries its own `source`, because a comparison has one url per book
rather than the single url `quranpediaOk()` attaches.

### Partial results are still results

Books are fetched concurrently, and a book that cannot be read is reported in
`unavailable` rather than thrown. One unreachable book out of five should not
cost the other four — a partial comparison is still useful, and the model is
told exactly what is missing and why.

### Finding book ids

`get_ayah_content` with `service: "tafsir"` lists every tafsir book that covers
the ayah — 125 of them for 2:255, including al-Ṭabarī (4), Ibn Kathīr (136) and
al-Saʿdī (3). Discover there, compare here.

### Try it

```bash
curl -X POST https://mcp.quranpedia.net/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"compare_ayah_books","arguments":{"surah":2,"ayah":255,"book_ids":[3,136,4]}}}'
```

---

## `get_ayah_book_content`

Title: **Get Ayah Book Content**

Fetch book content (tafsir, e3rab, etc.) for one ayah from a Quranpedia book.
Defaults to Taysir al-Tafsir when `book_id` is omitted. When the book has no
content for the ayah, returns the tafsir books available for that surah.

| Field | Value |
| --- | --- |
| API route | `GET /ayah/{surah_id}/{ayah_number}/book/{book_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#ayahs) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id":    "integer 1–114 (required)",
  "ayah_number": "integer 1–286 (required)",
  "book_id":     "integer ≥ 1 (optional; default = Taysir al-Tafsir)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/ayah/1/1/book/4" },
  "surah_id": 1,
  "ayah_number": 1,
  "book_id": 4,
  "book": { "id": 4, "name": "…", "short_name": "…", "author": { "id": 1050, "full_name": "…" }, "language": { "code": "ar", "direction": "rtl" } },
  "content": [ { "text": "…", "part": 1, "page": "…", "ayahs": "1" } ]
}
```

When the book has no content for the ayah, the handler falls back to the
surah's tafsir book list:

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/surah/tafsirs/1" },
  "surah_id": 1,
  "ayah_number": 1,
  "book_id": 999,
  "tafsir": null,
  "reason": "…",
  "availableBooks": [ { "id": 1, "name": "تيسير التفسير", "short_name": "القطان", "author": "…" } ]
}
```

---

## `get_ayah_content`

Title: **Get Ayah Content**

Fetch one service's content for one ayah. Pairs with `get_ayah_options`: that
tool lists which services exist for the ayah, this one reads one of them.

| Field | Value |
| --- | --- |
| Description | "Fetch one service's content for one ayah: asbab, e3rab, fatwa, meanings, mutshabeh, nasekh, notes, qiraat, similar, tafsir, topics or translations. Call get_ayah_options first to see which of them exist for that ayah." (215 chars) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah":   "integer 1-114",
  "ayah":    "integer 1-286",
  "service": "asbab | e3rab | fatwa | meanings | mutshabeh | nasekh | notes | qiraat | similar | tafsir | topics | translations"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/ayah/2/255/topics" },
  "ayah": "2:255",
  "service": "topics",
  "content": [
    {
      "id": 1395,
      "name": "\u0623\u064f\u0639\u0637\u064a \u0627\u0644\u0634\u0641\u0627\u0639\u0629",
      "related_ayahs": "2:255,10:3,20:108,21:23",
      "parent": { "id": 165, "name": "..." }
    }
  ]
}
```

`content` is passed through as the API returns it, because the shape varies by
service: the book-backed services (`tafsir`, `e3rab`, `asbab`, `mutshabeh`,
`nasekh`, `translations`) return a flat array of books, `meanings` returns
`{ book_info, words }` entries, `qiraat` groups by word, and `topics`, `notes`,
`fatwa` and `similar` each return their own record shape.

An ayah with nothing for that service returns an empty array — a successful
answer, not an error. A non-existent ayah returns `content: null` with a
`reason`. An unrecognised `service` fails schema validation and returns
`isError: true`.

### How it relates to `get_ayah_book_content`

`get_ayah_content(service: "tafsir")` lists the tafsir **books** available for
the ayah; `get_ayah_book_content` reads the **text** from one of them. Discover
with the first, read with the second.

### Try it

```bash
curl -X POST https://mcp.quranpedia.net/ \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_ayah_content","arguments":{"surah":2,"ayah":255,"service":"topics"}}}'
```

---

## `get_ayah_options`

Title: **Get Ayah Options**

List the related content available for one ayah in the Hafs mushaf: tafsir,
meanings, topics, fatwa, e3rab, notes, asbab, translations.

| Field | Value |
| --- | --- |
| API route | `GET /ayah/{surah_id}/{ayah_number}/options` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#ayahs) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id":    "integer 1–114 (required)",
  "ayah_number": "integer 1–286 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/ayah/1/1/options" },
  "surah_id": 1,
  "ayah_number": 1,
  "options": {
    "id": 1,
    "number": 1,
    "surah": 1,
    "page_number": 1,
    "text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    "marker": null,
    "options": ["tafsir", "meanings", "similar", "topics", "fatwa", "e3rab", "notes", "asbab", "translations"]
  }
}
```

For a non-existent ayah (e.g. `1:8`), `options` is `null` — not an error.

---

## `get_book`

Title: **Get Book**

Detailed information about a single Quranpedia book: author, category, parts,
edition, publisher, and contents URL.

| Field | Value |
| --- | --- |
| API route | `GET /book/{book_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#books) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "book_id": "integer ≥ 1 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/book/4" },
  "book_id": 4,
  "book": { "id": 4, "name": "…", "short_name": "…", "parts": 1, "edition": "…", "nasher": "…", "author": { "id": 1050, "full_name": "…" }, "language": { "code": "ar", "direction": "rtl" } }
}
```

For an unknown `book_id`, `book` is `null` — not an error.

---

## `get_categories`

Title: **Get Categories**

List categories, optionally filtered by content type (books, fatwas, or notes)
to include counts.

| Field | Value |
| --- | --- |
| API route | `GET /categories/{type?}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#categories) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "type": "'books' | 'fatwas' | 'notes' (optional)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/categories/books" },
  "type": "books",
  "categories": [ { "id": 1, "name": "…", "count": 42 } ]
}
```

An invalid `type` value fails zod validation and returns `isError: true`.

---

## `get_category_items`

Title: **Get Category Items**

Get books, fatwas, or notes within a specific category.

| Field | Value |
| --- | --- |
| API route | `GET /category/{category_id}/{type}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#categories) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "category_id": "integer ≥ 1 (required)",
  "type":        "'books' | 'fatwas' | 'notes' (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/category/1/books" },
  "category_id": 1,
  "type": "books",
  "items": [ { "id": 4, "name": "…", "author": "…" } ]
}
```

---

## `get_changes`

Title: **Get Changes**

List what Quranpedia corrected since a date, so a cached copy can be refreshed.

| Field | Value |
| --- | --- |
| Description | "List what Quranpedia corrected since a date, so a cached copy can be refreshed. Each row carries a refetch path for the resource that changed. Dates further back than a year are refused — the dumps are the way to take a fresh full copy." (238 chars) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{ "since": "YYYY-MM-DD" }
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/changes?since=2026-08-09" },
  "since": "2026-08-09",
  "until": "2026-08-10T19:51:53+00:00",
  "note": "Each list is capped at 1000 rows ...",
  "changes": {
    "ayahs":              { "count": 0, "truncated": false, "rows": [] },
    "ayah_book_contents": { "count": 0, "truncated": false, "rows": [] },
    "books":              { "count": 0, "truncated": false, "rows": [] },
    "fatwas":             { "count": 0, "truncated": false, "rows": [] },
    "notes":              { "count": 0, "truncated": false, "rows": [] },
    "topics":             { "count": 0, "truncated": false, "rows": [] }
  }
}
```

Each row carries a `refetch` path — e.g. `/v1/ayah/2/255/book/2003` — so a stale
entry can be re-read without working out which tool to call.

`truncated: true` means the list hit its 1,000-row cap and is incomplete;
re-query with a later `since`.

### This tool bypasses the cache

Every other Quranpedia tool is served through the 30-day TTL cache, which is
right for content: a tafsir does not change between two calls a minute apart.
`get_changes` is the exception, and goes through `quranpediaRequestFresh()`.
Serving it from cache would return a stale answer to the one question asked in
order to detect staleness.

### Errors

A malformed date fails schema validation and returns `isError: true` without a
request. A date more than a year old is refused upstream, with a pointer to the
dumps for taking a fresh full copy.

---

## `get_fatwa`

Title: **Get Fatwa**

A single fatwa with question, answer, mufti, source URL, and category.

| Field | Value |
| --- | --- |
| API route | `GET /fatwa/{fatwa_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#fatwas) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "fatwa_id": "integer ≥ 1 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/fatwa/1" },
  "fatwa_id": 1,
  "fatwa": { "id": 1, "question": "…", "answer": "…", "mufti": "…", "source": "…", "category": "…" }
}
```

---

## `get_mushaf`

Title: **Get Mushaf**

Get a single mushaf with all its surahs and ayahs. Response is large — prefer
`get_mushaf_surah` or `get_mushaf_ayah` for targeted lookups.

| Field | Value |
| --- | --- |
| API route | `GET /mushafs/{id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#mushafs) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "id": "integer ≥ 1 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/mushafs/1" },
  "id": 1,
  "mushaf": { "id": 1, "name": "…", "riwaya": "…", "fonts": [ "…" ], "pages": [ "…" ], "surahs": [ … ] }
}
```

---

## `get_mushaf_ayah`

Title: **Get Mushaf Ayah**

Get a single ayah text from a mushaf by mushaf id, surah id, and ayah number.

| Field | Value |
| --- | --- |
| API route | `GET /mushafs/{mushaf_id}/{surah_id}/{ayah_number}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#ayahs) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "mushaf_id":   "integer ≥ 1 (default: 1)",
  "surah_id":    "integer 1–114 (required)",
  "ayah_number": "integer 1–286 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/mushafs/1/1/1" },
  "mushaf_id": 1,
  "surah_id": 1,
  "ayah_number": 1,
  "ayah": { "surah_id": 1, "ayah_number": 1, "text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "page_number": 1 }
}
```

---

## `get_mushaf_surah`

Title: **Get Mushaf Surah**

Get all ayahs of one surah from a mushaf.

| Field | Value |
| --- | --- |
| API route | `GET /mushafs/{mushaf_id}/{surah_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#ayahs) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "mushaf_id": "integer ≥ 1 (default: 1)",
  "surah_id":  "integer 1–114 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/mushafs/1/1" },
  "mushaf_id": 1,
  "surah_id": 1,
  "ayahs": [ { "surah_id": 1, "ayah_number": 1, "text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "page_number": 1 } ]
}
```

---

## `get_mushafs`

Title: **Get Mushafs**

List all available mushafs (Quran editions) with metadata: name, font files,
image packages, and riwaya.

| Field | Value |
| --- | --- |
| API route | `GET /mushafs` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#mushafs) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

None — the input schema is `{}`.

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/mushafs" },
  "mushafs": [ { "id": 1, "name": "…", "riwaya": "…", "fonts": [ "…" ], "pages": [ "…" ] } ]
}
```

---

## `get_note`

Title: **Get Note**

A scholarly note with its text, linked ayahs, writer, and category.

| Field | Value |
| --- | --- |
| API route | `GET /note/{note_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#notes) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "note_id": "integer ≥ 1 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/note/1" },
  "note_id": 1,
  "note": { "id": 1, "text": "…", "ayahs": [ … ], "writer": "…", "category": "…" }
}
```

---

## `get_reciters`

Title: **Get Reciters**

List all reciters with recitations, audio servers, and available surahs.

| Field | Value |
| --- | --- |
| API route | `GET /reciters` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#reciters) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

None — the input schema is `{}`.

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/reciters" },
  "reciters": [ { "id": 1, "name": "…", "recitations": [ { "id": 1, "name": "…", "server": "…", "surahs": [ … ] } ] } ]
}
```

---

## `get_related_books`

Title: **Get Related Books**

Books related to a given book by author, category, or topic. Returns empty when
none exist.

| Field | Value |
| --- | --- |
| API route | `GET /related-books/{book_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#books) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "book_id": "integer ≥ 1 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/related-books/4" },
  "book_id": 4,
  "related_books": [ { "id": 5, "name": "…", "author": "…" } ]
}
```

---

## `get_surah_books`

Title: **Get Surah Books**

List the books whose content covers a specific surah.

| Field | Value |
| --- | --- |
| API route | `GET /surah/books/{surah_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#surah) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id": "integer 1–114 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/surah/books/1" },
  "surah_id": 1,
  "books": [ { "id": 4, "name": "…", "short_name": "…", "author": "…" } ]
}
```

---

## `get_surah_fatwas`

Title: **Get Surah Fatwas**

List the fatwas related to a specific surah.

| Field | Value |
| --- | --- |
| API route | `GET /surah/fatwas/{surah_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#surah) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id": "integer 1–114 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/surah/fatwas/1" },
  "surah_id": 1,
  "fatwas": [ { "id": 1, "question": "…", "answer": "…", "mufti": "…" } ]
}
```

---

## `get_surah_information`

Title: **Get Surah Information**

Scholarly surah background: introduction, revelation type, descent order,
virtues, topics, purposes.

| Field | Value |
| --- | --- |
| API route | `GET /surah/information/{surah_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#surah) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id": "integer 1–114 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/surah/information/1" },
  "surah_id": 1,
  "information": {
    "introduction": { "title": "…", "value": "…" },
    "surah_type":   { "title": "…", "value": "Meccan" },
    "descent":      { "title": "…", "value": "…" },
    "topics":       { "title": "…", "value": "…" },
    "ayahs_count":  [ { "title": "…", "value": "7" } ]
  }
}
```

Out-of-range surah numbers (outside 1–114) return an `isError` zod validation
error; surah numbers the API cannot resolve return `information: null`.

---

## `get_surah_tafsirs`

Title: **Get Surah Tafsirs**

List the tafsir books available for a specific surah.

| Field | Value |
| --- | --- |
| API route | `GET /surah/tafsirs/{surah_id}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#surah) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id": "integer 1–114 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/surah/tafsirs/1" },
  "surah_id": 1,
  "tafsirs": [ { "id": 1, "name": "تيسير التفسير", "short_name": "القطان", "author": "…" } ]
}
```

---

## `get_topics`

Title: **Get Topics**

List all Quranic topics with their linked ayahs. Topics are hierarchical.

| Field | Value |
| --- | --- |
| API route | `GET /topics` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#topics) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

None — the input schema is `{}`.

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/topics" },
  "topics": [ { "id": 1, "name": "…", "children": [ … ], "ayahs": [ … ] } ]
}
```

---

## `get_translation`

Title: **Get Translation**

Fetch translations of one ayah from the Quranpedia API, for one language or
grouped by all available languages.

| Field | Value |
| --- | --- |
| API route | `GET /translations/{surah_id}/{ayah_number}/{language?}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#translations) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id":    "integer 1–114 (required)",
  "ayah_number": "integer 1–286 (required)",
  "language":    "string 2–16 chars (optional)"
}
```

### Output (one language)

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/translations/1/1/en" },
  "surah_id": 1,
  "ayah_number": 1,
  "language": "en",
  "translations": [
    {
      "book": { "id": 1947, "name": "Saheeh International", "short_name": "Saheeh Int.", "authors": [ { "id": 3, "full_name": "…" } ] },
      "translation-content": "In the name of Allah, the Entirely Merciful, the Especially Merciful."
    }
  ]
}
```

Omit `language` to get every available translation grouped by language code.
Unknown language codes return `translations: []`; a non-existent ayah returns
`translations: null`.

---

## `get_translation_available_languages`

Title: **Get Translation Available Languages**

List the languages that have translations available for a specific ayah.

| Field | Value |
| --- | --- |
| API route | `GET /translations/available-languages/{surah_id}/{ayah_number}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#translations) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "surah_id":    "integer 1–114 (required)",
  "ayah_number": "integer 1–286 (required)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/translations/available-languages/1/1" },
  "surah_id": 1,
  "ayah_number": 1,
  "languages": [ { "code": "en", "name": "English" } ]
}
```

---

## `get_translation_books`

Title: **Get Translation Books**

List available translation books, optionally filtered by language code.

| Field | Value |
| --- | --- |
| API route | `GET /translation-books/{language_code?}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#translations) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "language": "string 2–10 chars (optional)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/translation-books/en" },
  "language": "en",
  "books": [ { "id": 16, "name": "Saheeh International", "short_name": "Saheeh Int.", "authors": [ … ] } ]
}
```

---

## `get_translation_by_book`

Title: **Get Translation By Book**

Fetch translation text for one ayah (or a whole surah when `ayah_number` is
omitted) from a specific translation book.

| Field | Value |
| --- | --- |
| API route | `GET /translation/{book_id}/{surah_id}/{ayah_number?}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#translations) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "book_id":    "integer ≥ 1 (required)",
  "surah_id":   "integer 1–114 (required)",
  "ayah_number": "integer 1–286 (optional)"
}
```

### Output

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/translation/16/1/1" },
  "book_id": 16,
  "surah_id": 1,
  "ayah_number": 1,
  "translation": { "book": { "id": 16, "name": "…" }, "ayah_number": 1, "text": "In the name of Allah, the Entirely Merciful, the Especially Merciful." }
}
```

When `ayah_number` is omitted the result covers the whole surah and
`ayah_number` is `null`.

---

## `search`

Title: **Search Quranpedia**

Search the Quranpedia encyclopedia by keyword across books, fatwas, notes, and
topics, or filtered by type.

| Field | Value |
| --- | --- |
| API route | `GET /search/{query}/{type?}` |
| API docs | [Quranpedia API docs](https://api.quranpedia.net/docs#search) |
| Annotations | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |

### Input

```json
{
  "query": "string (min 1, required)",
  "type":  "'books' | 'fatwas' | 'notes' | 'topics' (optional)"
}
```

### Output (all types)

```json
{
  "source": { "provider": "quranpedia", "url": "https://api.quranpedia.net/v1/search/رحمة" },
  "query": "رحمة",
  "type": null,
  "results": {
    "notes":  { "items": [ "…" ], "currentPage": 1, "perPage": 10, "total": 0, "lastPage": 0 },
    "fatwas": { "items": [ "…" ], "currentPage": 1, "perPage": 10, "total": 0, "lastPage": 0 },
    "topics": { "items": [ "…" ], "currentPage": 1, "perPage": 10, "total": 0, "lastPage": 0 },
    "books":  { "items": [ "…" ], "currentPage": 1, "perPage": 10, "total": 0, "lastPage": 0 }
  }
}
```

### Output (single type)

When `type` is given, `results` is a single paginated page carrying a `type`
field (e.g. `{ items, currentPage, perPage, total, lastPage, type: "books" }`).
