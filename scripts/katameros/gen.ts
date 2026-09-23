/**
 * Katameros (daily readings) generator.
 *
 * Source: coptic.io (MIT) — packages/data/src/en/readings/{daily,unique}.json
 * Vendored under scripts/katameros/data/ with a source note.
 *
 * Builds:
 *   src/data/copticReader/readings-docs/sets.ts  — 70 unique reading sets as CRBlock[]
 *   src/data/copticReader/readings-docs/days.ts  — 366 day documents + section arrays
 *
 * Psalm/Gospel verses are embedded from our bible-docs (NKJV EN + Arabic Van Dyck).
 * Epistles/Acts have no full text in the library, so they render as references.
 *
 * Run: npx tsx scripts/katameros/gen.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { docs as psalmDocs } from '../../src/data/copticReader/bible-docs/psalms';
import { docs as gospelDocs } from '../../src/data/copticReader/bible-docs/gospels';

const root = join(dirname(fileURLToPath(import.meta.url)), 'data');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'data', 'copticReader', 'readings-docs');

type Text = { en: string; ar: string };
type Verse = { en: string; ar: string };

// ---------------------------------------------------------------- verse index
const psalmVerses: Record<number, Record<number, Verse>> = {};
for (const doc of psalmDocs) {
  const m = doc.id.match(/^bible-psalm-(\d+)$/);
  if (!m) continue;
  const n = Number(m[1]);
  psalmVerses[n] = {};
  for (const b of doc.blocks) {
    if ((b.kind === 'psalm' || b.kind === 'verse') && b.label && b.text) {
      psalmVerses[n][Number(b.label.en)] = { en: b.text.en, ar: b.text.ar };
    }
  }
}
const gospelVerses: Record<string, Record<number, Record<number, Verse>>> = {};
for (const doc of gospelDocs) {
  const m = doc.id.match(/^bible-(matthew|mark|luke|john)-(\d+)$/);
  if (!m) continue;
  const [, book, ch] = m;
  gospelVerses[book] ??= {};
  gospelVerses[book][Number(ch)] = {};
  for (const b of doc.blocks) {
    if ((b.kind === 'verse' || b.kind === 'psalm') && b.label && b.text) {
      gospelVerses[book][Number(ch)][Number(b.label.en)] = { en: b.text.en, ar: b.text.ar };
    }
  }
}

// ---------------------------------------------------------------- references
const AR_BOOK: Record<string, string> = {
  'Psalms': 'مزمور', 'Matthew': 'متى', 'Mark': 'مرقس', 'Luke': 'لوقا', 'John': 'يوحنا',
  'Acts': 'أعمال الرسل', 'Romans': 'رومية',
  '1 Corinthians': 'كورنثوس الأولى', '2 Corinthians': 'كورنثوس الثانية',
  'Galatians': 'غلاطية', 'Ephesians': 'أفسس', 'Philippians': 'فيلبي', 'Colossians': 'كولوسي',
  '1 Timothy': 'تيموثاوس الأولى', '2 Timothy': 'تيموثاوس الثانية', 'Titus': 'تيطس',
  'Hebrews': 'العبرانيين', 'James': 'يعقوب',
  '1 Peter': 'بطرس الأولى', '2 Peter': 'بطرس الثانية',
  '1 John': 'يوحنا الأولى', '2 John': 'يوحنا الثانية', '3 John': 'يوحنا الثالثة',
  'Jude': 'يهوذا',
};
const EMBED_BOOKS: Record<string, 'psalm' | 'gospel'> = {
  'Psalms': 'psalm', 'Matthew': 'gospel', 'Mark': 'gospel', 'Luke': 'gospel', 'John': 'gospel',
};
const GOSPEL_KEY: Record<string, string> = { 'Matthew': 'matthew', 'Mark': 'mark', 'Luke': 'luke', 'John': 'john' };

type ParsedRef = { book: string; c1: number; v1: number | null; c2: number | null; v2: number | null; raw: string };

function normalizeRaw(raw: string): string {
  return raw
    .replace(/Psalms(\d)/g, 'Psalms $1')
    .replace(/\bCorinthian\b/g, 'Corinthians')
    .trim();
}

function splitParts(raw: string): string[] {
  const norm = normalizeRaw(raw);
  const out: string[] = [];
  for (const semi of norm.split(/\s*;\s*/)) {
    // handle the odd "Psalms 73:23-24: Psalms 73:28" shape
    const sub = semi.split(/\s*:\s*(?=(?:[123]\s)?[A-Za-z]+\s+\d)/);
    out.push(...sub.map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

function parseRef(raw: string): ParsedRef | null {
  const m = raw.match(/^((?:[123]\s)?[A-Za-z]+)\s+(\d+)(?::(\d+))?(?:-(\d+)?(?::(\d+))?)?$/);
  if (!m) return null;
  const [, book, c1, v1, dashN, c2v] = m;
  if (dashN !== undefined && c2v !== undefined) {
    return { book, c1: Number(c1), v1: Number(v1), c2: Number(dashN), v2: Number(c2v), raw };
  }
  if (dashN !== undefined && v1 !== undefined) {
    return { book, c1: Number(c1), v1: Number(v1), c2: null, v2: dashN === '' ? null : Number(dashN), raw };
  }
  return { book, c1: Number(c1), v1: v1 !== undefined ? Number(v1) : null, c2: null, v2: null, raw };
}

function arRef(p: ParsedRef): string {
  const b = AR_BOOK[p.book] ?? p.book;
  if (p.v1 == null) return `${b} ${p.c1}`;
  if (p.c2 != null && p.v2 != null) return `${b} ${p.c1}: ${p.v1} - ${p.c2}: ${p.v2}`;
  if (p.v2 != null) return `${b} ${p.c1}: ${p.v1}-${p.v2}`;
  if (p.raw.endsWith('-')) return `${b} ${p.c1}: ${p.v1}-`;
  return `${b} ${p.c1}: ${p.v1}`;
}

const missing: string[] = [];
const unparsed: string[] = [];

function embedVerses(p: ParsedRef): { kind: string; label: Text; text: Text }[] {
  const blocks: { kind: string; label: Text; text: Text }[] = [];
  const push = (kind: string, num: number | string, v: Verse | undefined, refRaw: string) => {
    if (!v) { missing.push(`${p.book} ${refRaw} v${num}`); return; }
    blocks.push({ kind, label: { en: String(num), ar: String(num) }, text: { en: v.en, ar: v.ar } });
  };
  if (p.book === 'Psalms') {
    const ch = psalmVerses[p.c1];
    const v1 = p.v1 ?? 1;
    const v2 = p.v2 ?? (p.v1 == null ? 999 : p.v1);
    for (let v = v1; v <= v2; v++) {
      if (v > 200) break;
      push('psalm', v, ch?.[v], p.raw);
      if (p.v1 != null && p.v2 == null && !p.raw.endsWith('-')) break;
      if (ch && !ch[v + 1] && v >= v2) break;
    }
    return blocks;
  }
  const gk = GOSPEL_KEY[p.book];
  const book = gospelVerses[gk];
  const c1 = p.c1, c2 = p.c2 ?? p.c1;
  for (let c = c1; c <= c2; c++) {
    const ch = book?.[c];
    if (!ch) { missing.push(`${p.book} ${p.raw} ch${c}`); continue; }
    const start = c === c1 ? (p.v1 ?? 1) : 1;
    const end = c === c2 ? (p.v2 ?? (p.v1 != null && p.c2 == null ? p.v1 : 999)) : 999;
    for (let v = start; v <= end && v <= 300; v++) {
      if (!ch[v]) { if (v === start) missing.push(`${p.book} ${p.raw} v${v}`); break; }
      push('verse', v, ch[v], p.raw);
    }
  }
  return blocks;
}

// ---------------------------------------------------------------- readings
type ReadingDef = { key: string; en: string; ar: string };
const SERVICES: { en: string; ar: string; readings: ReadingDef[] }[] = [
  {
    en: 'Vespers', ar: 'العشية',
    readings: [
      { key: 'VPsalm', en: 'Vespers Psalm', ar: 'مزمور العشية' },
      { key: 'VGospel', en: 'Vespers Gospel', ar: 'إنجيل العشية' },
    ],
  },
  {
    en: 'Matins', ar: 'باكر',
    readings: [
      { key: 'MPsalm', en: 'Matins Psalm', ar: 'مزمور باكر' },
      { key: 'MGospel', en: 'Matins Gospel', ar: 'إنجيل باكر' },
    ],
  },
  {
    en: 'Divine Liturgy', ar: 'القداس الإلهي',
    readings: [
      { key: 'Pauline', en: 'Pauline Epistle', ar: 'البولس' },
      { key: 'Catholic', en: 'Catholic Epistle', ar: 'الكاثوليكون' },
      { key: 'Acts', en: 'Acts', ar: 'الإبركسيس' },
      { key: 'LPsalm', en: 'Liturgy Psalm', ar: 'مزمور القداس' },
      { key: 'LGospel', en: 'Liturgy Gospel', ar: 'إنجيل القداس' },
    ],
  },
];

type SetRow = Record<string, string>;
const unique: (SetRow & { id: number; Day: string })[] = JSON.parse(readFileSync(join(root, 'unique.json'), 'utf8'));
const setIds = new Set(unique.map((s) => s.id));

type Block = { kind: string; text?: Text; label?: Text };

function buildSetBlocks(set: SetRow & { id: number; Day: string }): Block[] {
  const blocks: Block[] = [];
  for (const svc of SERVICES) {
    blocks.push({ kind: 'heading', text: { en: svc.en, ar: svc.ar } });
    for (const r of svc.readings) {
      const rawVal = (set[r.key] ?? '').trim();
      if (!rawVal) continue;
      const parts = splitParts(rawVal);
      for (const part of parts) {
        const p = parseRef(part);
        if (!p) { unparsed.push(`${set.id}/${r.key}: ${part}`); continue; }
        if (!AR_BOOK[p.book]) missing.push(`AR-BOOK-MISSING: ${p.book}`);
        if (EMBED_BOOKS[p.book] && p.v1 != null) {
          const verses = embedVerses(p);
          if (verses.length > 0) {
            blocks.push({ kind: 'heading', text: { en: `${r.en} · ${p.raw}`, ar: `${r.ar} · ${arRef(p)}` } });
            blocks.push(...verses);
          } else {
            // Reference not in our Psalter (e.g. numbering variant) — show the reference.
            blocks.push({
              kind: 'reading',
              label: { en: r.en, ar: r.ar },
              text: { en: p.raw, ar: arRef(p) },
            });
          }
        } else {
          blocks.push({
            kind: 'reading',
            label: { en: r.en, ar: r.ar },
            text: { en: p.raw, ar: arRef(p) },
          });
        }
      }
    }
  }
  return blocks;
}

// ---------------------------------------------------------------- calendar
const MONTHS_EN = ['Tout', 'Baba', 'Hator', 'Kiahk', 'Toba', 'Amshir', 'Baramhat', 'Baramouda', 'Bashans', 'Paona', 'Epep', 'Mesra', 'Nasie'];
const MONTHS_AR = ['توت', 'بابه', 'هاتور', 'كيهك', 'طوبة', 'أمشير', 'برمهات', 'برمودة', 'بشنس', 'بؤونة', 'أبيب', 'مسرى', 'النسيء'];
const DAY = 86400000;
// 1 Tout 1742 AM = Thursday, September 11, 2025
const ANCHOR = Date.UTC(2025, 8, 11);
if (new Date(ANCHOR).getUTCDay() !== 4) throw new Error('anchor weekday changed!');
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_GREG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const gdate = (idx: number) => new Date(ANCHOR + idx * DAY);
const gregEn = (idx: number) => {
  const d = gdate(idx);
  return `${MONTHS_GREG_EN[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};
const weekday = (idx: number) => gdate(idx).getUTCDay(); // 0 = Sunday

// Meeus Julian computus → Gregorian date of Orthodox Easter
function orthodoxEaster(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day) + 13 * DAY);
}
const easter2026 = orthodoxEaster(2026);
const easterStr = `${easter2026.getUTCFullYear()}-${String(easter2026.getUTCMonth() + 1).padStart(2, '0')}-${String(easter2026.getUTCDate()).padStart(2, '0')}`;
if (easterStr !== '2026-04-12') throw new Error(`Easter computus wrong: ${easterStr}`);

// ---------------------------------------------------------------- day index
const daily: { month: string; readings: number[] }[] = JSON.parse(readFileSync(join(root, 'daily.json'), 'utf8'));
// coptic day index -> reading set id
const dayToSet: number[] = [];
daily.forEach((m, mi) => {
  if (MONTHS_EN[mi] !== m.month) throw new Error(`month order mismatch: ${m.month}`);
  m.readings.forEach((setId) => {
    if (setId !== 0 && !setIds.has(setId)) throw new Error(`unknown set id ${setId}`);
    dayToSet.push(setId);
  });
});
if (dayToSet.length !== 366) throw new Error(`expected 366 days, got ${dayToSet.length}`);
// coptic (monthIdx, day) -> index
const copticIndex = (monthEn: string, day: number) => {
  const mi = MONTHS_EN.indexOf(monthEn);
  if (mi < 0) throw new Error(`bad month ${monthEn}`);
  return mi * 30 + (day - 1);
};
const gregToIndex = (y: number, mo: number, d: number) => Math.round((Date.UTC(y, mo - 1, d) - ANCHOR) / DAY);

const sundays: number[] = [];
const fastIdx = new Set<number>();
const feastIdx = new Set<number>();
for (let i = 0; i < 366; i++) if (weekday(i) === 0) sundays.push(i);

// Great Fast 2026: 55 days ending the day before Easter (starts Monday)
const easterIdx = gregToIndex(2026, 4, 12);
for (let i = easterIdx - 55; i < easterIdx; i++) {
  if (i < 0 || i >= 366) throw new Error(`fast day out of range: ${i}`);
  fastIdx.add(i);
}
if (weekday(easterIdx - 55) !== 1) throw new Error('Great Fast should start on Monday');

const FEASTS_FIXED: [number, string, string, string][] = [
  [17, 'Tout', 'Feast of the Cross', 'عيد الصليب'],
  [29, 'Kiahk', 'Nativity', 'عيد الميلاد'],
  [6, 'Toba', 'Circumcision of Christ', 'عيد الختان'],
  [11, 'Toba', 'Theophany', 'عيد الغطاس'],
  [13, 'Toba', 'Wedding at Cana', 'عرس قانا الجليل'],
  [8, 'Amshir', 'Entry of Christ into the Temple', 'دخول المسيح إلى الهيكل'],
  [29, 'Baramhat', 'Annunciation', 'عيد البشارة'],
  [10, 'Baramhat', 'Feast of the Cross', 'عيد الصليب'],
  [24, 'Bashans', 'Entry of Christ into Egypt', 'دخول المسيح أرض مصر'],
  [13, 'Mesra', 'Transfiguration', 'عيد التجلي'],
];
const FEASTS_MOVEABLE: [number, string, string][] = [
  [-7, 'Palm Sunday', 'أحد الشعانين'],
  [-3, 'Covenant Thursday', 'خميس العهد'],
  [0, 'Feast of the Resurrection', 'عيد القيامة'],
  [7, 'Thomas Sunday', 'أحد توما'],
  [39, 'Ascension', 'عيد الصعود'],
  [49, 'Pentecost', 'عيد العنصرة'],
];
type Feast = { idx: number; en: string; ar: string };
const feasts: Feast[] = [];
for (const [day, month, en, ar] of FEASTS_FIXED) {
  const idx = copticIndex(month, day);
  feasts.push({ idx, en, ar });
  feastIdx.add(idx);
}
for (const [off, en, ar] of FEASTS_MOVEABLE) {
  const idx = easterIdx + off;
  if (idx < 0 || idx >= 366) throw new Error(`moveable feast out of range: ${en}`);
  feasts.push({ idx, en, ar });
  feastIdx.add(idx);
}
feasts.sort((a, b) => a.idx - b.idx);

// ---------------------------------------------------------------- emit
mkdirSync(outDir, { recursive: true });
const js = (v: unknown) => JSON.stringify(v);

let setsSrc = `import type { CRBlock } from '../types';\n\n`;
setsSrc += `// Generated by scripts/katameros/gen.ts from coptic.io (MIT) readings data.\n`;
setsSrc += `// 70 unique daily reading sets. Psalm/Gospel verses embedded from our Bible text;\n`;
setsSrc += `// epistles/Acts render as references (full text not yet in the library).\n`;
setsSrc += `export const SET_BLOCKS: Record<number, CRBlock[]> = {\n`;
const sorted = [...unique].sort((a, b) => a.id - b.id);
for (const s of sorted) {
  const blocks = buildSetBlocks(s);
  setsSrc += `  ${s.id}: ${js(blocks)},\n`;
}
// Set 0: days with no readings in the source (currently only 2 Amshir).
setsSrc += `  0: ${js([{ kind: 'prose', text: { en: 'The daily readings for this day are not yet available in the library source.', ar: 'قراءات هذا اليوم غير متوفرة بعد في مصدر المكتبة.' } }])},\n`;
setsSrc += `};\n`;
writeFileSync(join(outDir, 'sets.ts'), setsSrc);

const dayKey = (idx: number) => {
  const mi = Math.floor(idx / 30), d = (idx % 30) + 1;
  return `${MONTHS_EN[mi].toLowerCase()}-${d}`;
};
const dayTitle = (idx: number) => {
  const mi = Math.floor(idx / 30), d = (idx % 30) + 1;
  return { en: `${d} ${MONTHS_EN[mi]}`, ar: `${d} ${MONTHS_AR[mi]}` };
};

let daysSrc = `import type { CRDocument } from '../types';\n`;
daysSrc += `import { SET_BLOCKS } from './sets';\n\n`;
daysSrc += `// Generated by scripts/katameros/gen.ts — 366 Coptic days (1742 AM, leap-year shape).\n`;
daysSrc += `// Sundays computed from 1 Tout 1742 AM = Thu Sep 11, 2025; Great Fast from Orthodox Easter 2026-04-12.\n`;
daysSrc += `const byKey: Record<string, CRDocument> = {};\n`;
for (let i = 0; i < 366; i++) {
  const t = dayTitle(i);
  const key = dayKey(i);
  daysSrc += `byKey[${js(key)}] = { id: ${js(`katameros-${key}`)}, title: ${js(t)}, subtitle: { en: ${js(gregEn(i))}, ar: ${js(gregEn(i))} }, blocks: SET_BLOCKS[${dayToSet[i]}] };\n`;
}
// feast docs carry the feast name
for (const f of feasts) {
  const t = dayTitle(f.idx);
  const slug = f.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  daysSrc += `byKey[${js(`feast-${slug}`)}] = { id: ${js(`katameros-feast-${slug}`)}, title: ${js({ en: f.en, ar: f.ar })}, subtitle: { en: ${js(`${t.en} · ${gregEn(f.idx)}`)}, ar: ${js(`${t.ar} · ${gregEn(f.idx)}`)} }, blocks: SET_BLOCKS[${dayToSet[f.idx]}] };\n`;
}
const ref = (idx: number) => `byKey[${js(dayKey(idx))}]`;
daysSrc += `\nexport const sundaysDocs: CRDocument[] = [\n${sundays.map((i) => `  ${ref(i)},`).join('\n')}\n];\n`;
const weekdayIdx = Array.from({ length: 366 }, (_, i) => i).filter((i) => weekday(i) !== 0 && !fastIdx.has(i));
daysSrc += `\nexport const weekdaysDocs: CRDocument[] = [\n${weekdayIdx.map((i) => `  ${ref(i)},`).join('\n')}\n];\n`;
daysSrc += `\nexport const fastDocs: CRDocument[] = [\n${[...fastIdx].sort((a, b) => a - b).map((i) => `  ${ref(i)},`).join('\n')}\n];\n`;
daysSrc += `\nexport const feastsDocs: CRDocument[] = [\n${feasts.map((f) => `  byKey[${js(`feast-${f.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`)}],`).join('\n')}\n];\n`;
writeFileSync(join(outDir, 'days.ts'), daysSrc);

// ---------------------------------------------------------------- report
console.log('sets:', sorted.length);
console.log('days:', dayToSet.length);
console.log('sundays:', sundays.length, '| weekdays:', weekdayIdx.length, '| fast:', fastIdx.size, '| feasts:', feasts.length);
console.log('unparsed refs:', unparsed.length, unparsed.slice(0, 10));
console.log('missing verses:', missing.length, missing.slice(0, 20));
const totalBlocks = sorted.reduce((n, s) => n + buildSetBlocks(s).length, 0);
console.log('total set blocks:', totalBlocks);
