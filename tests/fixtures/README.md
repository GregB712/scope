# Test fixtures

Synthetic Markdown used by parser tests. The real sample dossier lives in
`fixtures/reports/` (also used as the development filesystem source).

| File | Exercises |
|---|---|
| `variant-inline-labels.md` | Format drift seen in the 2026-11-02 edition: `Category · Importance` on one line, `Published/Event`, `Confidence`, numbered sub-headings, plain-text sources, blockquote preamble, table risk monitor, abbreviated categories (`AI / Finance`). Content shortened from the real edition. |
| `variant-plain-language.md` | The plain-language edition of 2026-11-02 10:34 (shortened): `Topic`, `How important (1–10)`, `When`, a time zone written as "Athens time", and a research window without years. |
| `generic-football.md` | A different subject and vocabulary: YAML frontmatter, H2/H3 sections, `Area`/`Score`/`Summary`/`Watch` labels, word importance. |
| `minimal-notes.md` | No headings, no metadata. |
| `empty.md` | An empty file (failed automation run). |
