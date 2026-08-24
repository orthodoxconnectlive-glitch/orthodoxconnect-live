export interface CopticDateResult {
  day: number;
  month: number;
  monthNameEn: string;
  monthNameAr: string;
  year: number;
}

export const COPTIC_MONTHS_EN = [
  'Thout',
  'Paopi',
  'Hathor',
  'Koiak',
  'Tobi',
  'Meshir',
  'Paremhat',
  'Parmouti',
  'Pashons',
  'Paoni',
  'Epip',
  'Mesori',
  'Nasie',
];

export const COPTIC_MONTHS_AR = [
  'توت',
  'بابه',
  'هاتور',
  'كيهك',
  'طوبة',
  'أمشير',
  'برمهات',
  'برمودة',
  'بشنس',
  'بؤونة',
  'أبيب',
  'مسرى',
  'نسيء',
];

/**
 * Converts a standard Gregorian date to the Coptic Calendar date.
 */
export function gregorianToCoptic(gregorianDate: Date = new Date()): CopticDateResult {
  const gYear = gregorianDate.getFullYear();
  const gMonth = gregorianDate.getMonth(); // 0-indexed
  const gDay = gregorianDate.getDate();

  // Julian day calculation
  const a = Math.floor((14 - (gMonth + 1)) / 12);
  const y = gYear + 4800 - a;
  const m = gMonth + 1 + 12 * a - 3;
  const jd =
    gDay +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  // Coptic Epoch (Julian Day 1824665 = August 29, 284 AD Julian)
  const copticEpoch = 1824665;
  const copticDays = jd - copticEpoch;

  const cYear = Math.floor((4 * copticDays + 3) / 1461);
  const dayOfYear = copticDays - Math.floor((1461 * cYear) / 4);

  const cMonth = Math.floor(dayOfYear / 30); // 0-12
  const cDay = (dayOfYear % 30) + 1;

  const monthIdx = Math.min(Math.max(cMonth, 0), 12);

  return {
    day: cDay,
    month: monthIdx + 1,
    monthNameEn: COPTIC_MONTHS_EN[monthIdx] || 'Thout',
    monthNameAr: COPTIC_MONTHS_AR[monthIdx] || 'توت',
    year: cYear + 1,
  };
}

/**
 * Returns formatted Coptic date string based on chosen language.
 */
export function formatCopticDate(date: Date = new Date(), lang: 'en' | 'ar' = 'en'): string {
  const c = gregorianToCoptic(date);
  if (lang === 'ar') {
    return `${c.day} ${c.monthNameAr} ${c.year} ش`;
  }
  return `${c.day} ${c.monthNameEn} ${c.year} AM`;
}
