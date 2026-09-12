/**
 * liturgicalEngine.ts
 * -------------------
 * Date-driven Coptic Orthodox liturgical calculations:
 *  - Orthodox Easter (Julian computus -> Gregorian date)
 *  - Daily fasting rule (Great Lent, Holy Week, Jonah's fast, Nativity fast,
 *    Apostles' fast, St. Mary's fast, Paramoun, Wednesdays/Fridays, feast days)
 *  - Upcoming great feasts (fixed + movable, computed from today's date)
 *  - Today's major commemoration (fixed + movable feasts)
 *  - Rotating daily scripture verse
 *
 * Anchor verified: 1 Thout 1740 AM = 11 September 2023 (Feast of Nayrouz 1740).
 */

export type FastingType = 'strict' | 'normal' | 'fish' | 'fast_free';

export interface FastingResult {
  type: FastingType;
  label: string;
}

export interface FeastInfo {
  nameAr: string;
  nameEn: string;
  titleAr: string;
  titleEn: string;
  refAr: string;
  refEn: string;
  textAr: string;
  textEn: string;
  fastingAr: string;
  fastingEn: string;
  fastingType: FastingType;
}

export interface UpcomingFeast extends FeastInfo {
  /** The actual upcoming calendar date of this feast occurrence. */
  date: Date;
}

// ---------------------------------------------------------------------------
// Date helpers (local time, DST-safe)
// ---------------------------------------------------------------------------

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = stripTime(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inRange(d: Date, start: Date, end: Date): boolean {
  const t = stripTime(d).getTime();
  return t >= stripTime(start).getTime() && t <= stripTime(end).getTime();
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.round((stripTime(d).getTime() - start.getTime()) / 86400000);
}

// ---------------------------------------------------------------------------
// Orthodox Easter — Julian computus (Meeus), converted to Gregorian date
// ---------------------------------------------------------------------------

export function getOrthodoxEasterDate(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  // Julian calendar month/day of Easter
  const julianMonth = Math.floor((d + e + 114) / 31); // 3 = March, 4 = April
  const julianDay = ((d + e + 114) % 31) + 1;
  // Julian -> Gregorian offset (13 days for 1900-2099)
  const offset = Math.floor(year / 100) - Math.floor(year / 400) - 2;
  return addDays(new Date(year, julianMonth - 1, julianDay), offset);
}

// ---------------------------------------------------------------------------
// Fixed feasts of the Coptic year (Gregorian month/day)
// ---------------------------------------------------------------------------

interface FixedFeast extends FeastInfo {
  month: number; // 1-12
  day: number;
}

const FIXED_FEASTS: FixedFeast[] = [
  {
    month: 1, day: 7,
    nameAr: 'عيد الميلاد المجيد', nameEn: 'The Nativity of Our Lord Jesus Christ',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: 'لوقا ٢: ١١', refEn: 'Luke 2:11',
    textAr: 'أَنَّهُ وُلِدَ لَكُمُ الْيَوْمَ فِي مَدِينَةِ دَاوُدَ مُخَلِّصٌ هُوَ الْمَسِيحُ الرَّبُّ.',
    textEn: 'For there is born to you this day in the city of David a Savior, who is Christ the Lord.',
    fastingAr: 'يوم حل — لا صوم', fastingEn: 'Fast free day',
    fastingType: 'fast_free',
  },
  {
    month: 1, day: 19,
    nameAr: 'عيد الغطاس المجيد', nameEn: 'The Holy Theophany',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: 'متى ٣: ١٧', refEn: 'Matthew 3:17',
    textAr: 'هذَا هُوَ ابْني الْحَبِيبُ الَّذِي بِهِ سُرِرْتُ.',
    textEn: 'This is My beloved Son, in whom I am well pleased.',
    fastingAr: 'يوم حل — لا صوم', fastingEn: 'Fast free day',
    fastingType: 'fast_free',
  },
  {
    month: 4, day: 7,
    nameAr: 'عيد البشارة المجيد', nameEn: 'The Annunciation',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: 'لوقا ١: ٣٨', refEn: 'Luke 1:38',
    textAr: 'هُوَذَا أَنَا أَمَةُ الرَّبِّ. لِيَكُنْ لِي كَقَوْلِكَ.',
    textEn: 'Behold the maidservant of the Lord! Let it be to me according to your word.',
    fastingAr: 'يُسمح بالسمك', fastingEn: 'Fish allowed',
    fastingType: 'fish',
  },
  {
    month: 5, day: 1,
    nameAr: 'استشهاد القديس مارجرجس الروماني', nameEn: 'Martyrdom of St. George the Roman',
    titleAr: 'أمير الشهداء', titleEn: 'Prince of Martyrs',
    refAr: 'متى ١٠: ٣٢', refEn: 'Matthew 10:32',
    textAr: 'فَكُلُّ مَنْ يَعْتَرِفُ بِي قُدَّامَ النَّاسِ أَعْتَرِفُ أَنَا أَيْضًا بِهِ قُدَّامَ أَبِي الَّذِي فِي السَّمَاوَاتِ.',
    textEn: 'Whoever confesses Me before men, him I will also confess before My Father who is in heaven.',
    fastingAr: 'لا صوم انقطاعي', fastingEn: 'No strict fast',
    fastingType: 'fast_free',
  },
  {
    month: 5, day: 8,
    nameAr: 'استشهاد القديس مرقس الرسولي', nameEn: 'Martyrdom of St. Mark the Apostle',
    titleAr: 'كاروز الديار المصرية', titleEn: 'Evangelist of Egypt',
    refAr: 'مرقس ١٦: ١٥', refEn: 'Mark 16:15',
    textAr: 'اذْهَبُوا إِلَى الْعَالَمِ أَجْمَعَ وَاكْرِزُوا بِالإِنْجِيلِ لِلْخَلِيقَةِ كُلِّهَا.',
    textEn: 'Go into all the world and preach the gospel to every creature.',
    fastingAr: 'لا صوم انقطاعي', fastingEn: 'No strict fast',
    fastingType: 'fast_free',
  },
  {
    month: 6, day: 1,
    nameAr: 'دخول السيد المسيح أرض مصر', nameEn: 'Entry of Our Lord into Egypt',
    titleAr: 'عيد سيدي', titleEn: 'Feast of the Lord',
    refAr: 'إشعياء ١٩: ٢٥', refEn: 'Isaiah 19:25',
    textAr: 'مُبَارَكٌ شَعْبِي مِصْرُ.',
    textEn: 'Blessed is Egypt My people.',
    fastingAr: 'يُسمح بالسمك', fastingEn: 'Fish allowed',
    fastingType: 'fish',
  },
  {
    month: 7, day: 12,
    nameAr: 'عيد الرسل الأطهار', nameEn: 'Feast of the Holy Apostles',
    titleAr: 'نهاية صوم الرسل', titleEn: 'End of the Apostles’ Fast',
    refAr: 'متى ٢٨: ١٩', refEn: 'Matthew 28:19',
    textAr: 'فَاذْهَبُوا وَتَلْمِذُوا جَمِيعَ الأُمَمِ.',
    textEn: 'Go therefore and make disciples of all the nations.',
    fastingAr: 'يوم حل — لا صوم', fastingEn: 'Fast free day',
    fastingType: 'fast_free',
  },
  {
    month: 8, day: 19,
    nameAr: 'عيد التجلي المجيد', nameEn: 'The Holy Transfiguration',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: 'متى ١٧: ٥', refEn: 'Matthew 17:5',
    textAr: 'هذَا هُوَ ابْني الْحَبِيبُ الَّذِي بِهِ سُرِرْتُ. لَهُ اسْمَعُوا.',
    textEn: 'This is My beloved Son, in whom I am well pleased. Hear Him!',
    fastingAr: 'يُسمح بالسمك', fastingEn: 'Fish allowed',
    fastingType: 'fish',
  },
  {
    month: 8, day: 22,
    nameAr: 'نياحة السيدة العذراء مريم', nameEn: 'Dormition of the Theotokos',
    titleAr: 'عيد سيدي صغير', titleEn: 'Lesser Feast of the Lord',
    refAr: 'لوقا ١: ٤٨', refEn: 'Luke 1:48',
    textAr: 'لأَنَّهُ نَظَرَ إِلَى اتِّضَاعِ أَمَتِهِ. فَهُوَذَا مُنْذُ الآنَ جَمِيعُ الأَجْيَالِ تُطَوِّبُنِي.',
    textEn: 'For He has regarded the lowly state of His maidservant; for behold, henceforth all generations will call me blessed.',
    fastingAr: 'يوم حل — لا صوم', fastingEn: 'Fast free day',
    fastingType: 'fast_free',
  },
  {
    month: 9, day: 11,
    nameAr: 'عيد النيروز — رأس السنة القبطية', nameEn: 'Feast of Nayrouz — Coptic New Year',
    titleAr: 'تذكار الشهداء', titleEn: 'Commemoration of the Martyrs',
    refAr: 'مزمور ٦٥: ١١', refEn: 'Psalm 65:11',
    textAr: 'تُكَلِّلُ السَّنَةَ بِجُودِكَ.',
    textEn: 'You crown the year with Your goodness.',
    fastingAr: 'يوم حل — لا صوم', fastingEn: 'Fast free day',
    fastingType: 'fast_free',
  },
  {
    month: 9, day: 27,
    nameAr: 'عيد الصليب المجيد', nameEn: 'Exaltation of the Holy Cross',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: '١ كورنثوس ١: ١٨', refEn: '1 Corinthians 1:18',
    textAr: 'فَإِنَّ كَلِمَةَ الصَّلِيبِ عِنْدَ الْهَالِكِينَ جَهَالَةٌ، وَأَمَّا عِنْدَنَا نَحْنُ الْمُخَلَّصِينَ فَهِيَ قُوَّةُ اللهِ.',
    textEn: 'For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.',
    fastingAr: 'صوم انقطاعي', fastingEn: 'Strict fast',
    fastingType: 'strict',
  },
];

interface MovableFeast extends FeastInfo {
  /** Days relative to Orthodox Easter Sunday (e.g. -7 = Palm Sunday). */
  offset: number;
}

const MOVABLE_FEASTS: MovableFeast[] = [
  {
    offset: -7,
    nameAr: 'أحد الشعانين', nameEn: 'Palm Sunday',
    titleAr: 'دخول السيد المسيح أورشليم', titleEn: 'Entry of Our Lord into Jerusalem',
    refAr: 'يوحنا ١٢: ١٣', refEn: 'John 12:13',
    textAr: 'أُوصَنَّا! مُبَارَكٌ الآتِي بِاسْمِ الرَّبِّ.',
    textEn: 'Hosanna! Blessed is He who comes in the name of the Lord!',
    fastingAr: 'يُسمح بالسمك', fastingEn: 'Fish allowed',
    fastingType: 'fish',
  },
  {
    offset: 0,
    nameAr: 'عيد القيامة المجيد', nameEn: 'The Holy Resurrection (Easter)',
    titleAr: 'عيد الأعياد', titleEn: 'Feast of Feasts',
    refAr: 'متى ٢٨: ٦', refEn: 'Matthew 28:6',
    textAr: 'لَيْسَ هُوَ ههُنَا، لأَنَّهُ قَامَ.',
    textEn: 'He is not here; for He is risen.',
    fastingAr: 'يوم حل — لا صوم', fastingEn: 'Fast free day',
    fastingType: 'fast_free',
  },
  {
    offset: 39,
    nameAr: 'عيد الصعود المجيد', nameEn: 'The Holy Ascension',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: 'لوقا ٢٤: ٥١', refEn: 'Luke 24:51',
    textAr: 'وَفِيمَا هُوَ يُبَارِكُهُمُ، انْفَرَدَ عَنْهُمْ وَأُصْعِدَ إِلَى السَّمَاءِ.',
    textEn: 'Now it came to pass, while He blessed them, that He was parted from them and carried up into heaven.',
    fastingAr: 'لا صوم', fastingEn: 'No fasting',
    fastingType: 'fast_free',
  },
  {
    offset: 49,
    nameAr: 'عيد العنصرة', nameEn: 'Holy Pentecost',
    titleAr: 'عيد سيدي كبير', titleEn: 'Great Feast of the Lord',
    refAr: 'أعمال ٢: ٤', refEn: 'Acts 2:4',
    textAr: 'وَامْتَلأَ الْجَمِيعُ مِنَ الرُّوحِ الْقُدُسِ.',
    textEn: 'And they were all filled with the Holy Spirit.',
    fastingAr: 'لا صوم', fastingEn: 'No fasting',
    fastingType: 'fast_free',
  },
];

// ---------------------------------------------------------------------------
// Daily fasting rule
// ---------------------------------------------------------------------------

export function getFastingInfo(date: Date, lang: 'en' | 'ar' = 'en'): FastingResult {
  const d = stripTime(date);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = d.getDay(); // 0 = Sunday, 3 = Wednesday, 5 = Friday
  const isWedOrFri = dow === 3 || dow === 5;

  const pick = (type: FastingType, ar: string, en: string): FastingResult => ({
    type,
    label: lang === 'ar' ? ar : en,
  });

  // All fasting seasons in calendar year Y are governed by Easter of year Y
  // (Great Lent, Holy Week, Jonah's fast, Holy 50 days, Apostles' fast).
  const easter = getOrthodoxEasterDate(y);

  const lentStart = addDays(easter, -55); // Coptic Clean Monday (55-day Great Fast)
  const holyWeekStart = addDays(easter, -7); // Palm Sunday
  const jonahStart = addDays(easter, -69); // Monday, two weeks before Coptic Clean Monday
  const pentecost = addDays(easter, 49);
  const apostlesStart = addDays(pentecost, 1); // Monday after Pentecost

  // 1. Fast-free: Holy Fifty days (Easter .. Pentecost), Nativity, Theophany
  if (inRange(d, easter, pentecost)) {
    return pick('fast_free', 'الخمسين المقدسة — لا صوم', 'Holy Fifty Days — no fasting');
  }
  if ((m === 1 && day === 7) || (m === 1 && day === 19)) {
    return pick('fast_free', 'يوم حل — لا صوم', 'Feast day — no fasting');
  }
  if (m === 8 && day === 22) {
    return pick('fast_free', 'يوم حل — لا صوم', 'Feast day — no fasting');
  }

  // 2. Holy Week (Palm Sunday .. Holy Saturday)
  if (inRange(d, holyWeekStart, addDays(easter, -1))) {
    if (isSameDay(d, holyWeekStart)) {
      return pick('fish', 'أحد الشعانين — يُسمح بالسمك', 'Palm Sunday — fish allowed');
    }
    return pick('strict', 'أسبوع الآلام — صوم انقطاعي', 'Holy Week — strict fast');
  }

  // 3. Great Lent
  if (inRange(d, lentStart, addDays(holyWeekStart, -1))) {
    return pick('strict', 'الصوم الكبير المقدس — صوم انقطاعي', 'Great Holy Lent — strict fast');
  }

  // 4. Jonah's (Nineveh) fast — 3 days
  if (inRange(d, jonahStart, addDays(jonahStart, 2))) {
    return pick('strict', 'صوم يونان (نينوى) — صوم انقطاعي', 'Jonah’s Fast — strict fast');
  }

  // 5. Paramoun of Nativity & Theophany
  if ((m === 1 && day === 6) || (m === 1 && day === 18)) {
    return pick('strict', 'برامون — صوم انقطاعي', 'Paramoun — strict fast');
  }

  // 6. Nativity fast: Nov 25 – Jan 6 (fish allowed, except Wed/Fri)
  const inNativityFast =
    (m === 11 && day >= 25) || m === 12 || (m === 1 && day <= 6);
  if (inNativityFast) {
    if (isWedOrFri) return pick('strict', 'صوم الميلاد — صوم انقطاعي (أربعاء/جمعة)', 'Nativity Fast — strict (Wed/Fri)');
    return pick('fish', 'صوم الميلاد — يُسمح بالسمك', 'Nativity Fast — fish allowed');
  }

  // 7. Apostles' fast: Monday after Pentecost – July 11 of the same year
  //    (fish allowed, except Wed/Fri)
  const apostlesEnd = new Date(y, 6, 11);
  if (d.getTime() >= apostlesStart.getTime() && d.getTime() <= apostlesEnd.getTime()) {
    if (isWedOrFri) return pick('strict', 'صوم الرسل — صوم انقطاعي (أربعاء/جمعة)', 'Apostles’ Fast — strict (Wed/Fri)');
    return pick('fish', 'صوم الرسل — يُسمح بالسمك', 'Apostles’ Fast — fish allowed');
  }

  // 8. Transfiguration (Aug 19) — fish allowed, even inside St. Mary's fast
  if (m === 8 && day === 19) {
    return pick('fish', 'عيد التجلي — يُسمح بالسمك', 'Transfiguration — fish allowed');
  }

  // 9. St. Mary's fast: Aug 7 – Aug 21 (no fish)
  if (m === 8 && day >= 7 && day <= 21) {
    return pick('normal', 'صوم السيدة العذراء', 'St. Mary’s Fast');
  }

  // 10. Wednesdays & Fridays
  if (isWedOrFri) {
    return pick('strict', 'صوم الأربعاء والجمعة', 'Wednesday & Friday fast');
  }

  // 11. No fast
  return pick('fast_free', 'لا يوجد صوم اليوم', 'No fasting today');
}

// ---------------------------------------------------------------------------
// Annual fasting schedule — all major fasts with start/end dates.
// Used for the "مواعيد بدء الأصوام" (Fasting Start Dates) section.
// ---------------------------------------------------------------------------

export interface FastPeriod {
  id: string;
  nameAr: string;
  nameEn: string;
  start: Date;
  end: Date;
  days: number;
  type: FastingType;
  typeAr: string;
  typeEn: string;
  noteAr?: string;
  noteEn?: string;
}

export function getFastingSchedule(year: number): FastPeriod[] {
  const easter = getOrthodoxEasterDate(year);
  const jonahStart = addDays(easter, -69);
  const lentStart = addDays(easter, -55); // Coptic Clean Monday (55-day Great Fast)
  const lentEnd = addDays(easter, -1); // Holy Saturday
  const pentecost = addDays(easter, 49);
  const apostlesStart = addDays(pentecost, 1);
  const apostlesEnd = new Date(year, 6, 11); // July 11

  const nativityStart = new Date(year, 10, 25); // Nov 25
  const nativityEnd = new Date(year + 1, 0, 6); // Jan 6 (next year)

  const daysBetween = (a: Date, b: Date) =>
    Math.round((stripTime(b).getTime() - stripTime(a).getTime()) / 86400000) + 1;

  const fasts: FastPeriod[] = [
    {
      id: 'jonah',
      nameAr: 'صوم يونان (نينوى)',
      nameEn: "Jonah's Fast (Nineveh)",
      start: jonahStart,
      end: addDays(jonahStart, 2),
      days: 3,
      type: 'strict',
      typeAr: 'صوم انقطاعي',
      typeEn: 'Strict fast',
      noteAr: 'ثلاثة أيام — تذكار توبة أهل نينوى',
      noteEn: 'Three days — commemorating the repentance of Nineveh',
    },
    {
      id: 'great-lent',
      nameAr: 'الصوم الكبير المقدس',
      nameEn: 'Great Holy Lent',
      start: lentStart,
      end: lentEnd,
      days: daysBetween(lentStart, lentEnd),
      type: 'strict',
      typeAr: 'صوم انقطاعي (٥٥ يومًا)',
      typeEn: 'Strict fast (55 days)',
      noteAr: 'يشمل أسبوع الآلام — أقدس أصوام الكنيسة',
      noteEn: 'Includes Holy Week — the holiest fast of the Church',
    },
    {
      id: 'nativity',
      nameAr: 'صوم الميلاد',
      nameEn: 'Nativity Fast',
      start: nativityStart,
      end: nativityEnd,
      days: daysBetween(nativityStart, nativityEnd),
      type: 'fish',
      typeAr: 'يُسمح بالسمك (٤٣ يومًا)',
      typeEn: 'Fish allowed (43 days)',
      noteAr: 'استعدادًا لميلاد السيد المسيح — الأربعاء والجمعة انقطاعي',
      noteEn: 'Preparation for the Nativity — Wed/Fri are strict',
    },
    {
      id: 'apostles',
      nameAr: 'صوم الرسل',
      nameEn: "Apostles' Fast",
      start: apostlesStart,
      end: apostlesEnd,
      days: daysBetween(apostlesStart, apostlesEnd),
      type: 'fish',
      typeAr: 'يُسمح بالسمك',
      typeEn: 'Fish allowed',
      noteAr: 'مدته متغيرة حسب عيد القيامة — الأربعاء والجمعة انقطاعي',
      noteEn: "Length varies with Easter's date — Wed/Fri are strict",
    },
    {
      id: 'st-mary',
      nameAr: 'صوم السيدة العذراء',
      nameEn: "St. Mary's Fast",
      start: new Date(year, 7, 7), // Aug 7
      end: new Date(year, 7, 21), // Aug 21
      days: 15,
      type: 'normal',
      typeAr: 'صوم نباتي (١٥ يومًا)',
      typeEn: 'Vegan fast (15 days)',
      noteAr: 'إكرامًا للسيدة العذراء مريم',
      noteEn: 'In honor of the Virgin St. Mary',
    },
    {
      id: 'paramoun-nativity',
      nameAr: 'برامون الميلاد',
      nameEn: 'Nativity Paramoun',
      start: new Date(year + 1, 0, 6), // Jan 6
      end: new Date(year + 1, 0, 6),
      days: 1,
      type: 'strict',
      typeAr: 'صوم انقطاعي',
      typeEn: 'Strict fast',
      noteAr: 'اليوم السابق لعيد الميلاد المجيد',
      noteEn: 'The day before the Nativity feast',
    },
    {
      id: 'paramoun-theophany',
      nameAr: 'برامون الغطاس',
      nameEn: 'Theophany Paramoun',
      start: new Date(year + 1, 0, 18), // Jan 18
      end: new Date(year + 1, 0, 18),
      days: 1,
      type: 'strict',
      typeAr: 'صوم انقطاعي',
      typeEn: 'Strict fast',
      noteAr: 'اليوم السابق لعيد الغطاس المجيد',
      noteEn: 'The day before the Theophany feast',
    },
  ];

  // Sort by start date
  fasts.sort((a, b) => a.start.getTime() - b.start.getTime());
  return fasts;
}

// ---------------------------------------------------------------------------
// Today's major commemoration (null when no major feast falls today)
// ---------------------------------------------------------------------------

export function getTodayCommemoration(date: Date): FeastInfo | null {
  const d = stripTime(date);
  const m = d.getMonth() + 1;
  const day = d.getDate();

  for (const f of FIXED_FEASTS) {
    if (f.month === m && f.day === day) return f;
  }
  const easter = getOrthodoxEasterDate(d.getFullYear());
  for (const f of MOVABLE_FEASTS) {
    if (isSameDay(d, addDays(easter, f.offset))) return f;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Upcoming feasts — next `count` occurrences from the given date
// ---------------------------------------------------------------------------

export function getUpcomingFeastsFrom(
  date: Date,
  count: number = 5
): UpcomingFeast[] {
  const today = stripTime(date);
  const occurrences: UpcomingFeast[] = [];

  const pushFixed = (f: FixedFeast, year: number) => {
    const dt = new Date(year, f.month - 1, f.day);
    if (dt.getTime() >= today.getTime()) occurrences.push({ ...f, date: dt });
  };
  const pushMovable = (f: MovableFeast, year: number) => {
    const dt = addDays(getOrthodoxEasterDate(year), f.offset);
    if (dt.getTime() >= today.getTime()) occurrences.push({ ...f, date: dt });
  };

  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    FIXED_FEASTS.forEach((f) => pushFixed(f, year));
    MOVABLE_FEASTS.forEach((f) => pushMovable(f, year));
  }

  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
  return occurrences.slice(0, count);
}

// ---------------------------------------------------------------------------
// Daily scripture — rotating selection (changes every day)
// ---------------------------------------------------------------------------

interface Verse {
  refAr: string;
  refEn: string;
  textAr: string;
  textEn: string;
}

const DAILY_VERSES: Verse[] = [
  { refEn: 'John 3:16', refAr: 'يوحنا ٣: ١٦', textEn: 'For God so loved the world that He gave His only begotten Son, that whoever believes in Him should not perish but have everlasting life.', textAr: 'لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ، لِكَيْ لاَ يَهْلِكَ كُلُّ مَنْ يُؤْمِنُ بِهِ، بَلْ تَكُونُ لَهُ الْحَيَاةُ الأَبَدِيَّةُ.' },
  { refEn: 'Psalm 23:1', refAr: 'مزمور ٢٣: ١', textEn: 'The Lord is my shepherd; I shall not want.', textAr: 'اَلرَّبُّ رَاعِيَّ فَلاَ يَعْوُزُنِي شَيْءٌ.' },
  { refEn: 'Philippians 4:13', refAr: 'فيلبي ٤: ١٣', textEn: 'I can do all things through Christ who strengthens me.', textAr: 'أَسْتَطِيعُ كُلَّ شَيْءٍ فِي الْمَسِيحِ الَّذِي يُقَوِّينِي.' },
  { refEn: 'Romans 8:28', refAr: 'رومية ٨: ٢٨', textEn: 'And we know that all things work together for good to those who love God.', textAr: 'وَنَحْنُ نَعْلَمُ أَنَّ كُلَّ الأَشْيَاءِ تَعْمَلُ مَعًا لِلْخَيْرِ لِلَّذِينَ يُحِبُّونَ اللهَ.' },
  { refEn: 'Jeremiah 29:11', refAr: 'إرميا ٢٩: ١١', textEn: 'For I know the thoughts that I think toward you, says the Lord, thoughts of peace and not of evil, to give you a future and a hope.', textAr: 'لأَنِّي عَرَفْتُ الأَفْكَارَ الَّتِي أَنَا مُفْتَكِرٌ بِهَا عَنْكُمْ، يَقُولُ الرَّبُّ، أَفْكَارَ سَلاَمٍ لاَ شَرّ، لأُعْطِيَكُمْ آخِرَةً وَرَجَاءً.' },
  { refEn: 'Proverbs 3:5', refAr: 'أمثال ٣: ٥', textEn: 'Trust in the Lord with all your heart, and lean not on your own understanding.', textAr: 'تَوَكَّلْ عَلَى الرَّبِّ بِكُلِّ قَلْبِكَ، وَعَلَى فَهْمِكَ لاَ تَعْتَمِدْ.' },
  { refEn: 'Matthew 11:28', refAr: 'متى ١١: ٢٨', textEn: 'Come to Me, all you who labor and are heavy laden, and I will give you rest.', textAr: 'تَعَالَوْا إِلَيَّ يَا جَمِيعَ الْمُتْعَبِينَ وَالثَّقِيلِي الأَحْمَالِ، وَأَنَا أُرِيحُكُمْ.' },
  { refEn: 'John 14:27', refAr: 'يوحنا ١٤: ٢٧', textEn: 'Peace I leave with you, My peace I give to you; not as the world gives do I give to you.', textAr: 'اَلسَّلاَمَ أَتْرُكُ لَكُمْ. سَلاَمِي أُعْطِيكُمْ. لَيْسَ كَمَا يُعْطِي الْعَالَمُ أُعْطِيكُمْ أَنَا.' },
  { refEn: 'Psalm 46:1', refAr: 'مزمور ٤٦: ١', textEn: 'God is our refuge and strength, a very present help in trouble.', textAr: 'اَللهُ لَنَا مَلْجَأٌ وَقُوَّةٌ. عَوْنًا فِي الضِّيقَاتِ وُجِدَ شَدِيدًا.' },
  { refEn: 'Isaiah 41:10', refAr: 'إشعياء ٤١: ١٠', textEn: 'Fear not, for I am with you; be not dismayed, for I am your God.', textAr: 'لاَ تَخَفْ لأَنِّي مَعَكَ. لاَ تَتَلَفَّتْ لأَنِّي إِلهُكَ.' },
  { refEn: 'Romans 10:9', refAr: 'رومية ١٠: ٩', textEn: 'If you confess with your mouth the Lord Jesus and believe in your heart that God has raised Him from the dead, you will be saved.', textAr: 'لأَنَّكَ إِنِ اعْتَرَفْتَ بِفَمِكَ بِالرَّبِّ يَسُوعَ، وَآمَنْتَ بِقَلْبِكَ أَنَّ اللهَ أَقَامَهُ مِنَ الأَمْوَاتِ، خَلَصْتَ.' },
  { refEn: '1 Corinthians 13:13', refAr: '١ كورنثوس ١٣: ١٣', textEn: 'And now abide faith, hope, love, these three; but the greatest of these is love.', textAr: 'أَمَّا الآنَ فَيَثْبُتُ: الإِيمَانُ وَالرَّجَاءُ وَالْمَحَبَّةُ، هذِهِ الثَّلاَثَةُ وَلكِنَّ أَعْظَمَهُنَّ الْمَحَبَّةُ.' },
  { refEn: 'Matthew 5:16', refAr: 'متى ٥: ١٦', textEn: 'Let your light so shine before men, that they may see your good works and glorify your Father in heaven.', textAr: 'فَلْيُضِئْ نُورُكُمْ هكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.' },
  { refEn: 'Joshua 1:9', refAr: 'يشوع ١: ٩', textEn: 'Be strong and of good courage; do not be afraid, nor be dismayed, for the Lord your God is with you wherever you go.', textAr: 'تَشَدَّدْ وَتَشَجَّعْ! لاَ تَرْهَبْ وَلاَ تَرْتَعِبْ لأَنَّ الرَّبَّ إِلهَكَ مَعَكَ حَيْثُمَا تَذْهَبُ.' },
];

export function getDailyVerse(date: Date, lang: 'en' | 'ar' = 'en'): { ref: string; text: string } {
  const v = DAILY_VERSES[dayOfYear(date) % DAILY_VERSES.length];
  return lang === 'ar' ? { ref: v.refAr, text: v.textAr } : { ref: v.refEn, text: v.textEn };
}
