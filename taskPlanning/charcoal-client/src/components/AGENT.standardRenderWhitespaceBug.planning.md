# StandardRenderEditor trailing whitespace bug

**Status:** Phase 2b complete -- Track B paragraph-boundary `<Space />` adjacent to `<br />` round-trips through WML and editor. **Phase 2c** discovered (consecutive `<br />` / empty middle paragraphs). Next step: **Phase 3** (manual Workbench verification for Tracks A/B; archive after 2c or defer 2c).

## Purpose

Fix Workbench authoring so **`StandardRenderEditor` preserves in-progress editing state** (whitespace and paragraph structure) instead of erasing it on sync. Three related problems, three tracks:

| Track | User scenario | Root issue |
| --- | --- | --- |
| **A -- Document boundary** | Trailing/leading space on the **only** paragraph, or at the **start/end of the whole field** | Editor inbound trim breaks existing `<Space />` round-trip |
| **B -- Paragraph boundary** | Trailing space at end of a **non-final** paragraph; leading space at start of a paragraph after Enter | WML **cannot represent** this today; literal whitespace before/after `<br />` is stripped on parse, and `<Space /><br />` is compressed away |
| **C -- Empty paragraph** | User presses Enter at end of paragraph A to insert empty paragraph B between A and C | Consecutive `<br />` collapse to one in merge/parse; outbound never emits `br, br` for empty middle paragraphs ([`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts) encodes the loss) |

**Product framing:** Current `<Space />` + `<br />` rules optimize **finished text** (displayed output where space before a line break is rarely meaningful). Authoring is **in-progress text**, where that space is **essential** for smooth editing. We should relax storage/parsing rules so intentional paragraph-edge spaces persist through save/reload, without restoring the removed "visible whitespace" editor decoration.

## Symptom

- User types a trailing space at end of text; it disappears on sync or save.
- Same loss on a **non-final** paragraph (line one of a multi-paragraph Description).
- May affect trailing space after inline links on the last line.
- Empty paragraph inserted between two non-empty paragraphs (Enter at end of A) disappears on save/sync (Track C).

## Whitespace preservation model (target semantics)

Slate uses **paragraph blocks**, not `\n` in text nodes. Enter creates a second `paragraph`; serialization uses `<br />` in the RenderTree / WML.

| User intent | Slate shape (simplified) | Target RenderTree / WML | Notes |
| --- | --- | --- | --- |
| Trailing space, **last** paragraph | `[{ para: 'Hello ' }]` | `'Hello'`, `{ tag: 'Space' }` | Track A; `<Space />` at **document end** (already defined) |
| Leading space, **first** paragraph | `[{ para: ' Hello' }]` | `{ tag: 'Space' }`, `'Hello'` | Track A; `<Space />` at **document start** |
| Trailing space, **before** next paragraph | `[{ para: 'Line one ' }, { para: 'Line two' }]` | `'Line one'`, `{ tag: 'Space' }`, `{ tag: 'br' }`, `'Line two'` | Track B; **must** be explicit `<Space />` before `<br />` -- literal `'Line one '` does not survive WML parse |
| Leading space, **after** previous paragraph | `[{ para: 'Line one' }, { para: ' Line two' }]` | `'Line one'`, `{ tag: 'br' }`, `{ tag: 'Space' }`, `'Line two'` | Track B; `<Space />` immediately **after** `<br />` |
| Internal space mid-line | `'Hello world'` | literal space in string | Unchanged |
| **Empty paragraph between content** | `[{ para: 'A' }, { para: '' }, { para: 'C' }]` | `'A'`, `{ tag: 'br' }`, `{ tag: 'br' }`, `'C'` | Track C; one `<br />` per Slate paragraph boundary; **do not** collapse consecutive `<br />` in authoring storage |

### Why Track B needs WML changes (not just editor trim removal)

WML tagged-message rules ([`README.taggedMessage.md`](../../../packages/mtw-wml/ts/README.taggedMessage.md), [`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md)):

- Literal whitespace **before/after `<br />`** is **ignored** on parse.
- Only **`<Space />`** creates explicit spacing at tag edges.

Today the pipeline **also removes** `<Space />` adjacent to `<br />`:

- [`compressWhitespace`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts): `trimEnd` on strings before `br`; **deletes** `{ Space }` before `br` ([test](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts)).
- [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts): `{ Space }` + `{ br }` collapses to `{ br }` only.
- [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md): documents `<Space />` as document-boundary-only.

**Target WML example (Track B):**

```xml
<Description>Line one<Space /><br />Line two</Description>
```

Leading space on line two:

```xml
<Description>Line one<br /><Space />Line two</Description>
```

**Phase 1 decision:** **Storage** preserves single `<Space />` adjacent to `<br />`; **display** needs no new normalization layer (see [Display vs storage decision](#display-vs-storage-decision-phase-1)).

### What stays normalized

- Collapse runs of 2+ whitespace characters to one (`withConstrainedWhitespace`, merge between strings).
- No restored visible-whitespace decoration in the editor UI.
- Multiple consecutive `<Space />` before/after `<br />` should still compress to **one** (mirror existing multi-Spacer rules, but keep a single Spacer).

### Why Track C needs storage/display split (discovered post-2b)

**Display / finished prose:** Collapsing `br, br` to a single break rarely changes what players see (empty lines between content are invisible in most render paths).

**Authoring / in-progress edit:** Pressing Enter at the end of paragraph A to create paragraph B **between** A and C is exactly `br, br` in WML terms. Inbound already maps `[br, br]` to three Slate paragraphs ([`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts)); outbound and storage collapse prevent the edit from sticking.

**Loss layers today:**

| Layer | File | Behavior |
| --- | --- | --- |
| Outbound merge | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | `br` + `br` drops second break |
| Outbound conversion | [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) + merge | Empty middle paragraph yields one `br`, not two ([`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts) line 189) |
| Parse compress | [`compressWhitespaceRun`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | Contiguous whitespace run emits at most one `br` |
| Inbound | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | **Ready** -- preserves multiple `br` if present in tree |

**Phase 2c decision (draft):** **Storage** preserves consecutive `<br />` in authoring fields (`Description`, `Summary`, `DisplayName`); **display** may still collapse at `RenderTreeContent` / `messageParsing` if desired. Same pattern as Track B Space+br.

## Where trimming happens today

| Layer | File | Track | Behavior to change |
| --- | --- | --- | --- |
| WML parse | [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | B | `trimEnd`/`trimStart` adjacent to `br`; strip `Space` before `br` |
| Merge | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | A + B | `trimEnd`/`trimStart` adjacent to `br`; drop `{ Space, br }` / `{ br, Space }` pairs |
| Constructor | [`StandardRenderSimpleBase`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | A | Promotes document-end/start string tails to `<Space />` (keep; extend awareness of Space+br) |
| Inbound (Render -> Slate) | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | A (fixed) + B | Track A: boundary-aware trim preserves doc-start/end `{ Space }`; Track B: still strips Space adjacent to `{ br }` |
| Outbound (Slate -> Render) | [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) | A + B | Must emit `{ Space }` before/after `{ br }` when Slate paragraph has edge space |
| Tests | [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts), [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts), [`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts) | A + B | Encode old "strip break-adjacent space" policy |

**Working theory:** Hypothesis B (serialization / WML round-trip) for both tracks. Legacy Slate plugins (hypothesis A) are secondary.

## Hypotheses (investigate both)

| # | Path | Mechanism |
| --- | --- | --- |
| A | **Legacy Slate** | Unlikely primary; [`withConstrainedWhitespace`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) only collapses `\s{2,}`. |
| B | **WML + editor round-trip** | Track A: inbound trim drops document `<Space />`. Track B: WML never stores pre-`<br />` space; editor sync erases in-progress input. |

## Progress

| Phase | Goal | Status |
| --- | --- | --- |
| 0 | Baseline green; failing tests for Track A and Track B | Complete |
| 1 | Confirm layer stack; decide display vs storage normalization | Complete |
| 2a | **Track A:** document-end `<Space />` editor round-trip | Complete |
| 2b | **Track B:** WML `<Space /><br />` semantics + full pipeline | Complete |
| 2c | **Track C:** consecutive `<br />` / empty middle paragraph authoring round-trip | Not started |
| 3 | Manual Workbench verification; durable docs | Not started |

## Links

| Doc / code | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task-plan conventions |
| [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) | Vitest commands |
| [`README.taggedMessage.md`](../../../packages/mtw-wml/ts/README.taggedMessage.md) | Tagged-message whitespace rules |
| [`packages/mtw-wml/ts/standardize/render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) | `<Space />` rules (to update for Space+br) |
| [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | Parse-time trim/compress |
| [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | Inbound conversion |
| [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) | Outbound conversion |
| [`StandardRenderEditor.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx) | Editor sync loop |
| [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) | Target-semantics round-trip tests (Track A + B) |
| [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx) | Parent-echo sync test |

## Getting Started

Read [`taskPlanning/AGENT.md`](../../AGENT.md) once.

1. **Read WML whitespace docs** -- understand why literal space before `<br />` is not enough ([`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md) Whitespace section).
2. **Read `compressWhitespace` tests** -- see current Space+br elimination ([`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts)).
3. **Read editor sync loop** -- [`useStandardRenderEditorHook`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx).
4. **Testing** -- [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md), [`charcoal-client/AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md).

5. **Baseline verification**

```bash
cd charcoal-client
npm run test:single -- src/components/Editor/StandardRenderEditor
npm run test:single -- src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx
cd ../packages/mtw-wml
npm run test -- ts/standardize/render/index.test.ts
npm run test -- ts/schema/utils/schemaOutput/compressWhitespace.test.ts
```

## Investigation checklist

### Reproduce

- [X] Track A: trailing space, single paragraph (`"Hello "`). -- `whitespacePreservation.test.ts` outbound pass; inbound/round-trip fail.
- [X] Track B: trailing space, non-final paragraph (two Slate paragraphs). -- outbound/inbound/round-trip fail in `whitespacePreservation.test.ts`.
- [X] Track B: leading space on second paragraph after Enter. -- same.
- [X] Trailing space after inline link on last line. -- document-end outbound covered by `descendantsToRender.test.ts`; non-final link+space fails in `whitespacePreservation.test.ts` Track B round-trip.
- [X] Load WML with document-end `<Space />`; confirm inbound editable space. -- WML schema load/print pass (`index.test.ts`); inbound fails (`descendantsFromRender` strips Space).
- [X] `debounce={false}` vs default -- when does loss appear? -- Loss on **inbound** when parent echoes `StandardRender` with `<Space />`; outbound fires immediately under `debounce={false}` (Workbench session). Debounce timing is not root cause.

### Round-trip tests to add (should fail before fix)

**Track A -- document end:**

```typescript
const slate = [{ type: 'paragraph', children: [{ text: 'Hello ' }] }]
const render = descendantsToRender(standard)(slate)
const back = descendantsFromRender(render, { standard })
// expect back[0].children[0].text === 'Hello '
// expect render.toJSON() ends with { tag: 'Space' }
// WML round-trip: schema load/save preserves <Space /> at end
```

**Track B -- pre-`<br />` (two paragraphs):**

```typescript
const slate = [
  { type: 'paragraph', children: [{ text: 'Line one ' }] },
  { type: 'paragraph', children: [{ text: 'Line two' }] }
]
const render = descendantsToRender(standard)(slate)
// expect render.toJSON() like ['Line one', { tag: 'Space' }, { tag: 'br' }, 'Line two']
const back = descendantsFromRender(render, { standard })
// expect back[0].children[0].text === 'Line one '
// WML: Line one<Space /><br />Line two survives parse -> print
```

**Track B -- post-`<br />` leading space:**

```typescript
const slate = [
  { type: 'paragraph', children: [{ text: 'Line one' }] },
  { type: 'paragraph', children: [{ text: ' Line two' }] }
]
// expect ['Line one', { tag: 'br' }, { tag: 'Space' }, 'Line two']
```

### Trace layers

- [X] Track A: `descendantsFromRender` trim vs outbound `<Space />` from `descendantsToRender`. -- Outbound pass; inbound `trimParagraphBoundaries` + two additional strip points (see Phase 1 trace).
- [X] Track B: `compressWhitespace` + `standardRenderAdd` vs in-memory RenderTree. -- Schema load/print pass; merge/compress fail; client outbound/inbound fail.
- [X] Rule out Slate normalize for single trailing space. -- `withConstrainedWhitespace` only collapses `\s{2,}`; no `renderLeaf`/`decorate` in StandardRenderEditor paths (grep clean).

## Design constraints

1. **No visible whitespace decoration** in the editor.
2. **`<Space />` at document boundaries** -- unchanged semantics for field start/end.
3. **`<Space />` adjacent to `<br />`** -- **new** allowed positions for Track B (authoring/storage); update [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) accordingly.
4. **Do not rely on literal whitespace in WML markup** next to `<br />` -- always serialize to `<Space />`.
5. **Keep `\s{2,}` collapse** in the editor; compress multiple `<Space />` before/after `<br />` to one in WML.
6. **Gateway / lambda** -- grep for break-adjacent trim assumptions if Track B touches shared render paths.

## Fix direction (draft -- confirm after Phase 1)

### Track B first (WML foundation)

Recommended order: **WML semantics before client conversion**, so editor outbound has a storable target.

1. **`compressWhitespace`:** Preserve a single `{ Space }` immediately before or after `{ br }`; stop `trimEnd`/`trimStart` on strings solely because neighbor is `br` when a Spacer carries the intent. Update [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts).

2. **`standardRenderAdd`:** Preserve `{ Space, br }` and `{ br, Space }` (single Spacer); stop string `trimEnd`/`trimStart` adjacent to `br` when emitting Spacer nodes. Update [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts).

3. **`StandardRenderSimpleBase` / diff / subtract:** Audit promotion rules so Space+br is not folded away.

4. **WML print/parse integration test:** `Line one<Space /><br />Line two` full round-trip via Schema.

5. **Durable docs:** Extend [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) Space positioning: document-boundary OR immediately adjacent to `<br />`.

### Track A + B (client)

6. **`descendantsToRender`:** When flushing a paragraph because the next block is another paragraph, emit `{ Space }` before `{ br }` if Slate paragraph ends with trailing space; emit `{ Space }` after `{ br }` if next paragraph starts with leading space. Document-end still uses document-level `<Space />` per existing test.

7. **`descendantsFromRender`:** Replace blanket `trimParagraphBoundaries` with context-aware logic:
   - Map `{ Space }` before `{ br }` to trailing space on preceding Slate paragraph.
   - Map `{ Space }` after `{ br }` to leading space on following Slate paragraph.
   - Map document-end/start `{ Space }` to last/first paragraph edge space.

8. **`StandardRenderEditor` test:** Parent echoes `onChange`; space survives single- and multi-paragraph cases.

### Display (optional, Phase 1 decision)

9. If player-facing render should omit space-before-break, add normalization at **render/display** only, not in stored WML.

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets when used).

- [X] **Phase 0 -- Reproduce**
  - [X] Run baseline verification; confirm green.
  - [X] Add failing Track A round-trip tests (editor + WML if applicable).
  - [X] Add failing Track B round-trip tests (editor + WML `Space`+`br`).
  - [X] Optionally add failing `StandardRenderEditor` parent-echo test.

- [X] **Phase 1 -- Diagnose and decide**
  - [X] Trace Track A vs Track B through full pipeline.
  - [X] Decide display vs storage normalization for Space+br.
  - [X] Record findings under **Diagnosis record**.

- [X] **Phase 2a -- Track A (document boundary)**
  - [X] Fix `descendantsFromRender` / confirm `descendantsToRender` for document-end `<Space />`.
  - [X] Tests green for single-paragraph trailing space.

- [X] **Phase 2b -- Track B (Space + br)**
  - [X] Relax `compressWhitespace` and `standardRenderAdd`.
  - [X] WML schema round-trip tests for `Space`+`br` patterns.
  - [X] Wire `descendantsToRender` / `descendantsFromRender`.
  - [X] Update durable WML docs.

- [ ] **Phase 2c -- Track C (consecutive br / empty paragraph)**
  - [ ] Add failing round-trip test: `[{ para: 'A' }, { para: '' }, { para: 'C' }]` survives outbound/inbound and WML `A<br /><br />C`.
  - [ ] Stop collapsing `br` + `br` in `standardRenderAdd` for authoring merge paths (audit subtract/diff).
  - [ ] Update `compressWhitespaceRun` to preserve multiple `br` in a contiguous run (or flush per-paragraph semantics -- confirm design during implementation).
  - [ ] Fix `descendantsToRender` to emit one `br` per Slate paragraph boundary including empty middle paragraphs.
  - [ ] Update legacy `descendantsToRender.test.ts` empty-paragraph expectation; confirm inbound unchanged.
  - [ ] Update durable docs (`render/AGENT.md`, syntax README) for consecutive `<br />` authoring rule.
  - [ ] Optional: display-only collapse in `RenderTreeContent` / `messageParsing` (out of scope unless manual verify shows player-visible regressions).

- [ ] **Phase 3 -- Verify and close**
  - [ ] Manual Workbench checks (see Verification).
  - [ ] Archive this plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

## Diagnosis record

### Phase 1 verification (2026-06-07)

**Baseline (legacy tests, all green):**

| Suite | Result |
| --- | --- |
| `charcoal-client` `StandardRenderEditor/` (5 files, 68 legacy tests) | Pass |
| `StandardRenderEditor.test.tsx` (3 legacy sync-storm tests) | Pass |
| `mtw-wml` `render/index.test.ts` (57 legacy tests) | Pass |
| `mtw-wml` `compressWhitespace.test.ts` (11 legacy tests) | Pass |

**Target-semantics tests** (describe `Whitespace preservation (target semantics)` unless noted):

| File | Pass | Fail |
| --- | --- | --- |
| [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) | 2 (Track A outbound) | 11 |
| [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx) (parent echo) | 3 (existing) | 1 |
| [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts) | 0 | 3 |
| [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts) | 4 (Track A WML + Track B schema load/print) | 3 (merge) |

**Failure matrix by track and layer (confirmed):**

| Layer | Track A | Track B |
| --- | --- | --- |
| Slate plugins (`withConstrainedWhitespace`) | Pass | Pass |
| Client outbound (`descendantsToRender`) | Pass | Fail |
| Client inbound (`descendantsFromRender`) | Fail | Fail |
| Client full round-trip | Fail | Fail |
| WML `compressWhitespace` | N/A | Fail |
| WML merge (`standardRenderAdd`) | N/A | Fail |
| WML schema load/print | Pass | Pass |
| Lambda / gateways | N/A | No `compressWhitespace` or `standardRenderAdd` usage (grep clean) |

### Phase 1 pipeline trace

#### Track A -- document boundary

| Step | File / function | Result | Notes |
| --- | --- | --- | --- |
| Slate input | [`constrainedWhitespace.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) | Pass | Collapses `\s{2,}` only; single edge space preserved |
| Outbound | [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) + [`StandardRenderSimpleBase`](../../../packages/mtw-wml/ts/standardize/render/index.ts) constructor | Pass | Promotes doc-start/end literal space to `{ Space }` |
| Sync loop | [`StandardRenderEditor.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx) `useStandardRenderEditorHook` | Fail on echo | Loss when parent re-pushes `StandardRender` with `<Space />`; not debounce-related |
| WML storage | [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts) Track A schema tests | Pass | `<Space />` at field edges round-trips |
| Inbound (bug) | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | Fail | Three strip points: |
| | `trimParagraphBoundaries` (lines 31-32, 60-61) | | Strips leading/trailing space on every flushed paragraph |
| | `singleSpace(el).trimStart()` on first string (line 69) | | Strips leading literal space at paragraph start |
| | `singleSpace(' ').trimStart()` on doc-start `{ Space }` (line 81) | | Converts document-start Spacer to empty string |

#### Track B -- paragraph boundary (Space adjacent to br)

| Step | File / function | Result | Notes |
| --- | --- | --- | --- |
| Outbound (bug) | [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) | Fail | Inserts `{ br }` between paragraphs (line 31) but never emits `{ Space }` for paragraph-edge spaces |
| WML merge (bug) | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) (lines 108-136) | Fail | `trimEnd` before `br`, `trimStart` after `br`; drops `{ Space, br }` and `{ br, Space }` pairs |
| WML parse (bug) | [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | Fail | Phase 1 collapses mixed `Space`+`br` to `{ br }` only; phase 2 trims strings adjacent to `br` |
| Parse entry points | [`prose.ts`](../../../packages/mtw-wml/ts/schema/converters/prose.ts), [`components.ts`](../../../packages/mtw-wml/ts/schema/converters/components.ts), [`taggedMessages.ts`](../../../packages/mtw-wml/ts/schema/converters/taggedMessages.ts) | -- | All call `compressWhitespace` on Description/Summary/DisplayName children |
| Schema load/print | [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts) Track B schema tests | Pass | Tree with `Space`+`br` survives if already present |
| Inbound (bug) | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | Fail | Same `trimParagraphBoundaries`; no mapping of `{ Space }` before/after `{ br }` to paragraph-edge Slate text |

**Slate hypothesis ruled out:** No `renderLeaf` or `decorate` in StandardRenderEditor or Workbench StandardRender paths (grep clean). `withConstrainedWhitespace` does not strip single trailing/leading spaces.

### Display vs storage decision (Phase 1)

| Concern | Decision | Rationale |
| --- | --- | --- |
| **Storage (WML / StandardRender)** | **Preserve** single `{ Space }` immediately before or after `{ br }` | Authoring round-trip requires storable representation; literal paragraph-edge space cannot survive WML parse |
| **Display (player-facing prose)** | **No new normalization layer in Phase 2** | [`RenderTreeContent.tsx`](../../../charcoal-client/src/components/Message/RenderTreeContent.tsx) returns `null` for `{ Space }` nodes (lines 27-28); space-before-break is already invisible to players |
| **Parse-time `compressWhitespace`** | Relax for authoring fields (Description/Summary/DisplayName) in Phase 2b | Must align with storage decision; currently strips Space+br on parse finalize |
| **Messaging parse** (`messageParsing: true` in [`messaging.ts`](../../../packages/mtw-wml/ts/schema/converters/messaging.ts)) | **Out of scope** | Workbench descriptions do not flow through message parsing; no change unless a future trace shows otherwise |
| **`schemaOutputToString`** (labels) | No change | Used for display names; Space+br patterns unlikely; both Space and br map to `' '` if encountered |

### Root cause and fix order

- **Root cause:** Hypothesis B (WML + editor round-trip), both tracks. Track A: inbound `descendantsFromRender` strips document-boundary `<Space />` that outbound and WML already preserve. Track B: WML merge/compress strips Space+br pairs; client outbound does not emit Space at paragraph boundaries; inbound has same trim as Track A.
- **Path (A / B / both):** Both -- hypothesis B confirmed; Slate plugins ruled out.
- **Fix order:** Phase 2b WML (`compressWhitespace`, `standardRenderAdd`) before client conversion for Track B; Phase 2a client inbound fix for Track A (can proceed independently of WML for single-paragraph cases, but shares `descendantsFromRender` changes with Track B).

### Legacy tests to update in Phase 2

[`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts) `Whitespace Handling` and `Mixed Content` encode the old strip-all-paragraph-edge-space policy. Phase 2 must update expectations alongside [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts).

Legacy WML tests in [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts) and [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts) (`should compress any number of Spacers before linebreak`, `should reduce multiple instances of line breaks and whitespace to a single line break`, etc.) encode old Space+br elimination; Phase 2b updates these alongside target-semantics tests.

- **Files changed (Phase 0):** `whitespacePreservation.test.ts` (new), `compressWhitespace.test.ts`, `index.test.ts`, `StandardRenderEditor.test.tsx`, this plan, `AGENT.testing.slate.md`
- **Files changed (Phase 1):** this plan, [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) (pending-change note)

### Phase 2a implementation (2026-06-07)

**Approach:** Pre-scan the render tree for document-start/end `{ Space }` tags (with a substantive-content guard so space-only renders like `[Space, Space]` still yield an empty paragraph). `pushParagraph` now passes `preserveLeading` / `preserveTrailing` into `trimParagraphBoundaries` for the first and final paragraphs only. Document-start Spacer on empty `currentChildren` maps to `{ text: ' ' }` without `trimStart`.

**Files changed:**

- [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) -- boundary-aware trim
- [`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts) -- doc-boundary Space cases; updated constructor-promoted edge-space expectation
- [`AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md) -- Track A status
- this plan

**No change:** [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) (outbound Track A already passed).

**Target-semantics tests after Phase 2a:**

| File | Pass | Fail |
| --- | --- | --- |
| [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) | 6 (Track A) | 7 (Track B) |
| [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx) (parent echo) | 4 | 0 |
| Legacy `StandardRenderEditor/` (81 tests total) | 74 | 7 (Track B target-semantics only) |

**Track A layer status (post-2a):**

| Layer | Track A |
| --- | --- |
| Client inbound (`descendantsFromRender`) | Pass |
| Client full round-trip | Pass |
| Sync loop (parent echo) | Pass |

### Phase 2b implementation (2026-06-07)

**Approach (WML first):** `compressWhitespaceRun` preserves a single `{ Space }` before and/or after `{ br }` in adjacent whitespace runs (multiple Spacers compress to one). `standardRenderAdd` keeps `{ Space, br }` / `{ br, Space }` pairs, promotes literal edge spaces adjacent to `br` to `{ Space }` tags, and preserves `br`-adjacent Space when merging Space + string. Client inbound maps br-adjacent `{ Space }` to paragraph-edge Slate text via lookahead (`spaceBeforeBr` / `spaceAfterBr`) and `preserveTrailingOnNextPush`; outbound relies on merge promotion (no `descendantsToRender` code change). Link inbound uses `el.data.text` when `children` is empty.

**Files changed:**

- [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts), [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts)
- [`render/index.ts`](../../../packages/mtw-wml/ts/standardize/render/index.ts), [`render/index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts)
- [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts), [`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts)
- [`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts) -- updated legacy whitespace expectation
- [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md), [`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md), [`README.taggedMessage.md`](../../../packages/mtw-wml/ts/README.taggedMessage.md), [`AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md)
- this plan

**No change:** [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) (outbound via `standardRenderAdd` promotion on paragraph `merge`).

**Target-semantics tests after Phase 2b:**

| File | Pass | Fail |
| --- | --- | --- |
| [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) | 13 (Track A + B) | 0 |
| [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx) (parent echo) | 4 | 0 |
| [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts) | 14 | 0 |
| [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts) | 64 | 0 |
| Legacy `StandardRenderEditor/` (83 tests total) | 83 | 0 |

**Track B layer status (post-2b):**

| Layer | Track B |
| --- | --- |
| WML `compressWhitespace` | Pass |
| WML merge (`standardRenderAdd`) | Pass |
| WML schema load/print | Pass |
| Client outbound (`descendantsToRender` + merge) | Pass |
| Client inbound (`descendantsFromRender`) | Pass |
| Client full round-trip | Pass |

### Phase 2c discovery (2026-06-07, post-2b review)

**Trigger:** Review of `compressWhitespaceRun` multi-`br` compression -- same display-vs-edit tension as Space+br. Inserting empty paragraph B between A and C (Enter at end of A) requires storable `br, br`; current pipeline collapses before reload.

**Target WML example (Track C):**

```xml
<Description>First<br /><br />Last</Description>
```

**Slate round-trip target:**

```typescript
const slate = [
  { type: 'paragraph', children: [{ text: 'First' }] },
  { type: 'paragraph', children: [{ text: '' }] },
  { type: 'paragraph', children: [{ text: 'Last' }] }
]
// descendantsToRender -> ['First', br, br, 'Last']
// descendantsFromRender -> slate unchanged
```

**Interaction with Track B:** Runs like `[Space, br, Space, br]` currently compress to `[Space, br, Space]` (one `br`). After 2c, expect `[Space, br, Space, br]` or equivalent faithful paragraph count -- confirm during implementation so Space+br positions are not regressed.

**Recommended order:** WML storage (`standardRenderAdd`, `compressWhitespace`) then client outbound; inbound likely already correct.

## Verification

```bash
cd charcoal-client
npm run test:single -- src/components/Editor/StandardRenderEditor
npm run test:single -- src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx

cd ../packages/mtw-wml
npm run test -- ts/standardize/render/index.test.ts
npm run test -- ts/schema/utils/schemaOutput/compressWhitespace.test.ts
```

Manual:

1. **Track A:** single paragraph `"Hello "`, blur, reload -- space visible; WML ends with `<Space />`.
2. **Track B:** `"Line one "`, Enter, `"Line two"`, blur, reload -- space visible at end of line one; WML shows `<Space /><br />` (or equivalent).
3. **Track B:** leading space at start of second paragraph persists; WML shows `<br /><Space />`.
4. **Track C (after 2c):** `"First"`, Enter (empty middle para), `"Last"`, blur, reload -- three paragraphs; WML shows `<br /><br />` between strings.

Grep sanity:

```bash
rg -n "renderLeaf|decorate" charcoal-client/src/components/Editor/StandardRenderEditor charcoal-client/src/components/Workbench/foundations/StandardRender
```
