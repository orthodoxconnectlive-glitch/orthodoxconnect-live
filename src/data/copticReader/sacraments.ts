import type { CRBook, CRDocument, CRSection } from './types';

const doc = (id: string, en: string, ar: string): CRDocument => ({
  id,
  title: { en, ar },
  blocks: [],
});

const section = (id: string, en: string, ar: string, docs: CRDocument[]): CRSection => ({
  id,
  title: { en, ar },
  documents: docs,
});

export const book: CRBook = {
  id: 'sacraments',
  title: { en: 'Sacraments & Rites', ar: 'الأسرار والطقوس' },
  description: {
    en: 'Baptism, crowning, unction, funerals, consecrations, Pascha and more.',
    ar: 'المعمودية والإكليل ومسحة المرضى والجنازات والتدشين والبصخة وغيرها.',
  },
  icon: 'Flame',
  sections: [
    section('baptism', 'Holy Baptism', 'المعمودية المقدسة', [
      doc('baptism-full', 'The Rite of Holy Baptism & Chrismation', 'طقس المعمودية والميرون'),
    ]),
    section('crowning', 'Crowning', 'الإكليل', [
      doc('crowning-engagement', 'Engagement', 'الخطوبة'),
      doc('crowning-full', 'The Rite of Crowning (Matrimony)', 'طقس الإكليل'),
    ]),
    section('unction', 'Unction of the Sick', 'مسحة المرضى', [
      doc('unction-full', 'The Seven Prayers of Holy Unction', 'الصلوات السبع لمسحة المرضى'),
    ]),
    section('funeral', 'Funerals', 'الجنازات', [
      doc('funeral-men', 'Funeral of Men', 'جناز الرجال'),
      doc('funeral-women', 'Funeral of Women', 'جناز النساء'),
      doc('funeral-children', 'Funeral of Children', 'جناز الأطفال'),
      doc('funeral-clergy', 'Funeral of Clergy', 'جناز الإكليروس'),
      doc('funeral-memorial', 'Third & Fortieth Day Memorials', 'التذكار الثالث والأربعين'),
    ]),
    section('consecrations', 'Consecrations', 'التدشين', [
      doc('consecration-church', 'Consecration of a Church', 'تدشين الكنيسة'),
      doc('consecration-vessels', 'Consecration of Vessels & Icons', 'تدشين الأواني والأيقونات'),
      doc('consecration-home', 'Blessing of a Home', 'تبارك المنازل'),
      doc('ordination', 'Ordinations', 'الرسامات'),
    ]),
    section('pascha', 'Holy Pascha', 'البصخة المقدسة', [
      doc('pascha-full', 'Prayers of Holy Week', 'صلوات أسبوع الآلام'),
    ]),
    section('lakkan', 'Lakkan', 'اللقان', [
      doc('lakkan-full', 'Liturgy of the Waters', 'طقس اللقان'),
    ]),
    section('prostration', 'Prostration', 'السجدة', [
      doc('prostration-full', 'Prayers of the Kneeling (Eve of Pentecost)', 'صلوات السجدة'),
    ]),
    section('melodies', 'Melodies', 'الألحان', [
      doc('melodies-distribution', 'Distribution Melodies', 'ألحان التوزيع'),
    ]),
    section('veneration', 'Veneration', 'التماجيد', [
      doc('veneration-full', 'Veneration Hymns of the Saints', 'تماجيد القديسين'),
    ]),
  ],
};
