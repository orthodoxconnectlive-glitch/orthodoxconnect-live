import type { CRBook } from './types';

export const book: CRBook = {
  id: 'agpeya',
  title: { en: 'Agpeya — Book of Hours', ar: 'الأجبية' },
  description: {
    en: 'The seven canonical hours of prayer, plus the Prayer of the Veil.',
    ar: 'السبع صلوات القانونية، بالإضافة إلى صلاة الستار.',
  },
  icon: 'Clock',
  sections: [
    {
      id: 'agpeya-prime',
      title: { en: "Prime", ar: "باكر" },
    description: { en: "6:00 AM", ar: "6:00 AM" },
      documents: () => import('./agpeya-docs/prime').then((m) => m.docs),
    },
    {
      id: 'agpeya-terce',
      title: { en: "Terce", ar: "الساعة الثالثة" },
    description: { en: "9:00 AM", ar: "9:00 AM" },
      documents: () => import('./agpeya-docs/terce').then((m) => m.docs),
    },
    {
      id: 'agpeya-sext',
      title: { en: "Sext", ar: "الساعة السادسة" },
    description: { en: "12:00 PM", ar: "12:00 PM" },
      documents: () => import('./agpeya-docs/sext').then((m) => m.docs),
    },
    {
      id: 'agpeya-none',
      title: { en: "None", ar: "الساعة التاسعة" },
    description: { en: "3:00 PM", ar: "3:00 PM" },
      documents: () => import('./agpeya-docs/none').then((m) => m.docs),
    },
    {
      id: 'agpeya-vespers',
      title: { en: "Vespers", ar: "الغروب" },
    description: { en: "6:00 PM", ar: "6:00 PM" },
      documents: () => import('./agpeya-docs/vespers').then((m) => m.docs),
    },
    {
      id: 'agpeya-compline',
      title: { en: "Compline", ar: "النوم" },
    description: { en: "9:00 PM", ar: "9:00 PM" },
      documents: () => import('./agpeya-docs/compline').then((m) => m.docs),
    },
    {
      id: 'agpeya-midnight',
      title: { en: "Midnight — Three Watches", ar: "صلاة نصف الليل" },
    description: { en: "12:00 AM", ar: "12:00 AM" },
      documents: () => import('./agpeya-docs/midnight').then((m) => m.docs),
    },
    {
      id: 'agpeya-veil',
      title: { en: 'Prayer of the Veil', ar: 'صلاة الستار' },
      description: {
        en: 'The prayer of the veil',
        ar: 'صلاة الستار',
      },
      documents: () => import('./agpeya-docs/veil').then((m) => m.docs),
    },
  ],
};
