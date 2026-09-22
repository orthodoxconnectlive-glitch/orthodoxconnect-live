import type { CRBook } from './types';

export const book: CRBook = {
  id: 'synaxarion',
  title: { en: 'Synaxarion', ar: 'السنكسار' },
  description: {
    en: 'Commemorations of the saints for every day of the Coptic year.',
    ar: 'تذكارات القديسين لكل يوم من أيام السنة القبطية.',
  },
  icon: 'Users',
  sections: [
    {
      id: 'synax-tout',
      title: { en: "Month of Tout", ar: "شهر توت" },
      documents: () => import('./synax-docs/tout').then((m) => m.docs),
    },
    {
      id: 'synax-baba',
      title: { en: "Month of Baba", ar: "شهر بابه" },
      documents: () => import('./synax-docs/baba').then((m) => m.docs),
    },
    {
      id: 'synax-hator',
      title: { en: "Month of Hator", ar: "شهر هاتور" },
      documents: () => import('./synax-docs/hator').then((m) => m.docs),
    },
    {
      id: 'synax-koiahk',
      title: { en: "Month of Koiahk", ar: "شهر كيهك" },
      documents: () => import('./synax-docs/koiahk').then((m) => m.docs),
    },
    {
      id: 'synax-toba',
      title: { en: "Month of Toba", ar: "شهر طوبه" },
      documents: () => import('./synax-docs/toba').then((m) => m.docs),
    },
    {
      id: 'synax-amshir',
      title: { en: "Month of Amshir", ar: "شهر أمشير" },
      documents: () => import('./synax-docs/amshir').then((m) => m.docs),
    },
    {
      id: 'synax-baramhat',
      title: { en: "Month of Baramhat", ar: "شهر برمهات" },
      documents: () => import('./synax-docs/baramhat').then((m) => m.docs),
    },
    {
      id: 'synax-baramouda',
      title: { en: "Month of Baramouda", ar: "شهر برموده" },
      documents: () => import('./synax-docs/baramouda').then((m) => m.docs),
    },
    {
      id: 'synax-bashans',
      title: { en: "Month of Bashans", ar: "شهر بشنس" },
      documents: () => import('./synax-docs/bashans').then((m) => m.docs),
    },
    {
      id: 'synax-baouna',
      title: { en: "Month of Baouna", ar: "شهر بؤونه" },
      documents: () => import('./synax-docs/baouna').then((m) => m.docs),
    },
    {
      id: 'synax-abib',
      title: { en: "Month of Abib", ar: "شهر أبيب" },
      documents: () => import('./synax-docs/abib').then((m) => m.docs),
    },
    {
      id: 'synax-misra',
      title: { en: "Month of Misra", ar: "شهر مسرى" },
      documents: () => import('./synax-docs/misra').then((m) => m.docs),
    },
    {
      id: 'synax-nasie',
      title: { en: "Month of Nasie", ar: "شهر نسيء" },
      documents: () => import('./synax-docs/nasie').then((m) => m.docs),
    },
  ],
};
