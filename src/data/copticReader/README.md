# Coptic Library library — sources & notes

In-app bilingual (English + Arabic) liturgical library rendered by
`src/components/CopticReader.tsx`, opened from the Library view's
"Coptic Library" section.

## Content sources

- **Agpeya, Psalms, Gospels, Psalmody (Tasbeha), St. Basil Liturgy, Raising of
  Incense** — generated from the public liturgical data at
  [coptic.io](https://coptic.io). Licensing/attribution terms of coptic.io
  should be verified before production use; the in-app attribution names the
  source without claiming a specific license.
- **Prayer of the Veil (Agpeya)** — adapted from the Arabic/English text at
  St. Takla Haymanot's Coptic Orthodox site (st-takla.org); their renderings
  belong to their authors/site.
- **Synaxarium** — compiled bilingual commemorations (366 days).

Where a source had text in only one language, the entry is kept
single-language rather than machine-translated; the reader shows exactly
what each source provides.

## Placeholders (text not yet sourced)

- St. Gregory's and St. Cyril's Liturgies
- Full Katameros / daily lectionary readings (rubrics only for now)
- Bible books beyond Psalms and the four Gospels
- Deuterocanonical books
- Sacramental rites and seasonal Psalmody variants (Koiahk, Great Fast, Pentecostal)

## Layout

- `types.ts` — data model (CRText/CRBlock/CRDocument/CRSection/CRBook/CRLibrary)
- `index.ts` — assembles the 7-book catalog; large sections lazy-load
- `agpeya.ts`, `bible.ts`, `psalmody.ts`, `liturgies.ts`, `synaxarion.ts`,
  `readings.ts`, `sacraments.ts` — book modules
- `*-docs/` — per-document content files
