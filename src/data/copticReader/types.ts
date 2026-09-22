/**
 * Coptic Reader library — data model.
 *
 * Every text block carries English and Arabic together, the way the
 * Coptic Reader books present them. The reader UI can show one language
 * or both side by side.
 */

export interface CRText {
  en: string;
  ar?: string;
}

export type CRBlockKind =
  | 'heading'
  | 'rubric' // instructions, e.g. "The priest says quietly:"
  | 'prayer'
  | 'psalm'
  | 'gospel'
  | 'reading'
  | 'hymn'
  | 'response' // congregational responses
  | 'litany'
  | 'doxology'
  | 'verse'
  | 'note';

export interface CRBlock {
  kind: CRBlockKind;
  /** short label, e.g. "Psalm 63" or the speaker "Priest:" */
  label?: CRText;
  text: CRText;
}

export interface CRDocument {
  id: string;
  title: CRText;
  subtitle?: CRText;
  blocks: CRBlock[];
}

export interface CRSection {
  id: string;
  title: CRText;
  description?: CRText;
  /** documents can be lazy-loaded for large sections (e.g. Bible books) */
  documents: CRDocument[] | (() => Promise<CRDocument[]>);
}

export interface CRBook {
  id: string;
  title: CRText;
  description: CRText;
  /** lucide icon key used by the BooksView shelf */
  icon: string;
  sections: CRSection[];
}

export interface CRLibrary {
  id: string;
  title: CRText;
  subtitle: CRText;
  attribution: CRText;
  books: CRBook[];
}

export const t = (text: CRText, lang: 'en' | 'ar'): string => {
  if (lang === 'ar') return text.ar || text.en;
  return text.en;
};
