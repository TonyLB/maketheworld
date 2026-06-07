# StandardRenderEditor trailing whitespace bug

**Status:** Not started. Next step: add failing round-trip tests for **Track A** (document-end) and **Track B** (pre-`<br />`); confirm Track B requires WML semantic relaxation first.

## Purpose

Fix Workbench authoring so **`StandardRenderEditor` preserves whitespace the user types** instead of erasing it on sync. Two related problems, two tracks:

| Track | User scenario | Root issue |
| --- | --- | --- |
| **A -- Document boundary** | Trailing/leading space on the **only** paragraph, or at the **start/end of the whole field** | Editor inbound trim breaks existing `<Space />` round-trip |
| **B -- Paragraph boundary** | Trailing space at end of a **non-final** paragraph; leading space at start of a paragraph after Enter | WML **cannot represent** this today; literal whitespace before/after `<br />` is stripped on parse, and `<Space /><br />` is compressed away |

**Product framing:** Current `<Space />` + `<br />` rules optimize **finished text** (displayed output where space before a line break is rarely meaningful). Authoring is **in-progress text**, where that space is **essential** for smooth editing. We should relax storage/parsing rules so intentional paragraph-edge spaces persist through save/reload, without restoring the removed "visible whitespace" editor decoration.

## Symptom

- User types a trailing space at end of text; it disappears on sync or save.
- Same loss on a **non-final** paragraph (line one of a multi-paragraph Description).
- May affect trailing space after inline links on the last line.

## Whitespace preservation model (target semantics)

Slate uses **paragraph blocks**, not `\n` in text nodes. Enter creates a second `paragraph`; serialization uses `<br />` in the RenderTree / WML.

| User intent | Slate shape (simplified) | Target RenderTree / WML | Notes |
| --- | --- | --- | --- |
| Trailing space, **last** paragraph | `[{ para: 'Hello ' }]` | `'Hello'`, `{ tag: 'Space' }` | Track A; `<Space />` at **document end** (already defined) |
| Leading space, **first** paragraph | `[{ para: ' Hello' }]` | `{ tag: 'Space' }`, `'Hello'` | Track A; `<Space />` at **document start** |
| Trailing space, **before** next paragraph | `[{ para: 'Line one ' }, { para: 'Line two' }]` | `'Line one'`, `{ tag: 'Space' }`, `{ tag: 'br' }`, `'Line two'` | Track B; **must** be explicit `<Space />` before `<br />` -- literal `'Line one '` does not survive WML parse |
| Leading space, **after** previous paragraph | `[{ para: 'Line one' }, { para: ' Line two' }]` | `'Line one'`, `{ tag: 'br' }`, `{ tag: 'Space' }`, `'Line two'` | Track B; `<Space />` immediately **after** `<br />` |
| Internal space mid-line | `'Hello world'` | literal space in string | Unchanged |

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

**Open question (decide in Phase 1):** Should **display/render** paths still collapse `<Space /><br />` for player-facing output (finished text), while **storage** preserves it for authoring? If yes, document where normalization runs vs where round-trip fidelity is required.

### What stays normalized

- Collapse runs of 2+ whitespace characters to one (`withConstrainedWhitespace`, merge between strings).
- No restored visible-whitespace decoration in the editor UI.
- Multiple consecutive `<Space />` before/after `<br />` should still compress to **one** (mirror existing multi-Spacer rules, but keep a single Spacer).

## Where trimming happens today

| Layer | File | Track | Behavior to change |
| --- | --- | --- | --- |
| WML parse | [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | B | `trimEnd`/`trimStart` adjacent to `br`; strip `Space` before `br` |
| Merge | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | A + B | `trimEnd`/`trimStart` adjacent to `br`; drop `{ Space, br }` / `{ br, Space }` pairs |
| Constructor | [`StandardRenderSimpleBase`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | A | Promotes document-end/start string tails to `<Space />` (keep; extend awareness of Space+br) |
| Inbound (Render -> Slate) | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | A + B | `trimParagraphBoundaries` on every paragraph |
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
| 0 | Baseline green; failing tests for Track A and Track B | Not started |
| 1 | Confirm layer stack; decide display vs storage normalization | Not started |
| 2a | **Track A:** document-end `<Space />` editor round-trip | Not started |
| 2b | **Track B:** WML `<Space /><br />` semantics + full pipeline | Not started |
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

- [ ] Track A: trailing space, single paragraph (`"Hello "`).
- [ ] Track B: trailing space, non-final paragraph (two Slate paragraphs).
- [ ] Track B: leading space on second paragraph after Enter.
- [ ] Trailing space after inline link on last line.
- [ ] Load WML with document-end `<Space />`; confirm inbound editable space.
- [ ] `debounce={false}` vs default -- when does loss appear?

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

- [ ] Track A: `descendantsFromRender` trim vs outbound `<Space />` from `descendantsToRender`.
- [ ] Track B: `compressWhitespace` + `standardRenderAdd` vs in-memory RenderTree.
- [ ] Rule out Slate normalize for single trailing space.

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

- [ ] **Phase 0 -- Reproduce**
  - [ ] Run baseline verification; confirm green.
  - [ ] Add failing Track A round-trip tests (editor + WML if applicable).
  - [ ] Add failing Track B round-trip tests (editor + WML `Space`+`br`).
  - [ ] Optionally add failing `StandardRenderEditor` parent-echo test.

- [ ] **Phase 1 -- Diagnose and decide**
  - [ ] Trace Track A vs Track B through full pipeline.
  - [ ] Decide display vs storage normalization for Space+br.
  - [ ] Record findings under **Diagnosis record**.

- [ ] **Phase 2a -- Track A (document boundary)**
  - [ ] Fix `descendantsFromRender` / confirm `descendantsToRender` for document-end `<Space />`.
  - [ ] Tests green for single-paragraph trailing space.

- [ ] **Phase 2b -- Track B (Space + br)**
  - [ ] Relax `compressWhitespace` and `standardRenderAdd`.
  - [ ] WML schema round-trip tests for `Space`+`br` patterns.
  - [ ] Wire `descendantsToRender` / `descendantsFromRender`.
  - [ ] Update durable WML docs.

- [ ] **Phase 3 -- Verify and close**
  - [ ] Manual Workbench checks (see Verification).
  - [ ] Archive this plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

## Diagnosis record

*(Fill in during Phase 1.)*

- **Root cause:**
- **Path (A / B / both):**
- **Display vs storage decision:**
- **Files changed:**

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

Grep sanity:

```bash
rg -n "renderLeaf|decorate" charcoal-client/src/components/Editor/StandardRenderEditor charcoal-client/src/components/Workbench/foundations/StandardRender
```
