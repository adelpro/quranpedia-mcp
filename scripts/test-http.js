import { fork } from 'node:child_process';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

const serverPath = path.join(process.cwd(), 'dist', 'server.js');

const child = fork(serverPath, {
  env: { ...process.env, TRANSPORT: 'http', PORT: '0', HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
});

function waitForPort() {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(
      () => reject(new Error('Timed out waiting for server to start')),
      15_000,
    );

    child.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
      process.stderr.write(chunk);
      const match = buffer.match(/listening on http:\/\/[^:]+:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

const REQUIRED_TOOLS = [
  'compare_ayah_books',
  'get_ayah_book_content',
  'get_ayah_content',
  'get_ayah_options',
  'get_book',
  'get_categories',
  'get_category_items',
  'get_changes',
  'get_fatwa',
  'get_mushaf',
  'get_mushaf_ayah',
  'get_mushaf_surah',
  'get_mushafs',
  'get_note',
  'get_reciters',
  'get_related_books',
  'get_surah_books',
  'get_surah_fatwas',
  'get_surah_information',
  'get_surah_tafsirs',
  'get_topics',
  'get_translation',
  'get_translation_available_languages',
  'get_translation_books',
  'get_translation_by_book',
  'search',
];

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`);
}

function parsePayload(result) {
  if (!result.content || result.content.length === 0) {
    throw new Error('tool returned empty content');
  }
  return JSON.parse(result.content[0].text);
}

async function callTool(client, name, args) {
  return client.request(
    { method: 'tools/call', params: { name, arguments: args } },
    CallToolResultSchema,
  );
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function main() {
  const port = await waitForPort();
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/health`).then((r) => r.json());
  if (health.status !== 'ok') throw new Error('Expected status=ok from /health');

  const client = new Client({ name: 'quranpedia-mcp-http-test', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/`));
  await client.connect(transport);

  if (!transport.sessionId) {
    throw new Error('Expected a session id after connecting (stateful mode)');
  }

  // tools/list — every required tool is registered
  const toolsResult = await client.request({ method: 'tools/list' }, ListToolsResultSchema);
  const toolNames = toolsResult.tools.map((t) => t.name);
  for (const required of REQUIRED_TOOLS) {
    assert(toolNames.includes(required), `expected tool "${required}" to be registered`);
  }

  // Every tool is Quranpedia-backed: all four annotation hints with
  // openWorldHint=true (they contact the external Quranpedia service).
  for (const tool of toolsResult.tools) {
    const ann = tool.annotations ?? {};
    assert(
      ann.readOnlyHint === true &&
        ann.destructiveHint === false &&
        ann.openWorldHint === true &&
        ann.idempotentHint === true,
      `tool "${tool.name}" has unexpected annotations (got ${JSON.stringify(ann)}, openWorldHint expected true)`,
    );
  }

  // get_ayah_book_content — content or not-found fallback are both objects
  const ayahBookContentResult = await callTool(client, 'get_ayah_book_content', {
    surah_id: 1,
    ayah_number: 1,
    book_id: 4,
  });
  const ayahBookContentPayload = parsePayload(ayahBookContentResult);
  assert(
    isObject(ayahBookContentPayload),
    'get_ayah_book_content(1,1,4) should return a payload object',
  );

  // get_ayah_options
  const ayahOptionsResult = await callTool(client, 'get_ayah_options', {
    surah_id: 1,
    ayah_number: 1,
  });
  const ayahOptionsPayload = parsePayload(ayahOptionsResult);
  assert(
    isObject(ayahOptionsPayload.options) && Array.isArray(ayahOptionsPayload.options.options),
    'get_ayah_options(1,1) should return an options object with an options array',
  );

  // get_book
  const bookResult = await callTool(client, 'get_book', { book_id: 4 });
  const bookPayload = parsePayload(bookResult);
  assert(isObject(bookPayload.book), 'get_book(4) should return a book object');

  // get_categories
  const categoriesResult = await callTool(client, 'get_categories', { type: 'books' });
  const categoriesPayload = parsePayload(categoriesResult);
  assert(
    Array.isArray(categoriesPayload.categories) && categoriesPayload.categories.length >= 1,
    'get_categories(books) should return a non-empty categories array',
  );

  // get_category_items
  const categoryItemsResult = await callTool(client, 'get_category_items', {
    category_id: 1,
    type: 'books',
  });
  const categoryItemsPayload = parsePayload(categoryItemsResult);
  assert(
    Array.isArray(categoryItemsPayload.items),
    'get_category_items(1,books) should return an items array',
  );

  // get_fatwa
  const fatwaResult = await callTool(client, 'get_fatwa', { fatwa_id: 1 });
  const fatwaPayload = parsePayload(fatwaResult);
  assert(isObject(fatwaPayload.fatwa), 'get_fatwa(1) should return a fatwa object');

  // get_mushaf
  const mushafResult = await callTool(client, 'get_mushaf', { id: 1 });
  const mushafPayload = parsePayload(mushafResult);
  assert(isObject(mushafPayload.mushaf), 'get_mushaf(1) should return a mushaf object');

  // get_mushaf_ayah
  const mushafAyahResult = await callTool(client, 'get_mushaf_ayah', {
    mushaf_id: 1,
    surah_id: 1,
    ayah_number: 1,
  });
  const mushafAyahPayload = parsePayload(mushafAyahResult);
  assert(
    isObject(mushafAyahPayload.ayah) &&
      typeof mushafAyahPayload.ayah.text === 'string' &&
      mushafAyahPayload.ayah.text.length > 0,
    'get_mushaf_ayah(1,1,1) should return an ayah with non-empty text',
  );

  // get_mushaf_surah
  const mushafSurahResult = await callTool(client, 'get_mushaf_surah', {
    mushaf_id: 1,
    surah_id: 1,
  });
  const mushafSurahPayload = parsePayload(mushafSurahResult);
  assert(
    Array.isArray(mushafSurahPayload.ayahs) && mushafSurahPayload.ayahs.length >= 1,
    'get_mushaf_surah(1,1) should return a non-empty ayahs array',
  );

  // get_mushafs
  const mushafsResult = await callTool(client, 'get_mushafs', {});
  const mushafsPayload = parsePayload(mushafsResult);
  assert(
    Array.isArray(mushafsPayload.mushafs) && mushafsPayload.mushafs.length >= 1,
    'get_mushafs should return a non-empty mushafs array',
  );

  // get_note — /note/{id} returns a list of note records
  const noteResult = await callTool(client, 'get_note', { note_id: 1 });
  const notePayload = parsePayload(noteResult);
  assert(
    notePayload.note !== null && typeof notePayload.note === 'object',
    'get_note(1) should return a non-null note payload',
  );

  // get_reciters
  const recitersResult = await callTool(client, 'get_reciters', {});
  const recitersPayload = parsePayload(recitersResult);
  assert(
    Array.isArray(recitersPayload.reciters) && recitersPayload.reciters.length >= 1,
    'get_reciters should return a non-empty reciters array',
  );

  // get_related_books
  const relatedBooksResult = await callTool(client, 'get_related_books', { book_id: 4 });
  const relatedBooksPayload = parsePayload(relatedBooksResult);
  assert(
    Array.isArray(relatedBooksPayload.related_books),
    'get_related_books(4) should return a related_books array',
  );

  // get_surah_books
  const surahBooksResult = await callTool(client, 'get_surah_books', { surah_id: 1 });
  const surahBooksPayload = parsePayload(surahBooksResult);
  assert(
    Array.isArray(surahBooksPayload.books) && surahBooksPayload.books.length >= 1,
    'get_surah_books(1) should return a non-empty books array',
  );

  // get_surah_fatwas
  const surahFatwasResult = await callTool(client, 'get_surah_fatwas', { surah_id: 1 });
  const surahFatwasPayload = parsePayload(surahFatwasResult);
  assert(
    Array.isArray(surahFatwasPayload.fatwas) && surahFatwasPayload.fatwas.length >= 1,
    'get_surah_fatwas(1) should return a non-empty fatwas array',
  );

  // get_surah_information
  const surahInfoResult = await callTool(client, 'get_surah_information', { surah_id: 1 });
  const surahInfoPayload = parsePayload(surahInfoResult);
  assert(
    isObject(surahInfoPayload.information),
    'get_surah_information(1) should return an information object',
  );

  // get_surah_tafsirs
  const surahTafsirsResult = await callTool(client, 'get_surah_tafsirs', { surah_id: 1 });
  const surahTafsirsPayload = parsePayload(surahTafsirsResult);
  assert(
    Array.isArray(surahTafsirsPayload.tafsirs) && surahTafsirsPayload.tafsirs.length >= 1,
    'get_surah_tafsirs(1) should return a non-empty tafsirs array',
  );

  // get_topics
  const topicsResult = await callTool(client, 'get_topics', {});
  const topicsPayload = parsePayload(topicsResult);
  assert(
    Array.isArray(topicsPayload.topics) && topicsPayload.topics.length >= 1,
    'get_topics should return a non-empty topics array',
  );

  // get_translation
  const translationResult = await callTool(client, 'get_translation', {
    surah_id: 1,
    ayah_number: 1,
    language: 'en',
  });
  const translationPayload = parsePayload(translationResult);
  assert(
    Array.isArray(translationPayload.translations) && translationPayload.translations.length >= 1,
    'get_translation(1,1,en) should return translations',
  );

  // get_translation_available_languages
  const availableLanguagesResult = await callTool(client, 'get_translation_available_languages', {
    surah_id: 1,
    ayah_number: 1,
  });
  const availableLanguagesPayload = parsePayload(availableLanguagesResult);
  assert(
    Array.isArray(availableLanguagesPayload.languages) && availableLanguagesPayload.languages.length >= 1,
    'get_translation_available_languages(1,1) should return languages',
  );

  // get_translation_books
  const translationBooksResult = await callTool(client, 'get_translation_books', { language: 'en' });
  const translationBooksPayload = parsePayload(translationBooksResult);
  assert(
    Array.isArray(translationBooksPayload.books),
    'get_translation_books(en) should return a books array',
  );

  // get_translation_by_book
  const translationByBookResult = await callTool(client, 'get_translation_by_book', {
    book_id: 16,
    surah_id: 1,
    ayah_number: 1,
  });
  const translationByBookPayload = parsePayload(translationByBookResult);
  assert(
    isObject(translationByBookPayload.translation),
    'get_translation_by_book(16,1,1) should return a translation object',
  );

  // search
  const searchResult = await callTool(client, 'search', { query: 'رحمة' });
  const searchPayload = parsePayload(searchResult);
  assert(isObject(searchPayload.results), "search('رحمة') should return a results object");

  // Negative: get_ayah_options on a nonexistent ayah (1:8) → options: null
  const missingAyah = await callTool(client, 'get_ayah_options', { surah_id: 1, ayah_number: 8 });
  const missingAyahPayload = parsePayload(missingAyah);
  assert(missingAyahPayload.options === null, 'get_ayah_options(1,8) should return options: null');

  // Negative: get_book with a nonexistent id → book: null
  const missingBook = await callTool(client, 'get_book', { book_id: 99999999 });
  const missingBookPayload = parsePayload(missingBook);
  assert(missingBookPayload.book === null, 'get_book(99999999) should return book: null');

  // Negative: get_categories with an invalid enum → tool error
  const badTypeResult = await callTool(client, 'get_categories', { type: 'bogus' });
  assert(badTypeResult.isError === true, "get_categories('bogus' type) should return isError");

  // Negative: no session id on a non-initialize POST should be rejected.
  const badResponse = await fetch(`${base}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
  });
  if (badResponse.status !== 400) {
    throw new Error(`Expected 400 for missing session id, got ${badResponse.status}`);
  }

  const sessionId = transport.sessionId;
  // compare_ayah_books — several books for one ayah, side by side
  const compared = await callTool(client, 'compare_ayah_books', { surah: 2, ayah: 255, book_ids: [3, 136, 4] });
  const comparedPayload = parsePayload(compared);
  assert(comparedPayload.ayah === '2:255', 'compare_ayah_books should echo the ayah reference');
  assert(
    Array.isArray(comparedPayload.books) && comparedPayload.books.length >= 1,
    'compare_ayah_books(2:255) should return at least one book',
  );
  assert(
    comparedPayload.books.every((b) => typeof b.book_id === 'number' && typeof b.source === 'string'),
    'each compared book should carry its own book_id and source url',
  );
  assert(
    Array.isArray(comparedPayload.unavailable),
    'compare_ayah_books should report unavailable books rather than failing',
  );

  // A book that has nothing for the ayah is reported, not thrown
  const partial = await callTool(client, 'compare_ayah_books', { surah: 2, ayah: 255, book_ids: [3, 99999999] });
  const partialPayload = parsePayload(partial);
  assert(partial.isError !== true, 'compare_ayah_books should survive an unusable book id');
  assert(
    partialPayload.books.length + partialPayload.unavailable.length === 2,
    'every requested book should appear in books or unavailable',
  );

  // Negative: fewer than two books is not a comparison
  const tooFew = await callTool(client, 'compare_ayah_books', { surah: 2, ayah: 255, book_ids: [3] });
  assert(tooFew.isError === true, 'compare_ayah_books with one book should return isError');
  // get_changes — the delta-sync feed, deliberately uncached
  const changes = await callTool(client, 'get_changes', { since: '2026-08-09' });
  const changesPayload = parsePayload(changes);
  assert(typeof changesPayload.since === 'string', 'get_changes should echo the since date');
  assert(typeof changesPayload.until === 'string', 'get_changes should report an until stamp');
  assert(
    changesPayload.changes && typeof changesPayload.changes === 'object',
    'get_changes should return a changes object keyed by resource type',
  );
  assert(
    typeof changesPayload.source?.url === 'string',
    'get_changes should carry a quranpedia source block',
  );

  // Negative: a malformed date fails schema validation before any request
  const badSince = await callTool(client, 'get_changes', { since: 'last tuesday' });
  assert(badSince.isError === true, "get_changes('last tuesday') should return isError");
  // get_ayah_content — a real service returns its payload plus attribution
  const ayahContent = await callTool(client, 'get_ayah_content', { surah: 2, ayah: 255, service: 'topics' });
  const ayahContentPayload = parsePayload(ayahContent);
  assert(ayahContentPayload.ayah === '2:255', 'get_ayah_content should echo the ayah reference');
  assert(ayahContentPayload.service === 'topics', 'get_ayah_content should echo the service');
  assert(
    Array.isArray(ayahContentPayload.content),
    "get_ayah_content(2:255,'topics') should return an array",
  );
  assert(
    typeof ayahContentPayload.source?.url === 'string',
    'get_ayah_content should carry a quranpedia source block',
  );

  // get_ayah_content — a service with nothing for the ayah is still a success
  const emptyContent = await callTool(client, 'get_ayah_content', { surah: 2, ayah: 255, service: 'asbab' });
  assert(emptyContent.isError !== true, 'get_ayah_content with no content should not be an error');

  // Negative: get_ayah_content with an unknown service → tool error
  const badService = await callTool(client, 'get_ayah_content', { surah: 2, ayah: 255, service: 'bogus' });
  assert(badService.isError === true, "get_ayah_content('bogus' service) should return isError");

  await client.close();

  if (sessionId) {
    await fetch(`${base}/`, {
      method: 'DELETE',
      headers: { 'Mcp-Session-Id': sessionId },
    }).catch(() => {});
  }

  let healthAfterClose;
  for (let i = 0; i < 10; i++) {
    healthAfterClose = await fetch(`${base}/health`).then((r) => r.json());
    if (healthAfterClose.sessions === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (healthAfterClose.sessions !== 0) {
    throw new Error(`Expected 0 sessions after close, got ${healthAfterClose.sessions}`);
  }


  console.log('HTTP transport test passed');
}

main()
  .then(() => {
    child.kill('SIGTERM');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    child.kill('SIGTERM');
    process.exit(1);
  });
