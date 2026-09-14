import { getCopticDate, type CopticDate } from '../utils/liturgicalEngine';

export interface SynaxariumDay {
  /** English titles for the day */
  en: string[];
  /** Arabic titles for the day */
  ar: string[];
  /** Full English body text for the day */
  text: string;
  /** Full Arabic body text for the day (when translated) */
  ar_text?: string;
  coptic: CopticDate;
}

/** Cache of loaded months: month number (1-13) -> day -> SynaxariumDay (without coptic) */
const monthCache = new Map<number, Record<string, { en: string[]; ar: string[]; text: string; ar_text?: string }>>();

async function loadMonth(month: number): Promise<Record<string, { en: string[]; ar: string[]; text: string; ar_text?: string }>> {
  const cached = monthCache.get(month);
  if (cached) return cached;
  const mm = String(month).padStart(2, '0');
  const res = await fetch(`/synaxarium/${mm}.json`);
  if (!res.ok) throw new Error(`Synaxarium month ${month} not available`);
  const data = await res.json();
  monthCache.set(month, data);
  return data;
}

/** Load the full Synaxarium entry for a specific Coptic date. */
export async function getSynaxariumDay(cd: CopticDate): Promise<SynaxariumDay> {
  const month = await loadMonth(cd.month);
  const entry = month[String(cd.day)];
  if (!entry) throw new Error(`No Synaxarium entry for ${cd.day}/${cd.month}`);
  return { ...entry, coptic: cd };
}

/** Load the Synaxarium for a Gregorian date (converts to Coptic first). */
export async function getSynaxariumForDate(date: Date): Promise<SynaxariumDay> {
  return getSynaxariumDay(getCopticDate(date));
}

/** Titles only for a Coptic date (same cached month fetch, no extra cost). */
export async function getSynaxariumTitles(
  cd: CopticDate,
  lang: 'en' | 'ar' = 'en'
): Promise<string[]> {
  const month = await loadMonth(cd.month);
  const entry = month[String(cd.day)];
  if (!entry) return [];
  return lang === 'ar' ? entry.ar : entry.en;
}

/** Today's Synaxarium titles in the requested language. */
export async function getTodaySynaxariumTitles(lang: 'en' | 'ar' = 'en'): Promise<string[]> {
  return getSynaxariumTitles(getCopticDate(new Date()), lang);
}
