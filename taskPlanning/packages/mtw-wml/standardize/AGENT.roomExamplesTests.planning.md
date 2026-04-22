# StandardRoom.examples test migration (Gate D companion)

Status: in progress. **D1-D5** decided (see table and **Recorded decisions**). **Product implementation** for **D1** (Room consumer: do not consume nested `Example`; remainder error) and **D2-D4** (types, ephemera cache, `exampleAssociatedFilter` tag sets) lands in parent [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) **Gate D**, not as an in-scope obligation of **this** test-only document. **This** plan records that policy and has contributors **rewrite tests and fixtures** (especially **D5**) so expectations stay valid today and **do not contradict** D1 once Gate D code ships. **Phase 3** (`packages/mtw-wml` schema + standardize test migration per **D5**) is **complete** as of **2026-04-22** (`tsc` + `npm test` green); **[`ts/standardize/index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts)** still contains some legacy **Room + nested Example** WML in large merge/diff-style blocks (see **Delta** under **Freeze**). **Phase 4** **`lambda/assets` (partial, 2026-04-22):** [`internalCache/assetData.test.ts`](../../../../lambda/assets/internalCache/assetData.test.ts), [`internalCache/componentData.test.ts`](../../../../lambda/assets/internalCache/componentData.test.ts), and [`componentExamples/exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts) use **D5** Situation-first Room fixtures; [`componentExamples/exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts) remains for the **Gate D / D4** slice (tag-set removal). Next step: **`lambda/ephemera`** Phase 4 line items, then **`charcoal-client`**, per **Recommended order**.

## Purpose and scope

This task plan tracks **unit and integration test updates** required before and during **Gate D** of [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md): removal of `_examples` / `examples` from `StandardRoom` / `StandardRoomData`, schema alignment, and dropping support for **nested `<Example>` under `<Room>`** in the standardized model.

**In scope**

- Test files and fixtures that assert Room `examples`, Room-wrapped Example WML, or serialized shapes that include Room `examples`.
- Decisions that **tests must encode** (legacy parse behavior, error messages, migration-on-load, etc.).
- Verification commands and grep inventories scoped to the test migration.

**Out of scope**

- Feature and Knowledge `examples` behavior and tests (see [`AGENT.featureKnowledgeExamples.planning.md`](AGENT.featureKnowledgeExamples.planning.md)).
- Runtime product code changes except where a test forces a **minimal** adjustment to a shared factory type (coordinate with the Room legacy plan owner).

**Relationship to other plans**

- Parent initiative: [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) (**Gate D**).
- This file is task-scoped and temporary per [`taskPlanning/AGENT.md`](../../../AGENT.md).

## Getting Started

1. Read [`taskPlanning/AGENT.md`](../../../AGENT.md) for durability, checklist conventions, and verification expectations.
2. Read **Gate D** in [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) for the code removal trigger and the high-level test callouts.
3. Skim WML orientation (avoid duplicating architecture here):
   - [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md)
   - [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md)
   - [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/components/AGENT.md)
4. For **exact** package test and typecheck commands, prefer [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) and package `package.json` scripts; for client tests see [`charcoal-client/AGENT.testing.md`](../../../../charcoal-client/AGENT.testing.md); for lambda subtrees, use local `AGENT.md` / `package.json` scripts where documented.
5. Use the root complex-task pattern where helpful: [`AGENT.md`](../../../../AGENT.md#getting-started-pattern-for-complex-tasks).

## Working assumptions

- Runtime Room paths already avoid `StandardRoom.examples` for correctness (see parent plan verification).
- **Single deployment, single author, post-migration authoring:** There is no separate production corpus or third-party asset base to migrate. Stored assets are minimal and were created without Room `examples`. **Gate C** remains satisfied for *this* system's data reality.
- `StandardFeature` and `StandardKnowledge` tests that use `examples` remain authoritative for non-Room behavior; do not weaken them when fixing Room fixtures.

### How that changes pursuit (same Gate D, less migration weight)

**Read this subsection carefully:** **D1** describes **future product behavior** agreed for **parent Gate D** (whoever implements [`StandardRoom`](../../../../packages/mtw-wml/ts/standardize/components/room.ts) / schema work there). It is **not** a checklist item to **implement D1 inside this test plan file** or to treat this initiative as "change `schemaFromParse` / schema converters first." This document's **in-scope** work is **tests and fixtures** (and inventories, verification, handoff text).

- **D1 (legacy WML) -- policy only here, code in parent Gate D:** The adopted **end state** is **ignore at parse** for the Room **standardize** consumer: **do not consume** nested `<Example>` into the Room model; unconsumed input follows the **consume / remainder** design and **surfaces an error** (not silent drop). No fold-into-situation migration. **Implementing** that behavior and updating durable WML docs when code matches are **parent Gate D** / `TBD(room-model)`; **this** plan ensures we **do not keep large suites asserting the opposite** (Room happily owning nested Examples as the supported path). After Gate D lands, a **small** optional set of tests can lock remainder behavior; see **Recorded decisions**.
- **Tests (what this plan actually does):** The bulk of work is **rewriting fixtures and expected outputs** that still encode deprecated grammar (`Room` + nested `Example`, `room.examples` in JSON where the test intent is prose or structure). Prefer **D5** shapes (`<Situation uuid=(DEFAULT)>`, etc.). **`ts/schema/index.test.ts` changes are edits to that test file** (WML strings and expected trees), **not** by default edits to schema **production** modules such as `schemaFromParse` unless the same PR explicitly merges that parent work. Tests that assert **schema or grammar forbids** Room-nested `Example` at the **validator** layer remain **parent Gate D** scope unless explicitly merged here; see **Test work split** under **Recorded decisions**.
- **Residual risk (low):** Git history, pasted WML in issues, or a future second environment. The narrow test coverage above is enough insurance without multi-corpus inventories.

## Decisions (record outcomes here)

All rows **D1-D5** are decided (see table and **Recorded decisions**). **D1** and **D2-D4** are **product-implementation-deferred to parent [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) Gate D**; **this** plan records decisions, migrates **tests/fixtures** to stay consistent with them, and tracks **when** to touch which tests as Gate D lands. Mark PR links in the table when slices merge.

| ID | Question | Options / notes | Decision | Owner |
| --- | --- | --- | --- | --- |
| D1 | Legacy WML: `<Room>...<Example>...</Example></Room>` | Reject at parse / schema; strip children; migrate-on-load into situation or `render`; other | **Ignore at parse (Gate D product work):** Room standardize path **does not consume** nested `Example`; consume/remainder **reports an error**. No migration fold. **This test plan:** align fixtures and expectations with that direction; **do not** treat D1 as requiring schema **module** edits here by default. | Project owner |
| D2 | Serialized JSON and `StandardRoomData` | Omit `examples` entirely vs keep read-only shim for one release | **Deferred to [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) Gate D:** omit `examples` from types/serialization when that code lands; this test plan does not choose shim vs hard-drop ahead of that slice. | Project owner |
| D3 | `ExamplesData` and ephemera tests that use `ROOM#...` as cache keys | Still valid keys for cache API vs tests should use Feature/Knowledge ids only | **Deferred to parent Gate D** (same plan): settle with ephemera/cache implementation in that PR, not as a standalone decision here. | Project owner |
| D4 | `lambda/assets/componentExamples/exampleAssociatedFilter` tag sets | Whether `Room` stays in `EXAMPLE_PARENT_TAGS` / `EXAMPLE_ASSOCIATED_TAGS` after Room drops `examples` | **Remove `Room`** from **`EXAMPLE_PARENT_TAGS`** and **`EXAMPLE_ASSOCIATED_TAGS`** once Room no longer participates in Example ownership. **Code + [`exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts)** ship in parent **Gate D**, not as a standalone pre-Gate-D test refactor. | Project owner |
| D5 | Schema tests (`schema/index.test.ts`) | Prefer rewriting fixtures to Situation/`Render` under Room vs minimal Room-only trees where Example moves to Feature parent | **Rewrite** to **`<Situation uuid=(DEFAULT)>`** (**`SITUATION#DEFAULT`**, from primitives [`initializePrimitives`](../../../../lambda/wml/dataSource/initializePrimitives/index.ts)). Prefer **Situation** over **Feature** for prose unless the test is Feature-specific; **`<Render>`** only when exercising render wire. Details: **Recorded decisions**. | Project owner |

### Recorded decisions

**D1 -- Legacy `<Room>...<Example>...</Example></Room>` (agreed, project owner)**

- **Policy (future steady state, implemented under parent Gate D):** **Ignore at parse** for the Room **standardize** consumer: nested `Example` tags are **not consumed** into `StandardRoom` / Room `examples` (which Gate D removes anyway). This is not a silent strip; by the **consume / remainder** design, **unconsumed remainder yields an error** so invalid legacy shape is visible to the author.
- **Non-goals:** No automatic fold of Example prose into default Situation or `render` on load.
- **What this test-migration plan does for D1:** **Before** D1 code ships, **remove or replace** fixtures that assume Room **successfully** models nested `Example` as supported authoring (rewrite per **D5** where the test intent allows). That is **expectation hygiene**, not implementing D1. **After** the parent slice implements D1, add or adjust a **small** set of cases that assert (1) nested Example is **not** modeled on the Room, and (2) the **standardize** path surfaces the **remainder error the implementation actually throws** (exact messages or error kinds are implementation-defined; lock what the code does). Those assertions **belong in the same PR as the D1 code change** or immediately after, coordinated with `TBD(room-model)`; they are **not** a substitute for rewriting the bulk of suites ahead of time.
- **What this plan does *not* own for D1:** Tests that assert `Example` is an **illegal** child of `Room` inside **`schemaFromParse`**, schema templates, or other **schema production** code paths unless that work is **explicitly merged** from parent Gate D into the same PR. Do not read the D1 bullet as "this initiative rewrites schema validators."
- **Docs:** When parser and schema match **in product code**, update the **Room `examples` (legacy)** guidance in [`packages/mtw-wml/ts/AGENT.md`](../../../../packages/mtw-wml/ts/AGENT.md) and linked standardize `AGENT.md` files so they no longer imply Room+Example remains a supported authoring shape (parent Gate D / doc owners).

#### Test work split (this companion plan vs parent Gate D)

- **This plan (for example Phase 3, `packages/mtw-wml` test migration):** The bulk of work is **fixture rewrites** per **D5** (replace Room-nested `<Example>` with supported shapes such as `<Situation uuid=(DEFAULT)>` / `<Render>` where the test intent allows). That is **in scope** here. **D1** is **not** "implement remainder behavior in this plan"; it is the **policy** those rewrites must **stay compatible with**. Optional **narrow** D1 **assertions** (remainder error, no Room examples from nested Example) ship **with** parent Gate D `StandardRoom` / pipeline changes, not as a freestanding obligation to edit schema **runtime** code from this file alone.
- **Parent [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) Gate D:** **D1 implementation**, **schema alignment**, **D2** type and serialization removal, and any tests that lock a **grammar or schema contract** in **production** schema code (for example that Room-nested Example is rejected at parse/schema, or never emitted by canonical paths) belong with that **code removal** slice. Coordinate so negative tests are not duplicated without intent; the companion plan stays **migration- and fixture-oriented** unless a checkbox explicitly adds schema forbids.

**D2 -- Serialized JSON / `StandardRoomData.examples` (deferred, project owner)**

- **For this test-refactor initiative:** No separate choice between omit vs read-only shim. **Leave** Room `examples` in fixtures and expectations **until** [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) **Gate D** removes the field from `StandardRoom` / `StandardRoomData` and consumers; then tests follow the implementation (including `charcoal-client` assertions such as `room.examples`).

**D3 -- `ExamplesData` and `ROOM#...` in ephemera tests (deferred, project owner)**

- **For this test-refactor initiative:** Do not pre-decide cache API shape here. **`ROOM#`** keys and related tests are **addressed alongside Gate D** product changes in the parent plan (ephemera/cache owners as for that PR).

**D4 -- `exampleAssociatedFilter` tag sets (decided; implementation in Gate D, project owner)**

- **Decision:** **`Room` is removed** from **`EXAMPLE_PARENT_TAGS`** and **`EXAMPLE_ASSOCIATED_TAGS`** when Gate D completes the Room / Example split: Room prose is **Situation** / **`render`**, not Example-backed.
- **Scope:** Implement the constant / helper changes and update [`exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts) **in the same Gate D slice** as the rest of Room `examples` removal, not as part of an earlier **tests-only** pass.

**D5 -- Schema tests / `schema/index.test.ts` fixtures (agreed, project owner)**

- **Preference:** When replacing **Room + nested `<Example>`** trees, **rewrite to `<Situation>`** under the Room (or as sibling structure the schema test is exercising), using the **canonical default situation** from **primitives**: **`<Situation uuid=(DEFAULT)>`** so universal id is **`SITUATION#DEFAULT`** (see [`lambda/wml/dataSource/initializePrimitives/index.ts`](../../../../lambda/wml/dataSource/initializePrimitives/index.ts), `FULL_PRIMITIVES_WML` and `hasDefaultSituation` check).
- **Rationale:** That situation exists **for** default room facet / prose behavior; tests should align with product authoring, not invent ad-hoc situation keys unless the case requires it.
- **`Render`:** Use **Situation** as the default rewrite target; add **`<Render>`** under Room only when the test is specifically about render / ephemera-wire shape, not as the default substitute for every former Example.

## Baseline test inventory (living)

Freeze dates and deltas here as slices land. Initial seed from parent plan **test-only references** plus follow-up grep; **re-run** inventories after each merge.

### Freeze (2026-04-22)

Counts use the same patterns, roots, and globs as [**Inventory commands**](#inventory-commands-copypaste) below (workspace ripgrep-equivalent search from repo root; multiline enabled for cmd 2).

| Cmd | Scope | Approx. match lines | Distinct files |
| --- | --- | ---: | ---: |
| 1 | `\.examples\b` in `packages/mtw-wml` `*.test.ts` | 89 | 5 |
| 2 | `<Room[^>]*>...<Example` multiline in `packages/mtw-wml` `*.test.ts` | 26 | 4 |
| 1b | Same as cmd 1, post **Phase 3** (**2026-04-22**) | ~87 | 5 |
| 2b | Same as cmd 2, post **Phase 3** (**2026-04-22**) | ~12 | 1 |
| 3 | `examples:\s*\[` or `examples:\s*\{` in `lambda/assets`, `lambda/ephemera`, `charcoal-client` `*.{test.ts,test.tsx}` | 44 | 8 |
| 4 | `tag: 'Room'` in `lambda/assets`, `lambda/ephemera` `*.test.ts` | 55 | 12 |

**Cmd 1 files:** [`room.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.test.ts), [`component.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/component.test.ts), [`index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts), [`feature.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/feature.test.ts), [`knowledge.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/knowledge.test.ts). The last two are **out of scope** for Room migration (retain for Feature/Knowledge authority).

**Cmd 2 files (freeze 2026-04-22):** [`room.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.test.ts), [`schema/index.test.ts`](../../../../packages/mtw-wml/ts/schema/index.test.ts), [`standardize/index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts), [`standardize/processComponents.test.ts`](../../../../packages/mtw-wml/ts/standardize/processComponents.test.ts).

**Cmd 2 files (post Phase 3, 2026-04-22):** [`standardize/index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts) only (remaining legacy Room+Example WML in large merge/diff-style fixtures; optional hygiene pass).

**Cmd 3 files:** `lambda/assets` -- [`internalCache/assetData.test.ts`](../../../../lambda/assets/internalCache/assetData.test.ts), [`internalCache/componentData.test.ts`](../../../../lambda/assets/internalCache/componentData.test.ts), [`componentExamples/exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts), [`componentExamples/exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts). `lambda/ephemera` -- [`internalCache/componentAssetMeta.test.ts`](../../../../lambda/ephemera/internalCache/componentAssetMeta.test.ts), [`internalCache/componentRender.test.ts`](../../../../lambda/ephemera/internalCache/componentRender.test.ts), [`internalCache/componentStackMerge.test.ts`](../../../../lambda/ephemera/internalCache/componentStackMerge.test.ts), [`internalCache/examples.test.ts`](../../../../lambda/ephemera/internalCache/examples.test.ts). **Charcoal-client:** 0 files for this literal (see **Delta**).

**Cmd 4 files:** `lambda/assets` -- [`internalCache/assetData.test.ts`](../../../../lambda/assets/internalCache/assetData.test.ts), [`internalCache/componentData.test.ts`](../../../../lambda/assets/internalCache/componentData.test.ts), [`characters/index.test.ts`](../../../../lambda/assets/characters/index.test.ts), [`contentHeaders/index.test.ts`](../../../../lambda/assets/contentHeaders/index.test.ts), [`componentExamples/index.test.ts`](../../../../lambda/assets/componentExamples/index.test.ts), [`componentExamples/reseedFromDiagnostics.test.ts`](../../../../lambda/assets/componentExamples/reseedFromDiagnostics.test.ts), [`componentExamples/exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts), [`componentExamples/exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts). `lambda/ephemera` -- [`dataSource/state/computeDefaultMarksForRoom.test.ts`](../../../../lambda/ephemera/dataSource/state/computeDefaultMarksForRoom.test.ts), [`internalCache/componentAssetMeta.test.ts`](../../../../lambda/ephemera/internalCache/componentAssetMeta.test.ts), [`internalCache/componentStackMerge.test.ts`](../../../../lambda/ephemera/internalCache/componentStackMerge.test.ts), [`internalCache/componentRender.test.ts`](../../../../lambda/ephemera/internalCache/componentRender.test.ts).

**Delta vs prior tables / parent [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) test-only list**

- **Added rows below:** [`processComponents.test.ts`](../../../../packages/mtw-wml/ts/standardize/processComponents.test.ts) (cmd 2); [`exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts) (cmd 3; mixed Room-negative and Feature/Knowledge cases from the parent **exampleEnrichment** slice).
- **Already tracked here but not in parent's short test-only bullet list:** [`schema/index.test.ts`](../../../../packages/mtw-wml/ts/schema/index.test.ts), [`internalCache/examples.test.ts`](../../../../lambda/ephemera/internalCache/examples.test.ts), [`layeredContextUtils.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.test.ts), [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) (parent Gate D text still references schema/room tests).
- **Cmd 4-only (Room-tagged tests, not necessarily `examples` fixtures):** [`characters/index.test.ts`](../../../../lambda/assets/characters/index.test.ts), [`contentHeaders/index.test.ts`](../../../../lambda/assets/contentHeaders/index.test.ts), [`componentExamples/index.test.ts`](../../../../lambda/assets/componentExamples/index.test.ts), [`componentExamples/reseedFromDiagnostics.test.ts`](../../../../lambda/assets/componentExamples/reseedFromDiagnostics.test.ts), [`dataSource/state/computeDefaultMarksForRoom.test.ts`](../../../../lambda/ephemera/dataSource/state/computeDefaultMarksForRoom.test.ts). Revisit if Gate D stubs or types ripple into these suites.
- **Charcoal-client cmd 3 gap:** [`Maps/Controller/index.test.tsx`](../../../../charcoal-client/src/components/Maps/Controller/index.test.tsx) uses `room.examples` (cmd 1-style `.examples` if you extend the pattern to `charcoal-client`) but does not match cmd 3's `examples: [` / `examples: {` literal. [`reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) contains nested `<Room>...<Example>` WML (same multiline pattern as cmd 2 under `charcoal-client` yields hits).
- **Post Phase 3 `mtw-wml` (2026-04-22):** Re-counted with workspace search (same patterns as **Inventory commands**). Cmd **1b** / **2b** rows in the table above replace cmd 1 / 2 counts for `packages/mtw-wml` only. [`schema/index.test.ts`](../../../../packages/mtw-wml/ts/schema/index.test.ts), [`room.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.test.ts), [`component.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/component.test.ts), and [`processComponents.test.ts`](../../../../packages/mtw-wml/ts/standardize/processComponents.test.ts) no longer match cmd 2 multiline Room+Example; [`standardize/index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts) still does (~12 match groups).
- **Post Phase 4 `lambda/assets` partial (2026-04-22):** Cmd **3** re-count for `examples:\s*\[|examples:\s*\{` under `lambda/assets`, `lambda/ephemera`, `charcoal-client` test globs: **~38** match lines, **6** distinct files (`lambda/assets`: **8** lines in **2** files -- [`exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts), [`exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts); `lambda/ephemera` unchanged from prior freeze; `charcoal-client`: **0** files for this literal). [`internalCache/assetData.test.ts`](../../../../lambda/assets/internalCache/assetData.test.ts) and [`internalCache/componentData.test.ts`](../../../../lambda/assets/internalCache/componentData.test.ts) no longer use that literal.

### `packages/mtw-wml`

| File | Kind | Notes |
| --- | --- | --- |
| [`ts/schema/index.test.ts`](../../../../packages/mtw-wml/ts/schema/index.test.ts) | Migrated (Phase 3) | Room prose fixtures use **D5** (`<Situation uuid=(DEFAULT)>` / `SITUATION#DEFAULT`); Feature/Knowledge `Example` cases retained where applicable. |
| [`ts/standardize/components/room.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.test.ts) | Migrated (Phase 3) | Nested Room `Example` WML replaced with **Situation** or JSON `examples` where the test targets reference APIs only. |
| [`ts/standardize/components/component.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/component.test.ts) | Migrated (Phase 3) | Room `removeReferences` delegation uses **StandardRoomData** JSON, not Room+Example WML. |
| [`ts/standardize/index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts) | Partial | Core edit-tag / parsed-schema / round-trip slices updated to **D5**; large merge/diff fixtures may still embed legacy Room+Example WML (cmd **2b**). |
| [`ts/standardize/processComponents.test.ts`](../../../../packages/mtw-wml/ts/standardize/processComponents.test.ts) | Migrated (Phase 3) | Room pipeline strings use **Situation**; Feature `Example` coverage unchanged where required. |

### `lambda/assets`

| File | Kind | Notes |
| --- | --- | --- |
| [`internalCache/assetData.test.ts`](../../../../lambda/assets/internalCache/assetData.test.ts) | Migrated (Phase 4 partial, **2026-04-22**) | Dynamo mocks built from **`StandardRoom` WML** with **`<Situation uuid=(DEFAULT)>`**; no Room `examples` / nested Example round-trip |
| [`internalCache/componentData.test.ts`](../../../../lambda/assets/internalCache/componentData.test.ts) | Migrated (Phase 4 partial, **2026-04-22**) | Stacked-asset Room rows use **situation** facets instead of nested `Example` |
| [`componentExamples/exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts) | Behavior | Update with **Gate D** when **D4** removes `Room` from tag sets |
| [`componentExamples/exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts) | Mixed | Room fixture uses **D5** WML (**Situation**); Feature/Knowledge `examples:` literals unchanged (**cmd 3** partial **2026-04-22**) |

### `lambda/ephemera`

| File | Kind | Notes |
| --- | --- | --- |
| [`internalCache/componentAssetMeta.test.ts`](../../../../lambda/ephemera/internalCache/componentAssetMeta.test.ts) | Fixtures | `examples` on mixed component records |
| [`internalCache/componentRender.test.ts`](../../../../lambda/ephemera/internalCache/componentRender.test.ts) | Fixtures | Room stubs still carrying `examples` fields |
| [`internalCache/componentStackMerge.test.ts`](../../../../lambda/ephemera/internalCache/componentStackMerge.test.ts) | Fixtures | `examples: []` on room-shaped rows |
| [`internalCache/examples.test.ts`](../../../../lambda/ephemera/internalCache/examples.test.ts) | API semantics | `ROOM#...` as `ExamplesData` cache key |

### `charcoal-client`

| File | Kind | Notes |
| --- | --- | --- |
| [`src/components/Maps/Controller/index.test.tsx`](../../../../charcoal-client/src/components/Maps/Controller/index.test.tsx) | Assertions | `room.examples.payload` length |
| [`src/components/Workbench/foundations/LayeredContext/layeredContextUtils.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.test.ts) | Regression | Room Example negative path (likely keep; ensure compiles after type removal) |
| [`src/slices/personalAssets/reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) | WML fixtures | Room containing Example (confirm with inventory search when slicing) |

### Inventory commands (copy/paste)

Re-baseline from repo root as needed. **If `rg` is not available in your shell**, use your editor's **regex search** (e.g. Cursor or VS Code) with the **same patterns**, scoped to the **same roots and globs** as each command; for the `<Room...<Example` pattern, enable **multiline** / allow matches across newlines so it matches the `--multiline` behavior below.

```bash
rg "\.examples\b" packages/mtw-wml --glob "*.test.ts"
rg "<Room[^>]*>[\s\S]{0,200}<Example" packages/mtw-wml --glob "*.test.ts" --multiline
rg "examples:\s*\[|examples:\s*\{" lambda/assets lambda/ephemera charcoal-client --glob "*.{test.ts,test.tsx}"
rg "tag:\s*'Room'" lambda/assets lambda/ephemera --glob "*.test.ts" -n
```

## Progress

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 1 | Record decisions D1-D5 | Complete | **D1-D5** recorded; **D2-D4** implementation deferred to parent **Gate D** |
| 2 | Refresh test inventory in this doc | Complete | Freeze **2026-04-22** under **Baseline test inventory**; re-baseline after **Gate D** when **D2-D4** test fixtures or tag-set tests must change |
| 3 | Migrate `mtw-wml` tests (schema + standardize) | Complete | **D5** rewrites landed in `schema/index.test.ts`, `room.test.ts`, `component.test.ts`, `processComponents.test.ts`, and key `standardize/index.test.ts` paths; `tsc` + package `npm test` green **2026-04-22**. Residual: **`index.test.ts`** still matches cmd 2 multiline pattern (~12 groups); optional follow-up before Gate D. **D1** remainder negatives still coordinated with parent Gate D. |
| 4 | Migrate lambda test fixtures | In progress | **`lambda/assets` partial (2026-04-22):** internal cache + **exampleEnrichment** migrated per **D5**; **`exampleAssociatedFilter.test.ts`** deferred to **D4** / Gate D. **`lambda/ephemera`** not started. |
| 5 | Migrate charcoal-client tests | Not started | Maps, reducers, layered context |
| 6 | Final verification and parent plan Gate D handoff | Not started | Link PR, update parent checklist |

## Recommended order

Use `[ ]` for pending and `[X]` for completed work. Mark each nested line `[X]` as it is completed so partial progress is visible.

- [X] **Decisions and policy**
  - [X] Resolve **D1** (legacy `<Room><Example>`) **as a recorded policy** for parent Gate D: **ignore at parse** (non-consume; remainder error). See **Recorded decisions**. (Implementing D1 in product code is **not** a deliverable of this markdown file.)
  - [X] Resolve **D2**: **deferred** to parent **Gate D** (see **Recorded decisions**); tests follow type removal when it lands.
  - [X] Resolve **D3**: **deferred** to parent **Gate D** (see **Recorded decisions**).
  - [X] Resolve **D4**: **remove `Room` from tag sets**; **implementation + tests** in parent **Gate D** (see **Recorded decisions**).
  - [X] Resolve **D5** (schema test fixture strategy): **Situation** with **`SITUATION#DEFAULT`** / `<Situation uuid=(DEFAULT)>` from primitives; see **Recorded decisions**.
- [X] **Freeze inventory for this initiative**
  - [X] Run **Inventory commands**; paste or summarize hit counts and notable files into **Baseline test inventory** (append date).
  - [X] Diff against parent plan list; add any new files discovered.
- [X] **`packages/mtw-wml` test migration (prefer: update `schema/index.test.ts` fixtures and expected trees where they feed standardize tests, before or in tandem with standardize suite edits; D1 does *not* require schema *module* changes in this track by default)**
  - [X] [`ts/schema/index.test.ts`](../../../../packages/mtw-wml/ts/schema/index.test.ts): replace or adjust Room+Example **test** fixtures and expectations per **D5** (and so they do not assume deprecated Room+Example as the supported story); keep non-Room Example coverage intact.
  - [X] [`ts/standardize/components/room.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.test.ts): remove or replace `examples` / `_examples` assertions tied to nested Room `Example`; add **narrow** remainder / negative cases **when coordinated with parent Gate D D1 implementation** (same PR or immediate follow-up), not as a substitute for bulk D5-style rewrites.
  - [X] [`ts/standardize/components/component.test.ts`](../../../../packages/mtw-wml/ts/standardize/components/component.test.ts): Room-specific Example cases only.
  - [X] [`ts/standardize/index.test.ts`](../../../../packages/mtw-wml/ts/standardize/index.test.ts): room-nested Example JSON/schema tests; retain Feature/Knowledge parallels. (Residual cmd-2-style Room+Example WML in large integration blocks is tracked in **Baseline test inventory** **Delta**.)
  - [X] [`ts/standardize/processComponents.test.ts`](../../../../packages/mtw-wml/ts/standardize/processComponents.test.ts): Room+Example WML in process pipeline tests (freeze **2026-04-22**).
  - [X] `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit` and `packages/mtw-wml` `npm test` green for touched suites.
- [ ] **`lambda/assets` test migration** (partial **2026-04-22**; complete when **D4** lands for associated-filter tests)
  - [X] [`internalCache/assetData.test.ts`](../../../../lambda/assets/internalCache/assetData.test.ts)
  - [X] [`internalCache/componentData.test.ts`](../../../../lambda/assets/internalCache/componentData.test.ts)
  - [X] [`componentExamples/exampleEnrichment.test.ts`](../../../../lambda/assets/componentExamples/exampleEnrichment.test.ts): verify or adjust `examples:` fixtures without weakening Feature/Knowledge coverage (freeze **2026-04-22**).
  - [ ] [`componentExamples/exampleAssociatedFilter.test.ts`](../../../../lambda/assets/componentExamples/exampleAssociatedFilter.test.ts) when parent **Gate D** implements **D4** (remove `Room` from tag sets); **do not** update tests before production tag sets change.
  - [X] Targeted Jest runs from `lambda/assets` for modified files (`npx jest internalCache/assetData.test.ts internalCache/componentData.test.ts componentExamples/exampleEnrichment.test.ts`).
- [ ] **`lambda/ephemera` test migration**
  - [ ] [`internalCache/componentAssetMeta.test.ts`](../../../../lambda/ephemera/internalCache/componentAssetMeta.test.ts)
  - [ ] [`internalCache/componentRender.test.ts`](../../../../lambda/ephemera/internalCache/componentRender.test.ts)
  - [ ] [`internalCache/componentStackMerge.test.ts`](../../../../lambda/ephemera/internalCache/componentStackMerge.test.ts)
  - [ ] [`internalCache/examples.test.ts`](../../../../lambda/ephemera/internalCache/examples.test.ts) when parent **Gate D** settles **D3** / cache semantics
  - [ ] Targeted Jest runs from `lambda/ephemera` for modified files.
- [ ] **`charcoal-client` test migration**
  - [ ] [`src/components/Maps/Controller/index.test.tsx`](../../../../charcoal-client/src/components/Maps/Controller/index.test.tsx): update `room.examples` assertions when **Gate D** removes the field (**D2**).
  - [ ] [`src/slices/personalAssets/reducers.test.ts`](../../../../charcoal-client/src/slices/personalAssets/reducers.test.ts) and any other hits from inventory grep.
  - [ ] Confirm [`layeredContextUtils.test.ts`](../../../../charcoal-client/src/components/Workbench/foundations/LayeredContext/layeredContextUtils.test.ts) still matches Room Example negative behavior after types change.
  - [ ] Targeted Vitest/Jest per package convention for modified files.
- [ ] **Handoff**
  - [ ] Re-run **Inventory commands**; confirm Room test bucket is empty or intentionally documented (e.g. negative tests only).
  - [ ] Update [`AGENT.roomExamplesLegacy.planning.md`](AGENT.roomExamplesLegacy.planning.md) **Gate D** checkboxes and test-only list when parent code removal lands.
  - [ ] Archive or delete this plan per [`taskPlanning/AGENT.md`](../../../AGENT.md) when the initiative completes.

## Verification (slice-level)

After each substantive merge:

1. `packages/mtw-wml`: `npx tsc -p packages/mtw-wml/tsconfig.json --noEmit` and `cd packages/mtw-wml && npm test` (or scoped `npx jest <path>`).
2. `lambda/assets` / `lambda/ephemera`: run Jest for touched test files (see area docs for exact commands).
3. `charcoal-client`: run Vitest/Jest for touched test files per [`charcoal-client/AGENT.testing.md`](../../../../charcoal-client/AGENT.testing.md).
4. Re-run **Inventory commands** and update the living inventory table.

## Owner placeholders

- `TBD(test-migration)` - owns execution of Recommended order, **fixture and test expectation** updates (**D5** bulk, inventories, verification); aligns suites so they **do not contradict** future **D1** behavior.
- `TBD(room-model)` - owns **D1** implementation and **Gate D** type/schema removal (**D2** follows code); owns durable doc updates when product behavior matches **D1**.
- `TBD(ephemera-contract)` - owns **D3** with `ExamplesData` / cache semantics in the **Gate D** ephemera slice.
- `TBD(assets-component-examples)` - owns **D4** (`exampleAssociatedFilter` + tests) in the **Gate D** `lambda/assets` slice.
