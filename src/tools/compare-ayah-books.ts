import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAyahBook, QuranpediaError } from '../quranpedia-client.js';
import { EXTERNAL_READ_ONLY_ANNOTATIONS, handleCaughtError, jsonOk } from './_shared.js';

export function registerCompareAyahBooks(server: McpServer): void {
  server.registerTool(
    'compare_ayah_books',
    {
      title: 'Compare Ayah Books',
      description:
        'Read one ayah from several books at once and return them side by side, for comparing how two to five tafsirs treat the same verse. Get candidate book ids from get_ayah_content with service tafsir. Books with no content for the ayah come back listed as unavailable.',
      inputSchema: z.object({
        surah: z.number().int().min(1).max(114),
        ayah: z.number().int().min(1).max(286),
        book_ids: z.array(z.number().int().min(1)).min(2).max(5),
      }),
      annotations: EXTERNAL_READ_ONLY_ANNOTATIONS,
    },
    async ({ surah, ayah, book_ids }) => {
      // Deduplicate so the same book asked for twice costs one request and
      // appears once, rather than being silently compared with itself.
      const ids = [...new Set(book_ids)];

      try {
        const settled = await Promise.all(
          ids.map(async (bookId) => {
            try {
              const { url, data } = await fetchAyahBook(surah, ayah, bookId);
              return { ok: true as const, bookId, url, data };
            } catch (error) {
              const reason = error instanceof QuranpediaError ? error.message : 'request failed';
              return { ok: false as const, bookId, reason };
            }
          }),
        );

        // One unreachable book should not lose the other four: it is reported
        // rather than thrown, so a partial comparison is still useful.
        const books = settled
          .filter((entry) => entry.ok)
          .map((entry) => ({
            book_id: entry.bookId,
            source: entry.url,
            book: entry.data.book,
            content: entry.data.content,
          }));

        const unavailable = settled
          .filter((entry) => !entry.ok)
          .map((entry) => ({ book_id: entry.bookId, reason: entry.reason }));

        // quranpediaOk() carries a single url; a comparison has one per book,
        // so each entry keeps its own source and the envelope names the provider.
        return jsonOk({
          source: { provider: 'quranpedia' },
          ayah: `${surah}:${ayah}`,
          requested: ids,
          books,
          unavailable,
        });
      } catch (error) {
        return handleCaughtError(error);
      }
    },
  );
}
