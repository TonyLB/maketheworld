# Component and form equality (`equals` / `isEmpty` foundations)

Status: in progress (next: **`StandardRender.equals`** (+ tests) alongside audit **`StandardComponent`** **`equals`** gaps per [**Intertwined execution order**](#intertwined-execution-order); **`StandardRender.isEmpty`** landed in parent plan).

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

## Progress

Aligned with [`../AGENT.semanticOptionalsDefensiveProgramming.planning.md`](../AGENT.semanticOptionalsDefensiveProgramming.planning.md) **Progress** (see [**Intertwined execution order**](#intertwined-execution-order)). The row **Wire parent plan** matches parent phases **`defaultedEquals`** and **Client: summary write path + sync**.

| Phase | Status |
| --- | --- |
| Plan coordination with parent | done |
| Audit existing **`equals`** on components + gaps | not started |
| **`StandardRender.isEmpty`** (with parent plan) **before** **`StandardRender.equals`** | done |
| **`StandardRender.equals`** (+ tests) | not started |
| **`StandardForm.isEmpty`** semantics (parent plan) **before** **`StandardForm.equals`** | not started |
| **`StandardForm.equals`** (+ tests) | not started |
| Wire parent plan: client sync / **`defaultedEquals`** consumers | not started (track completion in parent plan where appropriate) |
| Durable doc note in [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) + retire this plan when done | not started |

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as you complete them so partial progress is visible.

- [ ] Audit **`StandardComponent`** **`equals`** overrides and defaults; list types that need semantic fixes (references, nested payloads, **order-independent** imports / reference lists / facet lists per **Decisions locked**). Where **`isEmpty`** is added to a component type, implement **`isEmpty`** before **`equals`** (**Decisions locked**).
- [X] Complete **`StandardRender.isEmpty`** per parent plan [**Decisions locked**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md).
- [ ] Implement **`StandardRender.equals`** (delegating to editable payload **`equals`** / **`diff`** / **`isEmpty`** as appropriate).
- [ ] Align **`StandardForm.isEmpty()`** with semantic **`_summary`** (**parent plan**), **then** implement **`StandardForm.equals(incoming, options?)`** with **`optimizeByUniversalKey`** (**Decisions locked**); default behavior = full comparison unless optimization explicitly enabled.
- [ ] Add **`packages/mtw-wml`** unit tests for **`StandardRender.equals`**, **`StandardForm.equals`**, and representative components.
- [ ] Implement Workbench summary sync on the parent plan ([`WorkbenchAssetEditForm`](../../../../charcoal-client/src/components/Workbench/WorkbenchAssetEditForm.tsx), canonical **`_summary`**) using **`StandardRender.equals`** / **`defaultedEquals`** (see parent [**Open questions (Workbench summary sync)**](../AGENT.semanticOptionalsDefensiveProgramming.planning.md#open-questions-workbench-summary-sync) and **Decisions locked** in both plans; parent **Recommended order** tracks the same work).
- [ ] Copy **lasting** equality contracts into [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) if needed; archive or delete this plan per [`taskPlanning/AGENT.md`](../../../AGENT.md).

## Verification

- **`packages/mtw-wml`** test run passes after changes.
- New tests cover: **`undefined`** vs **`new StandardRender([])`** equality once **`defaultedEquals`** exists; two empty assets / same **`StandardForm`**; **`equals`** symmetric and reflexive on samples; **`StandardForm.equals`** cases that differ only in an unrelated component still fail equality; **`StandardForm.equals`** with **`optimizeByUniversalKey: true`** vs **false** / omitted where behavior differs; **order permutations** on imports, reference lists, and facet lists still **`equals` true** (**Decisions locked**); representative **`StandardRoom`** (or similar) **`equals`** exercises **all** significant fields.
- Grep aids:

```bash
rg "equals\\(incoming" packages/mtw-wml/ts/standardize/components --glob "*.ts"
rg "deepEqual\\(this\\.toJSON" packages/mtw-wml/ts/standardize/components/component.ts
rg "toJSON\\(\\) !==" charcoal-client/src/components/Workbench
```

## Relationship to durable docs

Permanent API descriptions for **`StandardForm.equals`** and **`StandardRender.equals`** belong in [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/standardize/render/AGENT.md`](../../../../packages/mtw-wml/ts/standardize/render/AGENT.md) after implementation; this file stays process-only.
