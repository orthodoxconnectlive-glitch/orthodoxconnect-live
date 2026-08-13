import { LiturgicalDay, Language } from '../types';

export const TODAY_LITURGICAL_DAY_EN: LiturgicalDay = {
  date: new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }),
  saintName: 'St. Symeon the New Theologian & Holy Hieromartyr Phocas',
  saintTitle: 'Monk, Hymnographer & Wonderworker',
  saintIconUrl: 'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=200',
  scriptureRef: 'Psalm 23:1 (LXX Ps 22)',
  scriptureText: 'The Lord is my Shepherd; I shall not want. He makes me to lie down in green pastures; He leads me beside the still waters.',
  fastingInfo: 'Dormition Fasting Season (Wine & Oil Allowed)',
  fastingType: 'wine_oil',
  feastLevel: 'major',
};

export const TODAY_LITURGICAL_DAY_AR: LiturgicalDay = {
  date: new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }),
  saintName: 'القديس سيمعون اللاهوتي الحديث والشهيد الفوكاس',
  saintTitle: 'راهب، مرمز، وصانع عجائب',
  saintIconUrl: 'https://images.unsplash.com/photo-1548625361-195fe5772323?auto=format&fit=crop&q=80&w=200',
  scriptureRef: 'مزمور ٢٣: ١ (مزمور ٢٢)',
  scriptureText: 'الرَّبُّ رَاعِيَّ فَلاَ يَعْوُزُنِي شَيْءٌ. فِي مَرَاعٍ خُضْرٍ يُرْبِضُنِي، إِلَى مِيَاهِ الرَّاحَةِ يُورِدُنِي.',
  fastingInfo: 'فترة صوم السيدة العذراء (يُسمح بالزيت والنبيذ)',
  fastingType: 'wine_oil',
  feastLevel: 'major',
};

export function getTodayLiturgicalDay(lang: Language = 'en'): LiturgicalDay {
  return lang === 'ar' ? TODAY_LITURGICAL_DAY_AR : TODAY_LITURGICAL_DAY_EN;
}

export const TODAY_LITURGICAL_DAY = TODAY_LITURGICAL_DAY_EN;

export const UPCOMING_FEASTS_EN: LiturgicalDay[] = [
  {
    date: 'August 6 / August 19 (Old Style)',
    saintName: 'The Holy Transfiguration of Our Lord Jesus Christ',
    saintTitle: 'Great Feast of the Saviour',
    scriptureRef: 'Matthew 17:1–9',
    scriptureText: 'And He was transfigured before them: His face shone like the sun, and His clothes became as white as the light.',
    fastingInfo: 'Fish, Wine & Oil Allowed',
    fastingType: 'fish',
    feastLevel: 'major',
  },
  {
    date: 'August 15 / August 28 (Old Style)',
    saintName: 'The Dormition of the Most Holy Lady Theotokos',
    saintTitle: 'Ever-Virgin Mary',
    scriptureRef: 'Luke 10:38–42, 11:27–28',
    scriptureText: 'Blessed is the womb that bore You, and the breasts which nursed You! But He said, More than that, blessed are those who hear the word of God and keep it!',
    fastingInfo: 'Fast Free Day',
    fastingType: 'fast_free',
    feastLevel: 'major',
  },
  {
    date: 'August 29 / September 11 (Old Style)',
    saintName: 'The Beheading of the Holy Prophet, Forerunner, and Baptist John',
    saintTitle: 'Great Fasting Feast',
    scriptureRef: 'Mark 6:14–30',
    scriptureText: 'The righteous shall flourish like a palm tree; he shall grow like a cedar in Lebanon.',
    fastingInfo: 'Strict Fast Day (No Wine or Oil)',
    fastingType: 'strict',
    feastLevel: 'major',
  },
  {
    date: 'September 8 / September 21 (Old Style)',
    saintName: 'The Nativity of Our Most Holy Lady Theotokos',
    saintTitle: 'First Feast of the Church Year',
    scriptureRef: 'Philippians 2:5–11',
    scriptureText: 'Let this mind be in you which was also in Christ Jesus.',
    fastingInfo: 'Fish, Wine & Oil Allowed',
    fastingType: 'fish',
    feastLevel: 'major',
  },
  {
    date: 'September 14 / September 27 (Old Style)',
    saintName: 'The Universal Exaltation of the Precious and Life-Giving Cross',
    saintTitle: 'Great Feast',
    scriptureRef: '1 Corinthians 1:18–24',
    scriptureText: 'For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.',
    fastingInfo: 'Strict Fast Day',
    fastingType: 'strict',
    feastLevel: 'major',
  },
];

export const UPCOMING_FEASTS_AR: LiturgicalDay[] = [
  {
    date: '٦ أغسطس / ١٩ أغسطس (التقويم الشرقي)',
    saintName: 'عيد التجلي الإلهي لربنا يسوع المسيح',
    saintTitle: 'عيد سيدي كبير',
    scriptureRef: 'متى ١٧: ١–٩',
    scriptureText: 'وَتَغَيَّرَتْ صُورَتُهُ قُدَّامَهُمْ، وَأَضَاءَ وَجْهُهُ كَالشَّمْسِ، وَصَارَتْ ثِيَابُهُ بَيْضَاءَ كَالنُّورِ.',
    fastingInfo: 'يُسمح بالسمك والزيت والنبيذ',
    fastingType: 'fish',
    feastLevel: 'major',
  },
  {
    date: '١٥ أغسطس / ٢٨ أغسطس (التقويم الشرقي)',
    saintName: 'عيد رقاد السيدة الكلية القداست والدي الاله مريم',
    saintTitle: 'الدائمة البتولية',
    scriptureRef: 'لوقا ١٠: ٣٨–٤٢، ١١: ٢٧–٢٨',
    scriptureText: 'طُوبَى لِلْبَطْنِ الَّذِي حَمَلَكَ وَالثَّدْيَيْنِ اللَّذَيْنِ رَضِعْتَهُمَا! أَمَّا هُوَ فَقَالَ: بَلْ طُوبَى لِلَّذِينَ يَسْمَعُونَ كَلاَمَ اللهِ وَيَحْفَظُونَهُ.',
    fastingInfo: 'يوم حلّ من الصوم',
    fastingType: 'fast_free',
    feastLevel: 'major',
  },
  {
    date: '٢٩ أغسطس / ١١ سبتمبر (التقويم الشرقي)',
    saintName: 'قطع رأس القديس يوحنا المعمدان السابق',
    saintTitle: 'صوم كنسي انقطاعي',
    scriptureRef: 'مرقس ٦: ١٤–٣٠',
    scriptureText: 'الصِّدِّيقُ كَالنَّخْلِ يَزْهُو، كالأَرْزِ فِي لُبْنَانَ يَنْمُو.',
    fastingInfo: 'صوم شديد (بدون زيت أو نبيذ)',
    fastingType: 'strict',
    feastLevel: 'major',
  },
  {
    date: '٨ سبتمبر / ٢١ سبتمبر (التقويم الشرقي)',
    saintName: 'ميلاد السيدة العذراء والدي الاله',
    saintTitle: 'أول أعياد السنة الكنسية',
    scriptureRef: 'فيليبي ٢: ٥–١١',
    scriptureText: 'فَلْيَكُنْ فِيكُمْ هذَا الْفِكْرُ الَّذِي فِي الْمَسِيحِ يَسُوعَ أَيْضاً.',
    fastingInfo: 'يُسمح بالسمك والزيت والنبيذ',
    fastingType: 'fish',
    feastLevel: 'major',
  },
  {
    date: '١٤ سبتمبر / ٢٧ سبتمبر (التقويم الشرقي)',
    saintName: 'رفع الصليب المقدس المحيي المكرم',
    saintTitle: 'عيد سيدي كبير',
    scriptureRef: '١ كورنثوس ١: ١٨–٢٤',
    scriptureText: 'فَإِنَّ كَلِمَةَ الصَّلِيبِ عِنْدَ الْهَالِكِينَ جَهَالَةٌ، وَأَمَّا عِنْدَنَا نَحْنُ الْمُخَلَّصِينَ فَهِيَ قُوَّةُ اللهِ.',
    fastingInfo: 'صوم شديد انقطاعي',
    fastingType: 'strict',
    feastLevel: 'major',
  },
];

export function getUpcomingFeasts(lang: Language = 'en'): LiturgicalDay[] {
  return lang === 'ar' ? UPCOMING_FEASTS_AR : UPCOMING_FEASTS_EN;
}

export const UPCOMING_FEASTS = UPCOMING_FEASTS_EN;

