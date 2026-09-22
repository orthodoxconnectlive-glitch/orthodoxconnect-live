import type { CRLibrary } from './types';

/**
 * Coptic Reader collection for the Orthodox Connect book area.
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
    title: { en: 'Coptic Reader', ar: 'القارئ القبطي' },
    subtitle: {
      en: 'Prayers, readings and services of the Coptic Orthodox Church',
      ar: 'صلوات وقراءات وخدمات الكنيسة القبطية الأرثوذكسية',
    },
    attribution: {
      en: 'Prayer texts: coptic.io liturgical data project.'
      ar: 'نصوص الصلوات: مشروع coptic.io للبيانات الليتورجية.'
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
