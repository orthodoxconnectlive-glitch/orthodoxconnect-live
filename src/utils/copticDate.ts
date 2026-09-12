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
 * Anchor: 1 Thout 1740 AM = 11 September 2023 (Feast of Nayrouz 1740).
 * A Coptic year has 366 days when (year % 4 === 0) — the year whose end
 * carries the 6th epagomenal day before the Julian leap day it contains.
 */
const ANCHOR_DATE = new Date(2023, 8, 11); // 11 September 2023 (local)
const ANCHOR_COPTIC_YEAR = 1740;

function isCopticLeapYear(year: number): boolean {
  return year % 4 === 0;
}

/**
 * Converts a standard Gregorian date to the Coptic Calendar date.
 */
export function gregorianToCoptic(gregorianDate: Date = new Date()): CopticDateResult {
  const target = new Date(
    gregorianDate.getFullYear(),
    gregorianDate.getMonth(),
    gregorianDate.getDate()
  );

  let days = Math.round(
    (target.getTime() - ANCHOR_DATE.getTime()) / 86400000
  );
  let year = ANCHOR_COPTIC_YEAR;

  if (days >= 0) {
    let yearLen = isCopticLeapYear(year) ? 366 : 365;
    while (days >= yearLen) {
      days -= yearLen;
      year++;
      yearLen = isCopticLeapYear(year) ? 366 : 365;
    }
  } else {
    while (days < 0) {
      year--;
      days += isCopticLeapYear(year) ? 366 : 365;
    }
  }

  const monthIdx = Math.min(Math.max(Math.floor(days / 30), 0), 12);
  const day = (days % 30) + 1;

  return {
    day,
    month: monthIdx + 1,
    monthNameEn: COPTIC_MONTHS_EN[monthIdx] || 'Thout',
    monthNameAr: COPTIC_MONTHS_AR[monthIdx] || 'توت',
    year,
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
