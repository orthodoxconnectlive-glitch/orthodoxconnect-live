import type { CRBook } from './types';

export const book: CRBook = {
  id: 'liturgies',
  title: { en: 'Divine Liturgies', ar: 'القداسات الإلهية' },
  description: {
    en: 'The Liturgy of St. Basil, with Vespers and Matins.',
    ar: 'قداس القديس باسيليوس، مع رفع بخور عشية وباكر.',
  },
  icon: 'Church',
  sections: [
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
