import type { CRBook } from './types';

export const book: CRBook = {
  id: 'psalmody',
  title: { en: 'Holy Psalmody', ar: 'الإبصلمودية' },
  description: {
    en: 'Midnight, Vesper and Morning praises with psalies and doxologies.',
    ar: 'تسبحة نصف الليل وعشية وباكر مع الإبصاليات والذكصولوجيات.',
  },
  icon: 'Music',
  sections: [
    {
      id: 'psalmody-midnight',
      title: { en: 'Midnight Praises', ar: 'تسبحة نصف الليل' },
      description: { en: 'The Midnight Praise for each day of the week (annual rite).', ar: 'تسبحة نصف الليل لكل يوم من أيام الأسبوع (الطقس السنوي).' },
      documents: () => import('./psalmody-docs/midnight').then((m) => m.docs),
    },
    {
      id: 'psalmody-vesper',
      title: { en: 'Vesper Praises', ar: 'تسبحة عشية' },
      description: { en: 'The Vesper Praise prayed on Saturday evening (annual rite).', ar: 'تسبحة عشية التي تُصلى مساء السبت (الطقس السنوي).' },
      documents: () => import('./psalmody-docs/vesper').then((m) => m.docs),
    },
    {
      id: 'psalmody-morning',
      title: { en: 'Morning Doxology', ar: 'ذكصولوجية باكر' },
      description: { en: 'The doxology prayed at dawn at the end of the Midnight Praises.', ar: 'الذكصولوجية التي تُصلى فجرًا في ختام تسبحة نصف الليل.' },
      documents: () => import('./psalmody-docs/morning').then((m) => m.docs),
    },
  ],
};
