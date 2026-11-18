import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCompareAyahBooks } from './compare-ayah-books.js';
import { registerGetAyahBookContent } from './get-ayah-book-content.js';
import { registerGetAyahContent } from './get-ayah-content.js';
import { registerGetAyahOptions } from './get-ayah-options.js';
import { registerGetBook } from './get-book.js';
import { registerGetCategories } from './get-categories.js';
import { registerGetCategoryItems } from './get-category-items.js';
import { registerGetChanges } from './get-changes.js';
import { registerGetFatwa } from './get-fatwa.js';
import { registerGetMushaf } from './get-mushaf.js';
import { registerGetMushafAyah } from './get-mushaf-ayah.js';
import { registerGetMushafSurah } from './get-mushaf-surah.js';
import { registerGetMushafs } from './get-mushafs.js';
import { registerGetNote } from './get-note.js';
import { registerGetReciters } from './get-reciters.js';
import { registerGetRelatedBooks } from './get-related-books.js';
import { registerGetSurahBooks } from './get-surah-books.js';
import { registerGetSurahFatwas } from './get-surah-fatwas.js';
import { registerGetSurahInformation } from './get-surah-information.js';
import { registerGetSurahTafsirs } from './get-surah-tafsirs.js';
import { registerGetTopics } from './get-topics.js';
import { registerGetTranslation } from './get-translation.js';
import { registerGetTranslationAvailableLanguages } from './get-translation-available-languages.js';
import { registerGetTranslationBooks } from './get-translation-books.js';
import { registerGetTranslationByBook } from './get-translation-by-book.js';
import { registerSearch } from './search.js';

/**
 * Registers every MCP tool exposed by this server.
 * Order is alphabetical for stable `tools/list` output.
 */
export function registerTools(server: McpServer): void {
  registerCompareAyahBooks(server);
  registerGetAyahBookContent(server);
  registerGetAyahContent(server);
  registerGetAyahOptions(server);
  registerGetBook(server);
  registerGetCategories(server);
  registerGetCategoryItems(server);
  registerGetChanges(server);
  registerGetFatwa(server);
  registerGetMushaf(server);
  registerGetMushafAyah(server);
  registerGetMushafSurah(server);
  registerGetMushafs(server);
  registerGetNote(server);
  registerGetReciters(server);
  registerGetRelatedBooks(server);
  registerGetSurahBooks(server);
  registerGetSurahFatwas(server);
  registerGetSurahInformation(server);
  registerGetSurahTafsirs(server);
  registerGetTopics(server);
  registerGetTranslation(server);
  registerGetTranslationAvailableLanguages(server);
  registerGetTranslationBooks(server);
  registerGetTranslationByBook(server);
  registerSearch(server);
}
