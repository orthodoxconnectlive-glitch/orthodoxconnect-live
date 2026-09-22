import type { CRBook } from './types';

const doc = (id: string, en: string, ar: string) => ({
  id,
  title: { en, ar },
  blocks: [],
});

export const book: CRBook = {
  id: 'readings',
  title: { en: 'Katameros — Daily Readings', ar: 'القطمارس' },
  description: {
    en: 'The daily lectionary: Pauline and Catholic epistles, Acts, psalms and Gospels for every day of the liturgical year.',
    ar: 'القراءات اليومية: رسائل بولس والكاثوليكون وأعمال الرسل والمزامير والأناجيل لكل يوم من أيام السنة الطقسية.',
  },
  icon: 'CalendarDays',
  sections: [
    {
      id: 'sundays',
      title: { en: 'Sundays of the Year', ar: 'آحاد السنة' },
      documents: [doc('readings-sundays', 'Sunday Readings', 'قراءات الآحاد')],
    },
    {
      id: 'weekdays',
      title: { en: 'Weekday Readings', ar: 'قراءات أيام الأسبوع' },
      documents: [doc('readings-weekdays', 'Daily Readings', 'القراءات اليومية')],
    },
    {
      id: 'great-fast',
      title: { en: 'The Great Fast', ar: 'الصوم الكبير' },
      documents: [doc('readings-fast', 'Readings of the Great Fast', 'قراءات الصوم الكبير')],
    },
    {
      id: 'feasts',
      title: { en: 'Feasts of the Lord & the Saints', ar: 'أعياد السيد والقديسين' },
      documents: [doc('readings-feasts', 'Feast Readings', 'قراءات الأعياد')],
    },
  ],
};
