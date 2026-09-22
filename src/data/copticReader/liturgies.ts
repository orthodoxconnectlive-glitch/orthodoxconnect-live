import type { CRBook } from './types';

export const book: CRBook = {
  id: 'liturgies',
  title: { en: 'Divine Liturgies', ar: 'القداسات الإلهية' },
  description: {
    en: 'The liturgies of St. Basil, St. Gregory and St. Cyril, with Vespers and Matins.',
    ar: 'قداسات القديس باسيليوس والقديس غريغوريوس والقديس كيرلس، مع رفع بخور عشية وباكر.',
  },
  icon: 'Church',
  sections: [
    {
      id: 'basil',
      title: { en: 'Liturgy of St. Basil', ar: 'القداس الباسيلي' },
      documents: () => import('./liturgy-docs/basil').then((m) => m.docs),
    },
    {
      id: 'gregory',
      title: { en: 'Liturgy of St. Gregory', ar: 'القداس الغريغوري' },
      documents: [{ id: "gregory-full", title: { en: "The Divine Liturgy of St. Gregory", ar: "القداس الإلهي للقديس غريغوريوس" }, blocks: [] }],
    },
    {
      id: 'cyril',
      title: { en: 'Liturgy of St. Cyril', ar: 'القداس الكيرلسي' },
      documents: [{ id: "cyril-full", title: { en: "The Divine Liturgy of St. Cyril", ar: "القداس الإلهي للقديس كيرلس" }, blocks: [] }],
    },
    {
      id: 'incense',
      title: { en: 'Vespers & Matins', ar: 'رفع بخور عشية وباكر' },
      documents: () => import('./liturgy-docs/incense').then((m) => m.docs),
    },
  ],
};
