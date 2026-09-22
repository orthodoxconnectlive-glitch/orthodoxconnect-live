import type { CRLibrary } from './types';

/**
 * Coptic Library collection for the Orthodox Connect book area.
 *
 * Content modules live next to this file (agpeya.ts, liturgies.ts, ...).
 * Each module exports its CRBook; this catalog assembles them in shelf order.
 * Large modules (Bible) lazy-load their documents so the app bundle stays small.
 */
export async function loadCopticReaderLibrary(): Promise<CRLibrary> {
  const [agpeya, liturgies, bible, readings, psalmody, synaxarion, sacraments] =
    await Promise.all([
      import('./agpeya'),
      import('./liturgies'),
      import('./bible'),
      import('./readings'),
      import('./psalmody'),
      import('./synaxarion'),
      import('./sacraments'),
    ]);

  return {
    id: 'coptic-reader',
    title: { en: 'Coptic Library', ar: 'المكتبة القبطية' },
    subtitle: {
      en: 'Prayers, readings and services of the Coptic Orthodox Church',
      ar: 'صلوات وقراءات وخدمات الكنيسة القبطية الأرثوذكسية',
    },
    attribution: {
      en: 'Texts: coptic.io liturgical data (MIT) · Bible: NKJV © Thomas Nelson · tasbeha.org · st-takla.org',
      ar: 'النصوص: بيانات coptic.io الليتورجية (MIT) · الكتاب المقدس: NKJV © Thomas Nelson · tasbeha.org · st-takla.org'
    },
    books: [
      agpeya.book,
      psalmody.book,
      bible.book,
      liturgies.book,
      readings.book,
      synaxarion.book,
      sacraments.book,
    ],
  };
}
