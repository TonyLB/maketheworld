# Component and form equality (`equals` / `isEmpty` foundations)

Status: in progress (next: **`defaultedEquals`** (+ consumers) per [**Intertwined execution order**](#intertwined-execution-order), with parent plan; component **`equals`** audit is recorded under [**Audit findings (StandardComponent.equals)**](#audit-findings-standardcomponentequals); **`StandardRender.equals`** landed with **`isEmpty`** + **`_payload.diff`**).

See [`taskPlanning/AGENT.md`](../../../AGENT.md) for what belongs in a task plan versus durable package docs, checkbox conventions, and when to retire this file.

## Purpose

Add **semantic `equals`** (and **`isEmpty`** where missing and needed) across **`StandardComponent`** instances produced by the component factory, **`StandardRender`**, and **`StandardForm`**, so callers can compare domain objects **without** relying on **`toJSON()`** reference inequality or ad hoc **`deepEqual`** on serialized shapes. Each **`equals`** must cover the **full** semantics of its type (see **Decisions locked**).

This work is a **preparatory sub-task** for [`../AGENT.semanticOptionalsDefensiveProgramming.planning.md`](../AGENT.semanticOptionalsDefensiveProgramming.planning.md): **`defaultedEquals`**, **`StandardRender.isEmpty`**, diff compaction, and client sync all assume a single, correct notion of **same** vs **vacuous** at the type level.

## Relationship to parent initiative

- **Intertwined execution:** Client summary sync in [`WorkbenchAssetEditForm`](../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) **depends on** **`StandardRender.equals`** / **`defaultedEquals`** from this plan (see parent plan **Decisions locked**). Advance **`equals`** deliverables together with the parent initiative rather than strictly before or after.
- **Coordinates with:** Parent plan for **`StandardRender.isEmpty`** and **`StandardForm.isEmpty`** summary semantics; **`equals`** work follows **`isEmpty`** at each type (**Decisions locked**).
- **Workbench summary sync** matches parent [**Open questions (Workbench summary sync)**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md#open-questions-workbench-summary-sync) (same scenario as parent **Purpose** grounding incident).
- **Coordination checklist:** Parent [**Recommended order**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md#recommended-order) item "Coordinate with component-equals" is complete; both plans share [**Intertwined execution order**](#intertwined-execution-order).

## Intertwined execution order

Same sequencing as [`../AGENT.semanticOptionalsDefensiveProgramming.planning.md`](../AGENT.semanticOptionalsDefensiveProgramming.planning.md). Implement in this order:

1. **`StandardRender.isEmpty`** — joint foundation (parent plan **Recommended order**; this plan **Progress**).
2. **`StandardRender.equals`** — this plan; enables **`defaultedEquals`** tests that mix **`undefined`** and empty render.
3. **`defaultedEquals`** — parent plan; ship alongside or immediately after **`StandardRender.equals`**.
4. **`StandardForm.isEmpty`** (semantic **`_summary`**) — parent plan **before** **`StandardForm.equals`**.
5. **`StandardForm.equals`** — this plan.
6. **Client** ([`WorkbenchAssetEditForm`](../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx) and similar) — parent plan; use **`StandardRender.equals`** / **`defaultedEquals`** after step 3.

**Plan coordination** with the semantic-optionals task plan is complete (this subsection and matching text there); implementation tasks remain.

## Scope

| Area | Code direction |
| --- | --- |
| **`StandardComponent`** | Ensure factory-generated components expose **`equals(other: StandardComponent): boolean`** that compares **every meaningful field** on that component type (for example **`StandardRoom.equals`** covers the full **`StandardRoom`** payload, not a subset). Audit existing overrides vs default **`deepEqual(this.toJSON(), ...)`** in [`componentClassFactory`](../../../../packages/mtw-wml/ts/standardize/components/component.ts). Where a component type gains **`isEmpty`**, implement **`isEmpty`** **before** **`equals`** (**Decisions locked**). Add **`isEmpty`** only where the parent semantic-optionals plan requires it for a given payload type (may trail **`StandardRender`**). |
| **`StandardRender`** | Implement **`isEmpty`** first (see parent plan [**Decisions locked**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md)), then **`equals`**, so vacuity is defined before equality. |
| **`StandardForm`** | Align **`isEmpty()`** with semantic summary (**parent plan**) before adding **`equals`**. **`equals(incoming: StandardForm, options?: StandardFormEqualsOptions)`** (**Decisions locked**) uses **full** semantics: **all** asset-level metadata (**`_shortName`**, **`_summary`**, **`_topLevel`**, **`_metaData`**, etc.), **the same component reference set**, and **pairwise** **`component.equals`** for each matched component. Optional **`optimizeByUniversalKey`** does **not** weaken equality; it only selects a faster comparison path when safe. |

Out of scope for this task plan alone: **full execution** of every parent-plan client and diff change (track there).

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../AGENT.md).
2. Read [`packages/mtw-wml/ts/standardize/components/component.ts`](../../../../packages/mtw-wml/ts/standardize/components/component.ts) (default **`equals`** / **`diff`**), [`packages/mtw-wml/ts/standardize/components/baseClasses.ts`](../../../../packages/mtw-wml/ts/standardize/components/baseClasses.ts) (**`StandardComponent`** interface).
3. Read [`packages/mtw-wml/ts/standardize/index.ts`](../../../../packages/mtw-wml/ts/standardize/index.ts) (**`StandardForm`** shape, **`isEmpty`**, merge/diff touchpoints).
4. Read [`packages/mtw-wml/ts/standardize/render/index.ts`](../../../../packages/mtw-wml/ts/standardize/render/index.ts) (**`StandardRender`**).
5. Run tests from [`packages/mtw-wml`](../../../../packages/mtw-wml/) per **`package.json`** scripts.

## Decisions locked

- **Full semantic `equals`:** Comparison operators must match **full** type semantics. **`roomA.equals(roomB)`** means equality of **every** field that belongs to **`StandardRoom`** (subject to existing type-specific **`equals`** rules such as reference equality). **`assetA.equals(assetB, options?)`** means **all** asset metadata agrees, the asset has the **same component references** (identity of the component set / keys as defined by implementation), and **each** paired component passes **`componentA.equals(componentB)`**. There is no separate "summary-only" or weakened **`StandardForm.equals`** for convenience.

- **`StandardForm.equals` options:** Optional second argument **`options`**. Include **`optimizeByUniversalKey?: boolean`**. When **true**, the implementation may use **`universalKey`**-based fast paths where correct. When **false** or omitted, perform the **full** reference / lookup path so callers can force exhaustive comparison wherever **`universalKey`** is absent or not yet reliable on all components. Optimization does **not** change equality semantics when keys are complete. Export and document a small options type (for example **`StandardFormEqualsOptions`**) and defaults in package **`AGENT.md`**.

- **Call sites vs full `equals`:** Screens that keep **only** **`StandardRender`** in local state (for example asset **Summary** in Workbench) should compare with **`StandardRender.equals`** / **`defaultedEquals`** on that value pair because that is what they have—not because **`StandardForm.equals`** is partial. When the UI holds **two full** **`StandardForm`** instances, use **`StandardForm.equals`**. Replace **`toJSON()`** reference checks with these domain operations.

- **`isEmpty` before `equals`:** At **each** type where **both** are implemented or extended for this initiative, implement **`isEmpty`** **before** **`equals`** ( **`StandardRender`**, any **`StandardComponent`** that gains **`isEmpty`**, **`StandardForm`** after **`isEmpty`** matches parent semantics). **`equals`** may then treat vacuous values consistently with **`defaultedEquals`** and [**Decisions locked**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md).

- **Order-independent list equality:** Reordering is a **permissible variation** that does **not** change semantic content. **`equals`** must return **true** when the only differences are **order permutations** among: **imports** (within **`_metaData`** / schema import lists as modeled), **reference lists**, and **facet lists**. Implement comparisons as multiset / keyed-set equivalence (or stable sort then compare), not raw array index equality.

## Audit findings (StandardComponent.equals)

Inventory of classes from [`componentClassFactory`](../../../../packages/mtw-wml/ts/standardize/components/component.ts) in [`packages/mtw-wml/ts/standardize/components/`](../../../../packages/mtw-wml/ts/standardize/components/). Default **`equals`** is **`deepEqual(this.toJSON(), incoming.toJSON())`** in [`component.ts`](../../../../packages/mtw-wml/ts/standardize/components/component.ts) unless overridden.

**Facet list machinery (order-independent):** [`MarkFacetList`](../../../../packages/mtw-wml/ts/standardize/keys/facets/mark.ts) and [`LensMarkFacetList`](../../../../packages/mtw-wml/ts/standardize/keys/facets/lensMark.ts) use [`facetListClassFactory`](../../../../packages/mtw-wml/ts/standardize/keys/facets/facetListFactory.ts), which implements **`equals`**, **`merge`**, **`diff`**, and **`invert`**. List **`equals`** matches items in **set-like** fashion (order does not matter). Prefer **`this._marks.equals(incoming._marks)`** (or an empty **`diff`**) over **`deepEqual`** on **`marks.toJSON()`** when fixing component **`equals`**.

**Reference lists:** [`ReferenceList.diff`](../../../../packages/mtw-wml/ts/standardize/keys/referenceList.ts) is keyed by reference identity; overrides that end with **`!(list.diff(incoming)?.payload.length)`** already treat reference collection reordering as non-differences for that bucket.

Per-component summary:

- **StandardRoom** ([`room.ts`](../../../../packages/mtw-wml/ts/standardize/components/room.ts)): **Override.** Reference buckets (lens, features, guidance, characters, inline refs) via **`diff`**; exits/situations via **`diff`**. Still uses **`deepEqual`** on **`shortName?.toJSON()`**, **`objects`**, and **`render`**. **`render`** should use **`StandardRender.equals`** (and/or **`defaultedEquals`**) once available; **`objects`** may need an explicit order-independent policy if array order is not semantically meaningful. **Wrapper fields** (**`_key`**, **`universalKey`**, **`explicitParent`**, **`_from`**, **`_origin`**, **`_mapping`**) are **not** compared in this override (unlike default **`toJSON`** equality on the wrapper); document intent when tightening **full semantics** (**Decisions locked**).
- **StandardFeature**, **StandardKnowledge**: **Override.** **`examples`** via **`ReferenceList`** semantics + **`shortName`** via **`deepEqual`** of JSON. **`shortName`** ties to parent follow-on **`StandardLiteral`** semantic equality when that lands.
- **StandardMessage**: **Override.** **`rooms`** via **`ReferenceList.diff`**; **`description`** still **`deepEqual(toJSON)`** -- switch to **`StandardRender.equals`** once line 84 ships.
- **StandardMoment**: **Override.** **`messages`** via **`ReferenceList.diff`**; **`shortName`** compared via primitive from **`toJSON()`** -- align with **`StandardLiteral`** when that tier ships.
- **StandardMap**, **StandardCharacter**, **StandardImage**: **Default `equals` only.** Highest priority for new overrides: map **positions** / **images** arrays and character literals / image are sensitive to JSON ordering and lack semantic **`StandardRender`** / **`StandardLiteral`** comparison until those tiers exist.
- **StandardSituation**: **Override** but **`deepEqual(this.toJSON(), incoming.toJSON())`**. **`_marks`** is a **`MarkFacetList`** -- replace with **`this.marks.equals(incoming.marks)`** (or equivalent **`diff`**-empty check) plus literal comparison aligned with **`StandardLiteral`** follow-on.
- **StandardExample**, **StandardGuidance**: **Override** + **`deepEqual(toJSON)`**. Carry **`MarkFacetList`** via list **`equals`**; carry **`StandardRender`** fields (**`summary`**, **`description`**, instructions-only on guidance) via **`StandardRender.equals`** once available; literals via **`StandardLiteral`** follow-on.
- **StandardMark**, **StandardLens**: **Override** + **`deepEqual(toJSON)`**. **`StandardRender`** description and **`MarkFacetList`** / **`LensMarkFacetList`** should use type **`equals`** instead of serialized array order.

**`StandardForm` imports:** Not on **`StandardComponent`** classes; handle **order-independent imports** under future **`StandardForm.equals`** and parent diff work ([`index.ts`](../../../../packages/mtw-wml/ts/standardize/index.ts) **`_metaData`**).

**`isEmpty`:** Payloads for the types above already expose **`isEmpty`** where the codebase needed it; **no new `isEmpty`** from this audit. If a future fix adds **`isEmpty`** to a component type, implement it **before** changing **`equals`** (**Decisions locked**).

### Next implementation order (post-audit, line 84+)

1. Land **`StandardRender.equals`** (+ tests) in [`render/index.ts`](../../../../packages/mtw-wml/ts/standardize/render/index.ts).
2. Update **`equals`** on components that embed **`StandardRender`**: **StandardRoom**, **StandardMessage**, **StandardMark**, **StandardLens**, **StandardExample** (summary, description).
3. Replace **`deepEqual`** on **`MarkFacetList` / `LensMarkFacetList` JSON** with list **`equals`** on: **StandardSituation**, **StandardExample**, **StandardGuidance**, **StandardLens** (marks).
4. Add or replace **component-level `equals`** for **StandardMap**, **StandardCharacter**, **StandardImage** (today: factory default only).
5. Defer **literal-field** semantic **`equals`** to parent **Follow-on** **`StandardLiteral`** unless a small local fix is unavoidable.

## Progress

Aligned with [`../AGENT.semanticOptionalsDefensiveProgramming.planning.md`](../AGENT.semanticOptionalsDefensiveProgramming.planning.md) **Progress** (see [**Intertwined execution order**](#intertwined-execution-order)). The row **Wire parent plan** matches parent phases **`defaultedEquals`** and **Client: summary write path + sync**.

| Phase | Status |
| --- | --- |
| Plan coordination with parent | done |
| Audit existing **`equals`** on components + gaps | done (see [**Audit findings**](#audit-findings-standardcomponentequals)) |
| **`StandardRender.isEmpty`** (with parent plan) **before** **`StandardRender.equals`** | done |
| **`StandardRender.equals`** (+ tests) | done |
| **`StandardLiteral`:** **`isEmpty`** **then** **`equals`** (+ tests) | done |
| **`ReferenceList`:** **`isEmpty`** (where needed) **then** **`equals`** (+ tests) | done |
| **Facet lists** ([`facetListClassFactory`](../../../../packages/mtw-wml/ts/standardize/keys/facets/facetListFactory.ts) types): **`isEmpty`** (where needed) **then** **`equals`** / call-site cleanup (+ tests) | done (**`isEmpty`** now treats empty and ref=0-only lists as vacuous; list **`equals`** remains order-independent; component call sites now use facet-list **`equals`** in Situation/Example/Guidance/Lens with targeted regression tests) |
| **`StandardForm.isEmpty`** semantics (parent plan) **before** **`StandardForm.equals`** | done (`StandardForm.isEmpty` now treats semantic-empty `_summary` as vacuous; parent slice also compacts vacuous `_summary`/`_shortName` in `StandardForm.diff`) |
| **`StandardForm.equals`** (+ tests) | not started |
| Wire parent plan: client sync / **`defaultedEquals`** consumers | not started (track completion in parent plan where appropriate) |
| Durable doc note in [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) + retire this plan when done | not started |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you complete them so partial progress is visible.

- [X] Audit **`StandardComponent`** **`equals`** overrides and defaults; list types that need semantic fixes (references, nested payloads, **order-independent** imports / reference lists / facet lists per **Decisions locked**). Where **`isEmpty`** is added to a component type, implement **`isEmpty`** before **`equals`** (**Decisions locked**). Findings: [**Audit findings (StandardComponent.equals)**](#audit-findings-standardcomponentequals).
- [X] Complete **`StandardRender.isEmpty`** per parent plan [**Decisions locked**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md).
- [X] Implement **`StandardRender.equals`** (delegating to editable payload **`equals`** / **`diff`** / **`isEmpty`** as appropriate). **Shipped:** mutual **`isEmpty()`** for vacuity, then **`this._payload.diff(other._payload) === undefined`** when both non-vacuous (no separate payload **`equals`** on **`StandardRenderSimpleBase`**). Tests and note in [`packages/mtw-wml/ts/standardize/render/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/render/AGENT.md).
- [X] **`StandardLiteral`:** complete **`isEmpty`** (semantic vacuity per parent [**Decisions locked**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md)), **then** implement or update **`equals`** so literals match full semantics (replaces ad hoc **`deepEqual(toJSON)`** on literal-shaped fields in component **`equals`** audits). **Shipped:** `StandardLiteral.isEmpty`/`equals`, literal semantic tests, and representative component `equals` call-site updates/tests (Feature, Knowledge, Room, Message shortName, Moment).
- [X] **`ReferenceList`:** complete **`isEmpty`** where needed for optional reference collections, **then** implement or update **`equals`** (order-independent / keyed-set equivalence per **Decisions locked**; align with existing **`ReferenceList.diff`** touchpoints in component overrides). For per-reference comparator semantics, use existing **`sameKey`** identity matching and require equal **`ref`** counts.
- [X] **Facet lists** (types from [`facetListClassFactory`](../../../../packages/mtw-wml/ts/standardize/keys/facets/facetListFactory.ts) such as **`MarkFacetList`**, **`LensMarkFacetList`**, and other generated facet list classes): complete **`isEmpty`** where missing and required for optional facet payloads, **then** confirm or extend **`equals`** (factory already exposes order-independent **`equals`**; tighten any call sites still using **`deepEqual`** on **`toJSON()`** per [**Audit findings**](#audit-findings-standardcomponentequals)). **Shipped:** generated facet-list **`isEmpty`**, deterministic facet payload comparison (`deepEqual` over payload JSON), and component **`equals`** call-site cleanup for marks/lens marks.
- [ ] Implement **`StandardForm.equals(incoming, options?)`** with **`optimizeByUniversalKey`** (**Decisions locked**); default behavior = full comparison unless optimization explicitly enabled.
  - [X] Align **`StandardForm.isEmpty()`** with semantic **`_summary`** (**parent plan**), including vacuous metadata diff compaction for `_summary`/`_shortName`.
- [ ] Add **`packages/mtw-wml`** unit tests for **`StandardRender.equals`** (landed), **`StandardForm.equals`**, **`StandardLiteral`** (**`isEmpty`** / **`equals`**), **`ReferenceList`**, representative **facet list** types, and representative **`StandardComponent`** **`equals`** overrides.
- [ ] Implement Workbench summary sync on the parent plan ([`WorkbenchAssetEditForm`](../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx), canonical **`_summary`**) using **`StandardRender.equals`** / **`defaultedEquals`** (see parent [**Open questions (Workbench summary sync)**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md#open-questions-workbench-summary-sync) and **Decisions locked** in both plans; parent **Recommended order** tracks the same work).
- [ ] Copy **lasting** equality contracts into [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) if needed; archive or delete this plan per [`taskPlanning/AGENT.md`](../../../AGENT.md).

## Verification

- **`packages/mtw-wml`** test run passes after changes.
- New tests cover: **`undefined`** vs **`new StandardRender([])`** equality once **`defaultedEquals`** exists; two empty assets / same **`StandardForm`**; **`StandardRender.equals`** reflexive / symmetric / vacuous-family cases (see render tests); **`StandardLiteral`** and **`ReferenceList`** **`isEmpty`** / **`equals`** (including vacuity and **order permutations** on reference lists per **Decisions locked**); **facet list** **`equals`** (order-independent) and any new **`isEmpty`** behavior; **`equals`** symmetric and reflexive on samples where types ship **`equals`**; **`StandardForm.equals`** cases that differ only in an unrelated component still fail equality; **`StandardForm.equals`** with **`optimizeByUniversalKey: true`** vs **false** / omitted where behavior differs; **order permutations** on imports, reference lists, and facet lists still **`equals` true** (**Decisions locked**); representative **`StandardRoom`** (or similar) **`equals`** exercises **all** significant fields.
- Grep aids:

```bash
rg "equals\\(incoming" packages/mtw-wml/ts/standardize/components --glob "*.ts"
rg "deepEqual\\(this\\.toJSON" packages/mtw-wml/ts/standardize/components/component.ts
rg "toJSON\\(\\) !==" charcoal-client/src/components/Workbench
rg "\\.isEmpty\\(|\\.equals\\(" packages/mtw-wml/ts/standardize/literal --glob "*.ts"
rg "\\.isEmpty\\(|\\.equals\\(" packages/mtw-wml/ts/standardize/keys/referenceList.ts
rg "\\.isEmpty\\(|\\.equals\\(" packages/mtw-wml/ts/standardize/keys/facets --glob "*.ts"
```

## Relationship to durable docs

Permanent API descriptions for **`StandardForm.equals`** and **`StandardRender.equals`** belong in [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/standardize/render/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/render/AGENT.md) after implementation; this file stays process-only.
