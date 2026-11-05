# Owned DOCX engine

DOCX import, editing, rendering, and export live in this repository. `fflate`
remains a ZIP utility, not a document editor. No Word/Office service or external
editor is invoked for DOCX. The Markdown entry point remains `[title](file.docx)`.

## Stage 1: implemented

- `src/docx_document.ts` owns the namespace-aware OOXML model. It reads common
  style inheritance/defaults, run formatting, paragraphs, and final-section
  page settings. Edits update the existing document tree instead of rebuilding
  an entire document from visible content.
- `src/docx_engine.ts` owns DOM rendering, selected-text formatting, basic table
  and embedded-image preview, block pagination, paragraph splitting, and bounded
  undo/redo history. The ribbon and modal are also project code.
- Normal paragraph text (including simple table-cell paragraphs) is editable.
  Font, size, bold, italic, underline, color, alignment, line spacing, heading
  appearance/outline level, paragraph-before-page-break, margins, and direction
  are supported. Formatting applies to the selection within one paragraph;
  with a caret only, it applies to the whole paragraph. Heading controls do not
  create or select named Word styles.
- Enter splits a paragraph. Pasted line breaks become spaces. Paragraph joining,
  cross-paragraph selections, inserting tables/images, and rich HTML paste are
  deferred. Native IME composition is retained while typing.
- Other package entries, including styles, relationships, charts, media, custom
  XML, headers, and footers, retain their uncompressed bytes on export.
  Unchanged documents download byte-for-byte originals. Protected or signed
  documents stay read-only. Edits download a copy and never save to the server.
- ZIP and XML limits, DTD rejection, local raster-image allowlisting, and the
  existing modified-document close prompt remain in force. Embedded images
  load from package blobs; external image relationships are not fetched.

This is the first compatibility stage, not complete Word fidelity. Pages keep
whole paragraphs and tables together, so an oversized block grows rather than
splitting across pages. The preview uses the final section's paper settings.
Changing page layout in a multi-section document is disabled. Existing explicit
paragraph-before-page breaks are supported; in-run page breaks are not yet
repaginated. Missing fonts can also change wrapping.

Tables currently have basic cells and horizontal spans. Vertical merges,
precise widths/borders, floating positioning, and pagination are not complete.
Headers/footers, list numbering, advanced fields, revisions, and drawings are
preserved in the file but do not have faithful visual rendering. Paragraphs
containing complex objects, fields, links, tabs, or explicit run breaks are
read-only so the text editor cannot silently rewrite those structures. Unknown
top-level objects receive a placeholder, retaining the original XML.

## Stage 2: structured editing

Add paragraph joining, cross-paragraph selection, list editing/numbering,
tab and break handling, named styles, table row/column operations and merged
cells, and inserting/resizing images. Gate each feature on round-trip fixtures
that show it changes only the intended OOXML nodes.

## Stage 3: page-layout fidelity

Add line-level pagination, split paragraphs and tables, widow/orphan controls,
keep-with-next, per-section page settings, headers/footers, page numbers, and
floating images. Compare representative documents against Word exports with
visual fixtures and explicit font assumptions.

## Stage 4: advanced compatibility

Add fields and cross-references, comments, tracked changes, content controls,
equations, and advanced objects incrementally. Continue preserving unsupported
parts; never claim full compatibility based only on opening or exporting a file.

## Verification and references

`test/markdown-it/docx-native.test.mjs` exercises the actual production model and
default engine, namespace variants, selected-run splitting, style inheritance,
paragraph splitting, undo/redo, read-only protection, and untouched ZIP parts.
The DOM adapter covers lifecycle and exported structure, not real browser
selection, IME behavior, or visual layout. Browser visual QA remains required.

- [Microsoft: WordprocessingML overview](https://learn.microsoft.com/en-us/office/open-xml/word/overview)
- [Microsoft: paragraphs, runs and text](https://learn.microsoft.com/en-us/office/open-xml/word/how-to-open-and-add-text-to-a-word-processing-document)
- [MDN: plaintext-only editing](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/contentEditable)
