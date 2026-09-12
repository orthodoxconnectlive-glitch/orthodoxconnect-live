import {
  getFastingInfo,
  getUpcomingFeastsFrom,
  getTodayCommemoration,
  getDailyVerse,
} from '../utils/liturgicalEngine';

export type Language = 'en' | 'ar';

export interface LiturgicalDay {
  date: string;
  saintName: string;
  saintTitle: string;
  saintIconUrl?: string;
  scriptureRef: string;
  scriptureText: string;
  fastingInfo: string;
  fastingType: string;
  feastLevel: string;
}

function formatLongDate(d: Date, lang: Language): string {
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Today's liturgical data — computed from the actual calendar date:
 * major feast commemoration (when one falls today), the real fasting rule
 * for today, and a rotating daily scripture verse.
 */
export function getTodayLiturgicalDay(lang: Language = 'en'): LiturgicalDay {
  const now = new Date();
  const comm = getTodayCommemoration(now);
  const fasting = getFastingInfo(now, lang);
  const verse = getDailyVerse(now, lang);
  const dateStr = formatLongDate(now, lang);

  if (comm) {
    return {
      date: dateStr,
      saintName: lang === 'ar' ? comm.nameAr : comm.nameEn,
      saintTitle: lang === 'ar' ? comm.titleAr : comm.titleEn,
      scriptureRef: lang === 'ar' ? comm.refAr : comm.refEn,
      scriptureText: lang === 'ar' ? comm.textAr : comm.textEn,
      fastingInfo: lang === 'ar' ? comm.fastingAr : comm.fastingEn,
      fastingType: comm.fastingType,
      feastLevel: 'major',
    };
  }

  return {
    date: dateStr,
    saintName:
      lang === 'ar' ? 'تذكار القديسين اليومي' : 'Daily Commemoration of the Saints',
    saintTitle:
      lang === 'ar'
        ? 'راجع السنكسار القبطي لتذكارات هذا اليوم'
        : 'See the Coptic Synaxarium for today’s commemorations',
    scriptureRef: verse.ref,
    scriptureText: verse.text,
    fastingInfo: fasting.label,
    fastingType: fasting.type,
    feastLevel: 'daily',
  };
}

/**
 * The next 5 great feasts from today — computed from the real annual
 * cycle (fixed feasts + movable feasts anchored to Orthodox Easter).
 */
export function getUpcomingFeasts(lang: Language = 'en'): LiturgicalDay[] {
  return getUpcomingFeastsFrom(new Date(), 5).map((f) => ({
    date: f.date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    saintName: lang === 'ar' ? f.nameAr : f.nameEn,
    saintTitle: lang === 'ar' ? f.titleAr : f.titleEn,
    scriptureRef: lang === 'ar' ? f.refAr : f.refEn,
    scriptureText: lang === 'ar' ? f.textAr : f.textEn,
    fastingInfo: lang === 'ar' ? f.fastingAr : f.fastingEn,
    fastingType: f.fastingType,
    feastLevel: 'major',
  }));
}

// ---------------------------------------------------------------------------
// Legacy exports (kept for compatibility; computed at load time)
// ---------------------------------------------------------------------------

export const TODAY_LITURGICAL_DAY_EN: LiturgicalDay = getTodayLiturgicalDay('en');
export const TODAY_LITURGICAL_DAY_AR: LiturgicalDay = getTodayLiturgicalDay('ar');
export const TODAY_LITURGICAL_DAY: LiturgicalDay = TODAY_LITURGICAL_DAY_EN;

export const UPCOMING_FEASTS_EN: LiturgicalDay[] = getUpcomingFeasts('en');
export const UPCOMING_FEASTS_AR: LiturgicalDay[] = getUpcomingFeasts('ar');
export const UPCOMING_FEASTS: LiturgicalDay[] = UPCOMING_FEASTS_EN;
