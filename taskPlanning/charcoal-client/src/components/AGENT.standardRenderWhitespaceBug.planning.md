# StandardRenderEditor trailing whitespace bug

**Status:** Phase 2d.3 complete -- Track D client outbound/inbound wired to `<DoubleSpace />`. **Next step:** Phase 2d.4 -- diff/merge verification fixtures.

## Purpose

Fix Workbench authoring so **`StandardRenderEditor` preserves in-progress editing state** (whitespace and paragraph structure) instead of erasing it on sync. Four related problems, four tracks:

| Track | User scenario | Root issue |
| --- | --- | --- |
| **A -- Document boundary** | Trailing/leading space on the **only** paragraph, or at the **start/end of the whole field** | Editor inbound trim breaks existing `<Space />` round-trip |
| **B -- Paragraph boundary** | Trailing space at end of a **non-final** paragraph; leading space at start of a paragraph after Enter | WML **cannot represent** this today; literal whitespace before/after `<br />` is stripped on parse, and `<Space /><br />` is compressed away |
| **C -- Empty paragraph** | User presses Enter at end of paragraph A to insert empty paragraph B between A and C | Consecutive `<br />` collapse to one in merge/parse; outbound never emits `br, br` for empty middle paragraphs ([`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts) encodes the loss) |
| **D -- Mid-line insertion slot** | User creates `"Hello  world"` (double space between words) to insert a word between existing chunks | WML cannot represent `\s{2}` durably with literal markup; adjacent `<Space /><Space />` is **ambiguous in merge/diff** (join compaction vs structural slot); editor collapses `\s{2,}` today |

**Product framing:** Current `<Space />` + `<br />` rules optimize **finished text** (displayed output where space before a line break is rarely meaningful). Authoring is **in-progress text**, where that space is **essential** for smooth editing. We should relax storage/parsing rules so intentional paragraph-edge spaces persist through save/reload, without restoring the removed "visible whitespace" editor decoration.

## Symptom

- User types a trailing space at end of text; it disappears on sync or save.
- Same loss on a **non-final** paragraph (line one of a multi-paragraph Description).
- May affect trailing space after inline links on the last line.
- Empty paragraph inserted between two non-empty paragraphs (Enter at end of A) disappears on save/sync (Track C).
- Double space between words mid-line (e.g. `"Hello  world"` while inserting `"there"`) disappears on sync or save (Track D).

## Unified editing-slot rule (Tracks C and D)

Authoring whitespace at a **boundary** serves one of two roles:

| Boundary shape | Role | Storage token | Track |
| --- | --- | --- | --- |
| **Closed** -- whitespace **between two filled regions** (content -- slot -- content) | Hold open an empty interval for the cursor | **`<DoubleBR />`** (paragraph); **`<DoubleSpace />`** (mid-line) | C; D |
| **Open** -- whitespace at an **edge** with nothing filled on one side yet | Foothold to start typing | **`<br />`** or **`<Space />`** (one) | A/B; D (single trailing space) |

**Phase 2d decision:** Do **not** encode closed-boundary slots as **two adjacent tags of the same kind** (`Space, Space` or `br, br`). WML edits are fragment merges without an intent discriminator; adjacency forces context-sensitive merge rules (e.g. `["Hello", Space]` + `[Space, "world"]` must compact to `["Hello world"]`, but `["Hello"]` + `[DoubleSpace, "world"]` must not). **Atomic tags** make edit syntax unambiguous.

**Interim (Phase 2c):** Track C shipped with cap-at-2 consecutive `<br />`. Phase 2d migrates storage/print to `<DoubleBR />` (parse accepts legacy `<br /><br />` and normalizes).

**Product rationale (Track D):** Users should not need special typing order to insert words. Preserving natural `\s{2}` mid-line editing states is part of UI trust.

## Whitespace preservation model (target semantics)

Slate uses **paragraph blocks**, not `\n` in text nodes. Enter creates a second `paragraph`; serialization uses `<br />` in the RenderTree / WML.

| User intent | Slate shape (simplified) | Target RenderTree / WML | Notes |
| --- | --- | --- | --- |
| Trailing space, **last** paragraph | `[{ para: 'Hello ' }]` | `'Hello'`, `{ tag: 'Space' }` | Track A; `<Space />` at **document end** (already defined) |
| Leading space, **first** paragraph | `[{ para: ' Hello' }]` | `{ tag: 'Space' }`, `'Hello'` | Track A; `<Space />` at **document start** |
| Trailing space, **before** next paragraph | `[{ para: 'Line one ' }, { para: 'Line two' }]` | `'Line one'`, `{ tag: 'Space' }`, `{ tag: 'br' }`, `'Line two'` | Track B; **must** be explicit `<Space />` before `<br />` -- literal `'Line one '` does not survive WML parse |
| Leading space, **after** previous paragraph | `[{ para: 'Line one' }, { para: ' Line two' }]` | `'Line one'`, `{ tag: 'br' }`, `{ tag: 'Space' }`, `'Line two'` | Track B; `<Space />` immediately **after** `<br />` |
| Internal space mid-line (single) | `'Hello world'` | literal space in string | Unchanged |
| **Mid-line insertion slot** | `[{ para: 'Hello  world' }]` | `'Hello'`, `{ tag: 'DoubleSpace' }`, `'world'` | Track D; `<DoubleSpace />` between string/link chunks |
| **Empty paragraph between content** | `[{ para: 'A' }, { para: '' }, { para: 'C' }]` | `'A'`, `{ tag: 'DoubleBR' }`, `'C'` | Track C; **target** after 2d (interim 2c: `br, br`) |

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

- Cap runs of 3+ **literal** whitespace characters in Slate at **two** (`withConstrainedWhitespace`); `\s{2}` is the insertion-slot shape in the editor.
- No restored visible-whitespace decoration in the editor UI.
- Multiple consecutive `<Space />` **immediately before/after `<br />`** compress to **one** (Track B unchanged).
- **Display only:** collapse `<DoubleSpace />` and `<DoubleBR />` to single-space / single-break visible output for player-facing prose (storage preserves atoms; see [Display vs storage](#display-vs-storage-decision-phase-1)).
- **Do not** use adjacent `<Space /><Space />` or `<br /><br />` in new storage/print (legacy aliases normalize on parse to atomic tags).

### Why Track C needs storage/display split (discovered post-2b)

**Display / finished prose:** Collapsing `br, br` to a single break rarely changes what players see (empty lines between content are invisible in most render paths).

**Authoring / in-progress edit:** Pressing Enter at the end of paragraph A to create paragraph B **between** A and C requires a storable empty-middle-paragraph token. Phase 2c used `br, br`; **Phase 2d target** is `<DoubleBR />` (see [atomic tags section](#why-atomic-tags-doublespace--doublebr----phase-2d)).

**Loss layers today:**

| Layer | File | Behavior |
| --- | --- | --- |
| Outbound merge | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | `br` + `br` drops second break |
| Outbound conversion | [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) + merge | Empty middle paragraph yields one `br`, not two ([`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts) line 189) |
| Parse compress | [`compressWhitespaceRun`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | Contiguous whitespace run emits at most one `br` |
| Inbound | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | **Ready** -- preserves multiple `br` if present in tree |

**Phase 2c decision (interim, shipped):** Cap-at-2 consecutive `<br />` preserved authoring round-trip. **Superseded in Phase 2d** by `<DoubleBR />` for merge/diff clarity (legacy `<br /><br />` normalizes on parse).

### Why atomic tags (`<DoubleSpace />`, `<DoubleBR />`) -- Phase 2d

**Problem (adjacent tags):** All edits merge WML fragments. The same spacer tokens mean different things depending on merge context:

| Merge | Expected result |
| --- | --- |
| `["Hello", Space]` + `[Space, "world"]` | `["Hello world"]` (join compaction) |
| `["Hello"]` + `[DoubleSpace, "world"]` | `["Hello", DoubleSpace, "world"]` (structural slot) |

Adjacent `<Space /><Space />` cannot express that distinction in edit syntax. Diff from `["Hello world"]` to a double slot can produce a Replace whose match side promotes to `<Space />world`; merging that incorrectly against a trailing `Space` on the base **collapses** the slot.

**Solution:** One tag per closed-boundary slot. Diff from `["Hello world"]` to `["Hello", DoubleSpace, "world"]` naturally yields `{ remove: [' world'], add: [DoubleSpace, 'world'] }`, which serializes to:

```xml
<Replace><Space />world</Replace><With><DoubleSpace />world</With>
```

(Match leading space promoted by [`StandardRenderSimpleBase`](../../../packages/mtw-wml/ts/standardize/render/index.ts) constructor; `DoubleSpace` is **not** in the `Space` peel equivalence class in diff.)

**Target WML examples:**

```xml
<Description>Hello<DoubleSpace />world</Description>
<Description>First<DoubleBR />Last</Description>
```

**Slate round-trip targets:**

```typescript
// Track D
const slateD = [{ type: 'paragraph', children: [{ text: 'Hello  world' }] }]
// outbound -> ['Hello', DoubleSpace, 'world']
// inbound -> slateD unchanged

// Track C (after DoubleBR migration)
const slateC = [
  { type: 'paragraph', children: [{ text: 'First' }] },
  { type: 'paragraph', children: [{ text: '' }] },
  { type: 'paragraph', children: [{ text: 'Last' }] }
]
// outbound -> ['First', DoubleBR, 'Last']
```

**Loss layers today (Track D -- unchanged until 2d):**

| Layer | File | Behavior |
| --- | --- | --- |
| Slate normalize | [`constrainedWhitespace.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) | `\s{2,}` collapses to one |
| Tags | schema / render | `DoubleSpace`, `DoubleBR` do not exist |
| Merge / diff | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | `Space`+`Space` dropped; no `DoubleSpace` |
| Outbound / inbound | client converters | `\s{2}` not promoted to atomic tag |

**Spike (confirm before implementation):** WML schema test that `<Description>Hello  world</Description>` (two literal spaces) does **not** preserve `\s{2}` on parse/print -- confirms explicit tag required.

**Merge/diff tests (required in 2d):** `base.merge(base.diff(target)).equals(target)` for slot transitions; compaction case `["Hello", Space].merge([Space, "world"])` stays single-space and does **not** emit `DoubleSpace`.

## Where trimming happens today

| Layer | File | Track | Behavior to change |
| --- | --- | --- | --- |
| WML parse | [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | B | `trimEnd`/`trimStart` adjacent to `br`; strip `Space` before `br` |
| Merge | [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | A + B | `trimEnd`/`trimStart` adjacent to `br`; drop `{ Space, br }` / `{ br, Space }` pairs |
| Constructor | [`StandardRenderSimpleBase`](../../../packages/mtw-wml/ts/standardize/render/index.ts) | A | Promotes document-end/start string tails to `<Space />` (keep; extend awareness of Space+br) |
| Inbound (Render -> Slate) | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | A (fixed) + B | Track A: boundary-aware trim preserves doc-start/end `{ Space }`; Track B: still strips Space adjacent to `{ br }` |
| Outbound (Slate -> Render) | [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) | A + B | Must emit `{ Space }` before/after `{ br }` when Slate paragraph has edge space |
| Tests | [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts), [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts), [`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts) | A + B | Encode old "strip break-adjacent space" policy |
| Slate normalize | [`constrainedWhitespace.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) | D | Collapse `\s{2,}` to one; cap at 2 in 2d |
| Tags / merge / diff | schema, [`standardRenderAdd`](../../../packages/mtw-wml/ts/standardize/render/index.ts), diff | C + D | No `DoubleSpace` / `DoubleBR`; interim `br, br`; `Space`+`Space` dropped |
| Inbound | [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | D | No `DoubleSpace` mapping |

**Working theory:** Hypothesis B (serialization / WML round-trip) for all tracks. Legacy Slate plugins (hypothesis A) are secondary for A--C; Track D also requires Slate normalize change (cap at 2).

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
| 2c | **Track C:** consecutive `<br />` / empty middle paragraph authoring round-trip | Complete (superseded by 2d; exploratory tangent) |
| 2d | **Atomic tags:** `<DoubleSpace />` (Track D) + `<DoubleBR />` (Track C); full pipeline | In progress (2d.3 Track D client complete; 2d.4 next) |
| 3 | Manual Workbench verification; durable docs | Not started |

## Links

| Doc / code | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task-plan conventions |
| [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md) | Vitest commands |
| [`README.taggedMessage.md`](../../../packages/mtw-wml/ts/README.taggedMessage.md) | Tagged-message whitespace rules |
| [`packages/mtw-wml/ts/standardize/render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) | `<Space />` / atomic double tags (Phase 2d) |
| [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) | Parse-time trim/compress |
| [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) | Inbound conversion |
| [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) | Outbound conversion |
| [`StandardRenderEditor.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx) | Editor sync loop |
| [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) | Target-semantics round-trip tests (Tracks A--D) |
| [`constrainedWhitespace.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) | Slate `\s{2,}` normalize (Track D -- cap at 2) |
| `@tonylb/mtw-base` schema / renderTree | New `DoubleSpace`, `DoubleBR` tag types (Phase 2d boilerplate) |
| [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx) | Parent-echo sync test |

## Getting Started

Read [`taskPlanning/AGENT.md`](../../AGENT.md) once.

1. **Read WML whitespace docs** -- understand why literal space before `<br />` is not enough ([`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md) Whitespace section).
2. **Read `compressWhitespace` tests** -- see current Space+br elimination ([`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts)).
3. **Read editor sync loop** -- [`useStandardRenderEditorHook`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.tsx).
4. **Testing** -- [`taskPlanning/charcoal-client/AGENT.development.md`](../../AGENT.development.md), [`charcoal-client/AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md).

5. **Baseline verification** (after 2d tag land, extend with DoubleSpace/DoubleBR tests)

For Phase 2d implementation, also read the **Phase 2d planning** section under Diagnosis record and [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) before editing merge/diff.

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
- [X] Track D: double space mid-line (`"Hello  world"`). -- `withConstrainedWhitespace` caps at 2; client outbound promotes closed `\s{2}` to `{ DoubleSpace }`; inbound maps back to two literal spaces (`whitespacePreservation.test.ts` Track D green).

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

**Track D -- mid-line insertion slot (`DoubleSpace`):**

```typescript
const slate = [{ type: 'paragraph', children: [{ text: 'Hello  world' }] }]
const render = descendantsToRender(standard)(slate)
// expect render.toJSON() like ['Hello', { tag: 'DoubleSpace' }, 'world']
const back = descendantsFromRender(render, { standard })
// expect back[0].children[0].text === 'Hello  world'
// WML: Hello<DoubleSpace />world survives parse -> print
// diff(['Hello world'], target).merge(base) === target
// Spike: <Description>Hello  world</Description> literal markup does NOT preserve \s{2}
```

**Track C migration -- `DoubleBR` (replaces interim `br, br` in storage/print):**

```typescript
const slate = [
  { type: 'paragraph', children: [{ text: 'First' }] },
  { type: 'paragraph', children: [{ text: '' }] },
  { type: 'paragraph', children: [{ text: 'Last' }] }
]
// expect outbound ['First', { tag: 'DoubleBR' }, 'Last']
// parse: First<br /><br />Last normalizes to First<DoubleBR />Last
```

### Trace layers

- [X] Track A: `descendantsFromRender` trim vs outbound `<Space />` from `descendantsToRender`. -- Outbound pass; inbound `trimParagraphBoundaries` + two additional strip points (see Phase 1 trace).
- [X] Track B: `compressWhitespace` + `standardRenderAdd` vs in-memory RenderTree. -- Schema load/print pass; merge/compress fail; client outbound/inbound fail.
- [X] Rule out Slate normalize for single trailing space. -- `withConstrainedWhitespace` only collapses `\s{2,}`; no `renderLeaf`/`decorate` in StandardRenderEditor paths (grep clean).

## Design constraints

1. **No visible whitespace decoration** in the editor.
2. **`<Space />` at document boundaries** -- unchanged semantics for field start/end.
3. **`<Space />` adjacent to `<br />`** -- Track B (authoring/storage); see [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md).
4. **`<DoubleSpace />`** -- closed-boundary mid-line insertion slot between string/link chunks (Track D). **Not** two adjacent `<Space />` tags.
5. **`<DoubleBR />`** -- closed-boundary empty middle paragraph between content strings (Track C target). **Not** two adjacent `<br />` in new storage/print (legacy normalizes on parse).
6. **Do not rely on literal multi-space in WML markup** -- use `<DoubleSpace />`; literal `Hello  world` in Description does not survive parse.
7. **Cap `\s{3,}` at two** in Slate (`withConstrainedWhitespace`); `\s{2}` is the editor insertion-slot shape. **Display** collapses `DoubleSpace` / `DoubleBR` for player-facing prose; **storage** keeps atoms.
8. **Gateway / lambda** -- grep shared render paths if tag surface expands.

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

### Track D + DoubleBR migration (Phase 2d -- atomic whitespace tags)

**Prerequisite insight:** Fragment merges must disambiguate join-compaction from structural slots without an intent flag. Atomic tags are the encoding; diff/subtract need **no** insertion-slot special cases beyond treating `DoubleSpace` / `DoubleBR` as opaque elements (do **not** add `DoubleSpace` to the `Space` string-peel equivalence in diff).

Recommended order:

#### 2d.1 -- Schema tag boilerplate (tedious but mechanical)

- [ ] Add `DoubleSpace` and `DoubleBR` to **`@tonylb/mtw-base`** schema / renderTree types (`isSchemaDoubleSpace`, `isSchemaDoubleBR`, legal tagged-message contents).
- [ ] [`taggedMessages.ts`](../../../packages/mtw-wml/ts/schema/converters/taggedMessages.ts) -- parse + print converters.
- [ ] [`StandardRenderDoubleSpace`](../../../packages/mtw-wml/ts/standardize/render/) / `StandardRenderDoubleBR` payload classes; wire [`render/index.ts`](../../../packages/mtw-wml/ts/standardize/render/index.ts) `payloadFactory`, `standardRenderAdd`, subtract, diff (opaque merge -- no compaction with adjacent `Space` / `br`).
- [ ] [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts) -- preserve atomic tags; **normalize legacy** `<Space /><Space />` -> `DoubleSpace`, `<br /><br />` -> `DoubleBR` on parse (cap one double unit).
- [ ] Spike test: literal `Hello  world` in Description does not round-trip `\s{2}`.

#### 2d.2 -- Migrate Track C to `<DoubleBR />`

- [ ] Outbound: empty middle paragraph emits `{ DoubleBR }` not `br, br`.
- [ ] Inbound: `{ DoubleBR }` -> three Slate paragraphs (replace `br, br` handling).
- [ ] Update Phase 2c tests + docs to target `DoubleBR`; keep legacy `<br /><br />` parse fixtures.
- [ ] Remove or simplify cap-at-2 consecutive `br` logic where superseded by atomic tag.

#### 2d.3 -- Track D `<DoubleSpace />` pipeline

- [X] `withConstrainedWhitespace` -- cap at 2 literal spaces (not collapse all `\s{2,}` to 1).
- [X] Outbound: promote `\s{2}` between string/link chunks to `{ DoubleSpace }` (constructor/merge path).
- [X] Inbound: `{ DoubleSpace }` -> two literal spaces in Slate; link-adjacent cases.
- [X] [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) Track D round-trip + parent echo.

#### 2d.4 -- Diff / merge verification

- [ ] `base.merge(base.diff(target)).equals(target)` for `['Hello world']` <-> `['Hello', DoubleSpace, 'world']`.
- [ ] Compaction: `['Hello', Space]` + merge fragment `[Space, 'world']` -> single space (no `DoubleSpace`).
- [ ] WML Replace round-trip: diff renders as `<Replace><Space />world</Replace><With><DoubleSpace />world</With>` (match leading space via constructor promotion).

#### 2d.5 -- Display + docs

- [ ] [`RenderTreeContent.tsx`](../../../charcoal-client/src/components/Message/RenderTreeContent.tsx) -- **single display pass** for player-facing prose: collapse `DoubleSpace` / `DoubleBR`; handle interim stored `br, br` until fully migrated; optional `messageParsing` if manual verify requires it. Storage unchanged.
- [ ] Update [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md), [`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md), [`README.taggedMessage.md`](../../../packages/mtw-wml/ts/README.taggedMessage.md), [`AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md).
- [ ] Interaction fixtures: `DoubleSpace` near `br` / Track B `Space`; `DoubleBR` with Track B paragraph-edge spaces.

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

- [X] **Phase 2c -- Track C (consecutive br / empty paragraph)**
  - [X] Add failing round-trip test: `[{ para: 'A' }, { para: '' }, { para: 'C' }]` survives outbound/inbound and WML `A<br /><br />C`.
  - [X] Stop collapsing `br` + `br` in `standardRenderAdd` for authoring merge paths (audit subtract/diff).
  - [X] Update `compressWhitespaceRun` to preserve up to two `br` in a contiguous run (cap at 2; additional consecutive breaks compress).
  - [X] Fix `descendantsToRender` to emit one `br` per Slate paragraph boundary including empty middle paragraphs (via merge fix; no code change needed).
  - [X] Update legacy `descendantsToRender.test.ts` empty-paragraph expectation; confirm inbound unchanged.
  - [X] Update durable docs (`render/AGENT.md`, syntax README) for consecutive `<br />` authoring rule (cap at 2).
  - Display-only collapse deferred to **Phase 2d.5** (covers interim `br, br`, `DoubleBR`, and `DoubleSpace` in one pass).

- [ ] **Phase 2d -- Atomic whitespace tags (`DoubleSpace`, `DoubleBR`)**
  - [X] **2d.1** Schema boilerplate: mtw-base types, taggedMessages converters, StandardRender payload classes, merge/diff/compress + parse alias normalize.
  - [X] **2d.2** Migrate Track C storage/print to `<DoubleBR />` (outbound, inbound, tests, docs); legacy `<br /><br />` parse.
  - [X] **2d.3** Track D `<DoubleSpace />` pipeline (Slate cap-at-2, outbound/inbound, whitespacePreservation tests).
  - [ ] **2d.4** Diff/merge round-trip fixtures (slot vs compaction cases).
  - [ ] **2d.5** Display collapse (`RenderTreeContent`, optional `messageParsing`) for `DoubleSpace` / `DoubleBR` and legacy interim shapes; durable docs + interaction fixtures.

- [ ] **Phase 3 -- Verify and close**
  - [ ] Manual Workbench checks (see Verification); confirm player-facing display after 2d.5 collapse.
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
| **`DoubleSpace` / `DoubleBR` display (Phase 2d)** | **Collapse** in player-facing render | Storage keeps atoms; display shows finished-prose spacing (one visible space / normal break) |

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

### Phase 2c implementation (2026-06-07) -- interim `br, br`; migrate to `DoubleBR` in 2d

**Approach (WML first, cap at 2):** `compressWhitespaceRun` walks whitespace runs left-to-right, emitting up to two `{ br }` tags with Track B Space rules (one Space per gap; multiple Spacers compress to one). `standardRenderAdd` allows `br`+`br` but drops a third consecutive `br`. Client outbound unchanged -- per-paragraph `br` seed in `descendantsToRender` plus merge fix yields `br, br` for empty middle paragraphs. Inbound unchanged.

**Interim note:** Delivers Track C round-trip but leaves merge/diff adjacency ambiguity. Phase 2d replaces storage/print with `<DoubleBR />` while keeping legacy `<br /><br />` parse alias.

**Files changed:**

- [`compressWhitespace.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts), [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts)
- [`render/index.ts`](../../../packages/mtw-wml/ts/standardize/render/index.ts), [`render/index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts)
- [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts), [`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts)
- [`render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md), [`README.syntax.md`](../../../packages/mtw-wml/documentation/README.syntax.md), [`README.taggedMessage.md`](../../../packages/mtw-wml/ts/README.taggedMessage.md), [`AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md)
- this plan

**No change:** [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts), [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts)

**Target-semantics tests after Phase 2c:**

| File | Pass | Fail |
| --- | --- | --- |
| [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts) | 16 (Track A + B + C) | 0 |
| [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx) (parent echo) | 4 | 0 |
| [`compressWhitespace.test.ts`](../../../packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.test.ts) | 17 | 0 |
| [`index.test.ts`](../../../packages/mtw-wml/ts/standardize/render/index.test.ts) | 68 | 0 |
| Legacy `StandardRenderEditor/` (86 tests total) | 86 | 0 |

**Track C layer status (post-2c):**

| Layer | Track C |
| --- | --- |
| WML `compressWhitespace` | Pass (cap at 2) |
| WML merge (`standardRenderAdd`) | Pass (cap at 2) |
| WML schema load/print | Pass |
| Client outbound (`descendantsToRender` + merge) | Pass |
| Client inbound (`descendantsFromRender`) | Pass (unchanged) |
| Client full round-trip | Pass |

**Deferred:** Leading empty paragraph at document start; 3+ consecutive empty paragraphs between content (capped on save). Display-only collapse moved to Phase 2d.5 (was optional under 2c).

### Phase 2d planning (2026-06-07, revised -- atomic tags)

**Trigger:** Unified editing-slot rule + merge/diff review. Adjacent duplicate tags (`Space, Space`, `br, br`) are **ambiguous in WML fragment merges** -- the same tokens compact or preserve depending on base shape, with no intent discriminator in edit syntax.

**Decision:** Introduce atomic **`<DoubleSpace />`** (Track D mid-line insertion slot) and **`<DoubleBR />`** (Track C empty middle paragraph). Slate/RenderTree translate to/from these at boundaries; WML storage and edits use single-element atoms.

**Why not cap-at-2 adjacent tags (supersedes earlier 2d draft):**

| Approach | Diff example | Problem |
| --- | --- | --- |
| Adjacent `Space, Space` | Replace `world` / `Space+world` | Merge collapses slot |
| `DoubleSpace` | Replace `Space+world` / `DoubleSpace+world` (after prefix peel) | Unambiguous atom |

**Phase 2c interim:** Shipped `br, br` cap-at-2; 2d migrates print/storage to `DoubleBR` with legacy parse alias.

**Diff / WML print:** `{ remove: [' world'], add: [DoubleSpace, 'world'] }` serializes to `<Replace><Space />world</Replace><With><DoubleSpace />world</With>` via existing leading-space promotion on match fragments -- no Replace-specific hack.

**Display:** Collapse `DoubleSpace` / `DoubleBR` in player-facing paths only; storage keeps atoms for authoring round-trip.

**Recommended order:** 2d.1 boilerplate -> 2d.2 DoubleBR migration -> 2d.3 DoubleSpace pipeline -> 2d.4 diff fixtures -> 2d.5 display + docs.

### Phase 2d.1 implementation (2026-06-07)

**Approach:** Add `DoubleSpace` and `DoubleBR` end-to-end in `@tonylb/mtw-base` and `packages/mtw-wml`. Retire Phase 2c cap-at-2 `br, br` merge/compress (2c was exploratory; superseded, not authoritative legacy). Parse-time alias: adjacent `<br /><br />` / `<Space /><Space />` in Description/Summary normalize to atomic tags during `compressWhitespaceRun`. Merge: adjacent primitive `Space`/`br` pairs compact; explicit atoms opaque.

**Files changed:**

- `packages/mtw-base/ts/schema/renderTree.ts`, `schema/index.ts`, `schema/tagType.ts`, `renderTree.ts` + tests
- `packages/mtw-wml/ts/schema/converters/taggedMessages.ts`, `printUtils.ts`
- `packages/mtw-wml/ts/schema/utils/schemaOutput/compressWhitespace.ts`, `compressWhitespace.test.ts`, `schemaOutputToString.ts`
- `packages/mtw-wml/ts/standardize/render/doubleSpace.ts`, `doubleBR.ts`, `index.ts`, `index.test.ts`
- Durable docs: `render/AGENT.md`, `README.taggedMessage.md`, `README.syntax.md`, `AGENT.testing.slate.md`
- this plan

**No change:** charcoal-client converters (`descendantsToRender` / `descendantsFromRender`) -- deferred to 2d.2/2d.3.

**Target-semantics tests after Phase 2d.1:**

| File | Pass | Fail |
| --- | --- | --- |
| `compressWhitespace.test.ts` | 22 | 0 |
| `index.test.ts` (WML) | 72 | 0 |
| `whitespacePreservation.test.ts` (client) | 13 (Tracks A+B) | 3 (Track C -- expected until 2d.2) |
| Legacy `StandardRenderEditor/` | 83 | 3 (Track C) |

**Track C client gap (intentional):** Client outbound still relies on merge `br+br`; WML merge now compacts to single `br`. 2d.2 restores Track C via explicit `{ DoubleBR }` outbound.

### Phase 2d.2 implementation (2026-06-07)

**Approach:** Client-only slice. Outbound detects empty-middle paragraphs (no substantive content between two content paragraphs) and seeds `{ DoubleBR }` instead of `{ br }`; merge drops the following paragraph's `br` seed after `DoubleBR`. Inbound maps `{ DoubleBR }` via two `pushParagraph(false)` calls (same Slate shape as legacy consecutive `br`). Legacy in-memory `[br, br]` inbound unchanged.

**Files changed:**

- [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) -- empty-middle detection + `DoubleBR` boundary seed
- [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) -- `isSchemaDoubleBR` handler
- [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts), [`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts), [`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts)
- [`AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md), this plan

**No change:** WML layer (2d.1 complete); `RenderTreeContent` display collapse (2d.5).

**Target-semantics tests after Phase 2d.2:**

| File | Pass | Fail |
| --- | --- | --- |
| `whitespacePreservation.test.ts` (client) | 17 (Tracks A+B+C) | 0 |
| Legacy `StandardRenderEditor/` | 88 | 0 |
| `StandardRenderEditor.test.tsx` (parent echo) | 4 | 0 |
| `compressWhitespace.test.ts` (WML) | 20 | 0 |
| `index.test.ts` (WML) | 72 | 0 |

**Track C layer status (post-2d.2):**

| Layer | Track C |
| --- | --- |
| WML `compressWhitespace` | Pass (legacy `br/br` -> `DoubleBR`) |
| WML merge (`standardRenderAdd`) | Pass (`DoubleBR` opaque) |
| WML schema load/print | Pass |
| Client outbound (`descendantsToRender`) | Pass (`DoubleBR` for empty middle) |
| Client inbound (`descendantsFromRender`) | Pass (`DoubleBR` + legacy `br, br`) |
| Client full round-trip | Pass |

### Phase 2d.3 implementation (2026-06-07)

**Approach:** Client-only slice. `withConstrainedWhitespace` caps `\s{3+}` at two (preserves `\s{2}` insertion-slot shape). Outbound splits closed-boundary `\s{2}` runs in text nodes and at text/link boundaries into explicit `{ DoubleSpace }` seeds before merge. Inbound maps `{ DoubleSpace }` to two literal spaces via `appendRawText` (bypasses `singleSpace` collapse); `preserveRawTextAppend` flag ensures the following string chunk merges without collapsing the slot.

**Files changed:**

- [`constrainedWhitespace.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.ts) -- cap at 2, not collapse all `\s{2,}`
- [`constrainedWhitespace.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/constrainedWhitespace.test.ts) (new)
- [`descendantsToRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.ts) -- `textToRenderSeeds` / `mergeRenderSeeds` for interior and link-adjacent promotion
- [`descendantsFromRender.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.ts) -- `isSchemaDoubleSpace` handler, `appendRawText`, `preserveRawTextAppend`
- [`whitespacePreservation.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/whitespacePreservation.test.ts), [`descendantsToRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsToRender.test.ts), [`descendantsFromRender.test.ts`](../../../charcoal-client/src/components/Editor/StandardRenderEditor/descendantsFromRender.test.ts), [`StandardRenderEditor.test.tsx`](../../../charcoal-client/src/components/Workbench/foundations/StandardRender/StandardRenderEditor.test.tsx)
- [`AGENT.testing.slate.md`](../../../charcoal-client/AGENT.testing.slate.md), this plan

**No change:** WML layer (2d.1 complete); diff/merge fixtures (2d.4); `RenderTreeContent` display collapse (2d.5).

**Target-semantics tests after Phase 2d.3:**

| File | Pass | Fail |
| --- | --- | --- |
| `whitespacePreservation.test.ts` (client) | 24 (Tracks A+B+C+D) | 0 |
| Legacy `StandardRenderEditor/` | 103 | 0 |
| `StandardRenderEditor.test.tsx` (parent echo) | 5 | 0 |
| `compressWhitespace.test.ts` (WML) | 20 | 0 |
| `index.test.ts` (WML) | 72 | 0 |

**Track D layer status (post-2d.3):**

| Layer | Track D |
| --- | --- |
| Slate normalize (`withConstrainedWhitespace`) | Pass (cap `\s{3+}` at 2) |
| WML `compressWhitespace` | Pass (explicit `DoubleSpace`; literal `\s{2}` not promoted on parse) |
| WML merge (`standardRenderAdd`) | Pass (`DoubleSpace` opaque) |
| WML schema load/print | Pass |
| Client outbound (`descendantsToRender`) | Pass (closed `\s{2}` -> `{ DoubleSpace }`) |
| Client inbound (`descendantsFromRender`) | Pass (`{ DoubleSpace }` -> two literal spaces) |
| Client full round-trip | Pass |

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
4. **Track C:** `"First"`, Enter (empty middle para), `"Last"`, blur, reload -- three paragraphs; WML shows `<DoubleBR />` between strings (legacy `<br /><br />` still parses).
5. **Track D:** `"Hello world"`, insert second space to make `"Hello  world"`, blur, reload -- double space visible in editor; WML shows `<DoubleSpace />`; player display shows single space between words.
6. **Diff sanity:** edit producing `<Replace><Space />world</Replace><With><DoubleSpace />world</With>` merges back to `"Hello  world"` in editor.

Grep sanity:

```bash
rg -n "renderLeaf|decorate" charcoal-client/src/components/Editor/StandardRenderEditor charcoal-client/src/components/Workbench/foundations/StandardRender
```
