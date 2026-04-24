# Semantic optionals: defensive programming (RenderTree and beyond)

Status: in progress (next: **`defaultedEquals`** per [**Intertwined execution order**](#intertwined-execution-order); **`StandardRender.equals`** is done in [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md)).

See [`taskPlanning/AGENT.md`](../../AGENT.md) for what belongs in a task plan versus durable package docs, checkbox conventions, and when to retire this file.

## Purpose

Eliminate spurious edits and inconsistent behavior when optional rich-text (and similar) fields treat **`undefined` (absent)** and **semantically empty** values (for example **`new StandardRender([])`**) as different at equality, diff, `isEmpty`, and persistence boundaries.

Grounding incident: asset-level **Summary** in Workbench authoring can debounce **updates from no summary to an empty render tree** because the baseline keeps `_summary === undefined` while the UI normalizes to `new StandardRender([])`, and `StandardForm.diff` assigns `incoming._summary` wholesale when the base has no `_summary`, without compacting an empty outcome to absent. Related: `StandardForm.isEmpty()` currently uses `Boolean(this._summary)`, so an empty `StandardRender` instance is wrongly treated as meaningful content; **`hasSummary` will use semantic emptiness** once `StandardRender.isEmpty()` exists (see **Decisions locked**).

## Open questions (Workbench summary sync)

This names the same scenario as the grounding incident above and as **Workbench summary sync** in [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md). It is not a separate mystery: resolution is **implementation** of **`StandardRender.equals`** / **`defaultedEquals`**, diff compaction, canonical **`_summary: undefined`** when vacuous, and replacing **`toJSON()`** reference checks in [`WorkbenchAssetEditForm`](../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx), per **Decisions locked**. Detailed checkbox work lives in **Recommended order** below and in the component-equals plan.

## Intertwined execution order

Shared sequencing with [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md). Implement in this order:

1. **`StandardRender.isEmpty`** — joint foundation (this plan **Recommended order**; component plan **Progress**).
2. **`StandardRender.equals`** — [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md); enables **`defaultedEquals`** tests that mix **`undefined`** and empty render.
3. **`defaultedEquals`** — this plan; ship alongside or immediately after **`StandardRender.equals`**.
4. **`StandardForm.isEmpty`** (semantic **`_summary`**) — this plan **before** **`StandardForm.equals`**.
5. **`StandardForm.equals`** — [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md).
6. **Client** ([`WorkbenchAssetEditForm`](../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) and similar) — this plan; use **`StandardRender.equals`** / **`defaultedEquals`** after step 3.

**Plan coordination** with the component-equals task plan is complete (this subsection and matching text there); implementation tasks remain.

## Target behavior (layers)

1. **`isEmpty` on semantic carriers**  
   Types such as `StandardRender` should report **true** when the value is **semantically vacuous**: informally, **merging or diffing it produces no observable change** versus an absent field (see **Decisions locked**). Plain `new StandardRender([])` must be empty; Remove/Replace shapes are empty when they are **no-op edits**, not merely when the nested tree is `[]`.

2. **`defaultedEquals(a, b)`**  
   A generic helper for types `D` with **`isEmpty`** and **`equals`**: treat **both** `undefined` **and** `isEmpty() === true` as the same "vacuous" class; two vacuous values compare equal; otherwise require `a.equals(b)` for two non-vacuous defined values. Use where optional **content** fields intentionally conflate absent and empty.

3. **Call sites**  
   Prefer `defaultedEquals` over `a?.equals(b)` **only** where the field is an optional semantic-content slot (not every optional reference or "missing row" sentinel). **Which** sites qualify is determined **during implementation** (see **Decisions locked**), not as a pre-implementation gate.

4. **Diff compaction**  
   After computing a field-level diff (including the **no base** branch that currently assigns `incoming` wholesale), if the **result** for that field is semantically empty (`isEmpty() === true`), set the field on the diff object to **`undefined`**. Per **Decisions locked**, **`undefined` on the patch means no change to that field** when merged; clearing an existing value is expressed with **`Remove`** (match = value to clear), preserving current behavior.

## Scope (initial)

- **Core:** [`packages/mtw-wml`](../../../packages/mtw-wml/) (`StandardRender`, `StandardForm.diff` / `isEmpty`, related standard types).
- **Client:** [`charcoal-client`](../../../charcoal-client/) Workbench paths that normalize `summary ?? new StandardRender([])` and write `_summary` without clearing to `undefined` when empty (for example [`WorkbenchAssetEditForm`](../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx)).
- **Follow-on:** **`StandardLiteral`**, **`ReferenceList`**, then facet lists, in that order (**Decisions locked**), after RenderTree is complete.

## Getting started

0. Preparatory task plan (**intertwined with this initiative**): [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md) (`equals` / `isEmpty` foundations on **`StandardComponent`**, **`StandardRender`**, **`StandardForm`**). Client summary sync (**Decisions locked**) **depends on** **`StandardRender.equals`** / **`defaultedEquals`** from that work; advance both tracks together rather than sequencing this plan in isolation.
1. Skim [`taskPlanning/AGENT.md`](../../AGENT.md) (durability and checklist rules).
2. Read [`packages/mtw-wml/ts/standardize/render/AGENT.md`](../../../packages/mtw-wml/ts/standardize/render/AGENT.md) and [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) for current StandardRender / StandardForm responsibilities.
3. Re-read the asset metadata diff and reducer path: [`packages/mtw-wml/ts/standardize/index.ts`](../../../packages/mtw-wml/ts/standardize/index.ts) (`diff`, `isEmpty`), [`charcoal-client/src/slices/personalAssets/reducers.ts`](../../../charcoal-client/src/slices/personalAssets/reducers.ts) (`updateStandard`).
4. For client test commands, use [`charcoal-client/AGENT.testing.md`](../../../charcoal-client/AGENT.testing.md) (Vitest). For package tests, run tests from [`packages/mtw-wml`](../../../packages/mtw-wml/) per that package's `package.json` scripts.

## Decisions locked

- **`StandardRender.isEmpty` (including Remove/Replace payloads):** Use the **no-op diff / merge** criterion, not "plain `[]` only." A value is empty when treating it as present would not change merged state relative to omitting the field (equivalently: the meaningful diff against an absent baseline is vacuous). This is the stronger defensive default for optional RenderTree fields.

- **`merge` and compacted diffs:** If a field on the diff/patch object is **`undefined`, `merge` treats that as no patch to that field** (leave the base value unchanged). **Clearing** a previously set field is **not** represented by `undefined` on the patch; it uses a **`Remove`** carrying the **match** value to remove (existing StandardForm / editable behavior). Diff compaction to `undefined` for vacuous outcomes preserves this contract.

- **Serialization: explicit empty vs omission:** No workflow requires serializing an **explicit empty** for **any** field as distinct from **omitting** the field. At the design level, **`undefined` / omission and semantically empty are equivalent**; when a representation must be chosen between equivalent options, **prefer `undefined` / omission** (current behavior and canonicalization goal). Compaction and client write paths should align with this.

- **`defaultedEquals` scope (process):** Do **not** require a complete upfront inventory classifying every call site before implementation. Reasonable approach: optionally **`rg` / spot-check** obvious candidates (optional RenderTree-backed fields, `?.equals` on semantic payloads); **resolve ambiguous cases while implementing** (pair or async review). Where helpful, a short comment at the call site can record why `defaultedEquals` applies or does not. Blind global replacement remains out of scope.

- **`StandardForm.isEmpty` and summary:** Once **`StandardRender.isEmpty()`** exists, **`hasSummary`** (inside **`StandardForm.isEmpty()`**) must use **semantic** emptiness: **`Boolean(this._summary && !this._summary.isEmpty())`** instead of **`Boolean(this._summary)`**. A vacuous **`StandardRender`** (for example empty plain `[]`) does **not** count as the asset having a summary for **`isEmpty()`** purposes.

- **Workbench summary sync (`toJSON()` !== bug):** Replacing reference comparison on **`toJSON()`** in [`WorkbenchAssetEditForm`](../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) **follows** the **`equals` / `defaultedEquals`** surface delivered by [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md). Do **not** choose **`deepEqual`** vs **`defaultedEquals`** solely inside this plan; use **`StandardRender.equals`** **and/or** **`defaultedEquals`** once available. **Execution order is intertwined:** **`StandardRender.isEmpty`**, **`StandardRender.equals`**, and **`defaultedEquals`** must reach a usable state together with—or immediately before—the client sync fix; **`StandardForm`** / diff compaction tasks here proceed in parallel where independent.

- **Follow-on `isEmpty` + `equals` rollout (after RenderTree):** Apply the same defensive pattern in this order: **(1)** **`StandardLiteral`**, **(2)** **`ReferenceList`**, **(3)** facet list types (**FacetLists** / generated facet lists as used in the codebase). Finish each tier before relying on it for the next.

## Progress

Aligned phase names with [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md) **Progress** (see [**Intertwined execution order**](#intertwined-execution-order)).

| Phase | Status |
| --- | --- |
| Plan coordination with component-equals | done |
| Component-equals: **`StandardComponent` `equals` audit** (line 82) | done ([inventory and sequencing](standardize/AGENT.componentEquals.planning.md#audit-findings-standardcomponentequals)) |
| `StandardRender.isEmpty` (+ tests) | done |
| `StandardRender.equals` (+ tests; component-equals plan) | done |
| `defaultedEquals` helper (+ tests) | not started |
| `StandardForm.diff` / `isEmpty` alignment | not started |
| Client: summary write path + sync | not started |
| Verification / regression tests | not started |
| Follow-on: **`StandardLiteral`** -> **`ReferenceList`** -> facet lists (**Decisions locked**) | in progress (**`StandardLiteral`** done in component-equals slice; next: **`ReferenceList`**. Generated facet lists already expose order-independent **`equals`** in [`facetListFactory.ts`](../../../packages/mtw-wml/ts/standardize/keys/facets/facetListFactory.ts)). |
| Durable doc updates (if any) + retire or archive this plan | not started |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you complete them so partial progress is visible.

- [X] Coordinate with [`standardize/AGENT.componentEquals.planning.md`](standardize/AGENT.componentEquals.planning.md) (**intertwined**). See [**Intertwined execution order**](#intertwined-execution-order) and [**Open questions (Workbench summary sync)**](#open-questions-workbench-summary-sync).
- [X] Add **`StandardRender.isEmpty()`** (and tests) using the **no-op diff / merge** criterion (see **Decisions locked**).
- [ ] Implement **`defaultedEquals`** in an appropriate shared module (likely under `packages/mtw-wml` or `packages/mtw-base`, per team preference) with unit tests. When wiring optional **`StandardRender`** fields on components, use the [**StandardComponent `equals` audit**](standardize/AGENT.componentEquals.planning.md#audit-findings-standardcomponentequals) (Room/Message/Mark/Lens/Example, etc.) so **`StandardRender.equals`** / **`defaultedEquals`** land with the right call sites.
- [ ] Refactor **`StandardForm.diff`** asset-level `_summary` / `_shortName` (and any parallel fields) so **vacuous outcomes** become **`undefined`**; add **`StandardForm.isEmpty`** checks that use semantic emptiness for `_summary`.
- [ ] While touching RenderTree optional fields, adopt **`defaultedEquals`** where the **optional content** contract clearly applies; flag unclear sites for quick review (per **Decisions locked** process).
- [ ] **Client:** align [`WorkbenchAssetEditForm`](../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) (and similar) so vacuous editor output maps to **`_summary: undefined`** (preferred canonical per **Decisions locked**); replace **`toJSON()`** reference sync with **`StandardRender.equals`** / **`defaultedEquals`** after the component-equals sub-task exposes them (**Decisions locked**).
- [ ] **Verification:** run `packages/mtw-wml` tests and targeted `charcoal-client` tests; grep for `Boolean(this._summary)` / `_summary ?` diff branches to ensure coverage.
- [ ] **Follow-on (after RenderTree track):** **`StandardLiteral`** [X], then **`ReferenceList`** [ ], then facet lists [ ] (**Decisions locked**).
- [ ] Move any **lasting** conventions into [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) or render AGENT doc; then archive or delete this plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

## Verification

- **`merge` contract:** Regression coverage that a patch with `_summary: undefined` (field absent or undefined) does **not** clear a previously set summary; clearing still flows through **`Remove`** / editable remove shape as today.
- **Canonical omission:** Round-trip or snapshot tests as appropriate: vacuous optional fields serialize as **omitted** / `undefined`, not redundant explicit empties (per **Decisions locked**).
- Unit tests for `StandardRender.isEmpty`, `defaultedEquals`, and `StandardForm.diff` / `isEmpty` on asset metadata with `undefined` vs empty render.
- Client: manual smoke on Workbench asset edit (open draft with no Summary, wait past debounce): local Redux / pending edit should not show a spurious summary-only delta when the editor is still empty (once compaction lands).
- Grep aids (adjust if naming changes):

```bash
rg "Boolean\\(this\\._summary\\)" packages/mtw-wml/ts/standardize/index.ts
rg "_summary \\?" packages/mtw-wml/ts/standardize/index.ts
rg "standardForm\\.summary \\?\\?" charcoal-client/src/components/Workbench
# Optional: candidates for defaultedEquals vs raw equals (inventory during implementation)
rg "\\.equals\\(" packages/mtw-wml/ts/standardize charcoal-client/src/components/Workbench
```

## Relationship to durable docs

Long-lived explanation of StandardForm merge/diff and serialization belongs in [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) after the task; this file should only hold process, ordering, and verification for the initiative.
