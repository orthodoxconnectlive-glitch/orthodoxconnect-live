import type { CRBook } from './types';

export const book: CRBook = {
  id: 'liturgies',
  title: { en: 'Divine Liturgies', ar: 'القداسات الإلهية' },
  description: {
    en: 'The Holy Kholagy — St. Basil, St. Gregory & St. Cyril in Coptic, Arabic and English, with Vespers and Matins.',
    ar: 'الخولاجي المقدس — القداس الباسيلي والغريغوري والكيرلسي بالقبطي والعربي والإنجليزي، مع رفع بخور عشية وباكر.',
  },
  icon: 'Church',
  sections: [
    {
      id: 'kholagy',
      title: { en: 'Holy Kholagy — Trilingual Reader', ar: 'الخولاجي المقدس — القارئ ثلاثي اللغات' },
      description: {
        en: 'St. Basil, St. Gregory & St. Cyril — Coptic, Arabic and English together',
        ar: 'القداس الباسيلي والغريغوري والكيرلسي — قبطي وعربي وإنجليزي معًا',
      },
      documents: [],
      custom: 'kholagy-reader',
    },
    {
      id: 'basil',
      title: { en: 'Liturgy of St. Basil', ar: 'القداس الباسيلي' },
      documents: () => import('./liturgy-docs/basil').then((m) => m.docs),
    },
    {
      id: 'incense',
      title: { en: 'Vespers & Matins', ar: 'رفع بخور عشية وباكر' },
      documents: () => import('./liturgy-docs/incense').then((m) => m.docs),
    },
  ],
};
