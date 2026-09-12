export interface CopticDate {
  day: number;
  monthIndex: number; // 1 - 13
  monthNameAr: string;
  monthNameEn: string;
  year: number;
}

const COPTIC_MONTHS = [
  { ar: "توت", en: "Thout" },
  { ar: "بابه", en: "Paopi" },
  { ar: "هاتور", en: "Hathor" },
  { ar: "كيهك", en: "Kiahk" },
  { ar: "طوبة", en: "Toba" },
  { ar: "أمشير", en: "Meshir" },
  { ar: "برمهات", en: "Paremhat" },
  { ar: "برمودة", en: "Parmouti" },
  { ar: "بشنس", en: "Pashons" },
  { ar: "بؤونة", en: "Paoni" },
  { ar: "أبيب", en: "Epip" },
  { ar: "مسرى", en: "Mesori" },
  { ar: "النسيء", en: "Nasie" }
];

/**
 * Anchor: 1 Thout 1740 AM = 11 September 2023 (Feast of Nayrouz 1740).
 * A Coptic year has 366 days when (year % 4 === 0).
 */
const ANCHOR_DATE = new Date(2023, 8, 11); // 11 September 2023 (local)
const ANCHOR_COPTIC_YEAR = 1740;

function isCopticLeapYear(year: number): boolean {
  return year % 4 === 0;
}

export function gregorianToCoptic(date: Date = new Date()): CopticDate {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  let days = Math.round((target.getTime() - ANCHOR_DATE.getTime()) / 86400000);
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

  const monthIndex = Math.min(Math.max(Math.floor(days / 30) + 1, 1), 13);
  const day = (days % 30) + 1;
  const month = COPTIC_MONTHS[monthIndex - 1];

  return {
    day,
    monthIndex,
    monthNameAr: month.ar,
    monthNameEn: month.en,
    year
  };
}

export function formatCopticDate(date: Date = new Date(), lang: 'ar' | 'en' = 'ar'): string {
  const c = gregorianToCoptic(date);
  if (lang === 'ar') {
    return `${c.day} ${c.monthNameAr} ${c.year} ش`;
  }
  return `${c.day} ${c.monthNameEn} ${c.year} AM`;
}
