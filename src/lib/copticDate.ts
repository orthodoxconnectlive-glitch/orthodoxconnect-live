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

export function gregorianToCoptic(date: Date = new Date()): CopticDate {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();

  const a = Math.floor((14 - m) / 12);
  const y_adj = y + 4800 - a;
  const m_adj = m + 12 * a - 3;

  const jdn = d + Math.floor((153 * m_adj + 2) / 5) + 365 * y_adj +
              Math.floor(y_adj / 4) - Math.floor(y_adj / 100) +
              Math.floor(y_adj / 400) - 32045;

  const copticJdn = jdn - 1824665;
  const copticYear = Math.floor((copticJdn - Math.floor((copticJdn + 365) / 1461)) / 365) + 1;
  
  const yearStartJdn = 1824665 + Math.floor((copticYear - 1) * 365.25);
  const dayOfYear = jdn - yearStartJdn;

  const monthIndex = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;

  const month = COPTIC_MONTHS[Math.min(Math.max(monthIndex - 1, 0), 12)];

  return {
    day,
    monthIndex,
    monthNameAr: month.ar,
    monthNameEn: month.en,
    year: copticYear
  };
}
