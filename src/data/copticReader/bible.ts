import type { CRBook } from './types';

export const book: CRBook = {
  id: 'bible',
  title: { en: 'Holy Bible', ar: 'الكتاب المقدس' },
  description: {
    en: 'The Psalms and the four Gospels, verse by verse.',
    ar: 'المزامير والأناجيل الأربعة، آية بآية.',
  },
  icon: 'BookOpen',
  sections: [
    {
      id: 'psalms',
      title: { en: 'Psalms', ar: 'المزامير' },
      description: { en: 'The 150 Psalms of David, verse by verse.', ar: 'المزامير المائة والخمسون، آية بآية.' },
      documents: () => import('./bible-docs/psalms').then((m) => m.docs),
    },
    {
      id: 'gospels',
      title: { en: 'The Four Gospels', ar: 'الأناجيل الأربعة' },
      description: { en: 'Matthew, Mark, Luke and John — chapter by chapter.', ar: 'متى ومرقس ولوقا ويوحنا — إصحاحًا بإصحاح.' },
      documents: () => import('./bible-docs/gospels').then((m) => m.docs),
    },
  ],
};
