# Ephemera wire vs asset WML mode (`mtw-wml`)

**Status:** Active --- **in progress** (Phases 1--2 complete for **`mtw-wml`** docs and mode plumbing; Phase 3 **`Object`** not started). **Intent:** Clarify **payload language** for ephemera **wire-transfer** WML versus **asset / blueprint** WML, before leaning on that split in [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md) and related perception work.

**Framework:** Executable task plan per [`taskPlanning/AGENT.md`](../../AGENT.md) (status, **Getting Started**, **Progress**, **Recommended order** checkboxes, **Verification**).

---

## Purpose

Today ephemera sometimes **reuses authoring shapes** (for example **`<Example>`** under **`Room`**) for **transport** that is not semantically an example. That obscures contracts and encourages ad hoc reuse of blueprint patterns.

This plan introduces an explicit **`mode`** (or equivalent discriminant) on **`StandardForm`** and **`StandardComponent`** construction / standardization so that:

1. **Asset mode** remains strict: **no** ephemera-only tags; invalid wire-only input **errors** at parse or standardize boundaries.
2. **Ephemera wire mode** accepts an extended vocabulary for **runtime** payloads (starting with **`<Object>`** after the plumbing exists).

**Phase 1** adds **`mode`** with **no** new tags yet (behavioral default matches current asset semantics). **Phase 2** documents the division in WML docs. **Phase 3** adds **`<Object>`** as the first **ephemera-only** tag and wires tests plus cross-links to ephemera / multi-channel docs as needed.

---

## Getting Started

Read in order (or skim **Recommended order** first if resuming):

1. [`taskPlanning/AGENT.md`](../../AGENT.md) --- checkbox and durability conventions.
2. [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) and [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.md) --- `StandardForm`, component standardize pipeline.
3. [`packages/mtw-wml/ts/schema/converters/components.ts`](../../../packages/mtw-wml/ts/schema/converters/components.ts) --- schema tag conversion (where new tags surface).
4. [`packages/mtw-base/ts/schema/components.ts`](../../../packages/mtw-base/ts/schema/components.ts) --- `Schema*` tag unions ( **`Object`** will extend here in Phase 3).
5. [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) --- room-render vs room-affordances (consumer of clearer wire vocabulary).

---

## Goals

1. **`mode` parameter (Phase 1):** Optional **`standardizeMode`** on **`StandardForm`** via second constructor arg **`StandardFormConstructionOptions`**; thread through **`processComponents`**, **`standardComponentFactory`**, and **`fromSchema(node, context?)`** (**`StandardizeFromSchemaContext`**) using **`WmlStandardizeMode`** (**`'asset'`** | **`'ephemeraWire'`**). **Default** preserves **today's** behavior (**`'asset'`** via **`DEFAULT_WML_STANDARDIZE_MODE`**). **No** new tags in this step; ephemera-only tags still absent or still rejected everywhere until Phase 3 enables them under **`ephemeraWire`**.
2. **Documentation (Phase 2):** Update WML / standardize **AGENT** docs (and root [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) if appropriate) to describe **asset vs ephemera wire**, where **`mode`** is passed, and that ephemera-only tags **must not** appear in blueprints.
3. **`<Object>` tag (Phase 3):** Add schema + converter + standardize support **only** when **`mode === 'ephemeraWire'`** (or chosen name); **asset** path **errors** on **`Object`**. Align payload shape with ephemera **`Meta::Room.objects`** / [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md) string handles as needed.
4. **Tests and contracts:** Unit tests in **`packages/mtw-wml`** for mode gating; link from [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) and/or [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) once behavior is normative.

---

## Non-goals (this plan)

- Replacing **`<Example>`** transport usage in ephemera in one shot (can be a follow-on once **`Render`** or situation-only wire is designed).
- Full **`<Render>`** tag or full migration of redundant Example payloads (optional later tasks).
- Client UI work beyond what is needed to **parse** and type-check **`Object`** in ephemera messages (may be minimal in Phase 3).

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]` (capital **X**). Mark each line as you go.

**Phase 1 --- `mode` plumbing, no new tags**

- [X] Define **`WmlStandardizeMode`** (or equivalent) in **`mtw-wml`** / **`mtw-base`** as appropriate; document default **`'asset'`**. **Done:** [`packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts`](../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts) (`'asset' | 'ephemeraWire'`, **`DEFAULT_WML_STANDARDIZE_MODE`**, **`isWmlStandardizeMode`**); re-exported from [`packages/mtw-wml/ts/standardize/index.ts`](../../../packages/mtw-wml/ts/standardize/index.ts); tests in **`wmlStandardizeMode.test.ts`**.
- [X] Thread optional **`standardizeMode`** (**`WmlStandardizeMode`**, default **`DEFAULT_WML_STANDARDIZE_MODE`**) through **`StandardForm`** and component standardization. **Decisions are fixed** (no further API choice during implementation):
  - **Public entry (pattern A):** **`StandardForm`** accepts optional **`options?: StandardFormConstructionOptions`** (includes **`standardizeMode?: WmlStandardizeMode`**) on **all** constructor overloads; resolved mode persisted on **`standardizeMode`**; **`withStandardizeMode`**, **`_clone`**, **`StandardFormData`**, **`toJSON`** (omit when **`'asset'`**), **`assureComponents`** wired. **Done:** [`packages/mtw-wml/ts/standardize/index.ts`](../../../packages/mtw-wml/ts/standardize/index.ts), [`components/dataTypes/index.ts`](../../../packages/mtw-wml/ts/standardize/components/dataTypes/index.ts).
  - **Single-component WML (same options type):** **`componentClassFactory`**-generated **`Standard*`** classes accept the same optional second argument **`options?: StandardFormConstructionOptions`** when constructing from a WML string or schema node; WML/schema branch calls **`fromSchema(node, resolveStandardizeFromSchemaContext(options?.standardizeMode))`**. Subclasses with custom **`constructor`** forward **`options`** to **`super`**. **Done:** [`packages/mtw-wml/ts/standardize/components/component.ts`](../../../packages/mtw-wml/ts/standardize/components/component.ts) and hand-written subclasses (**`character`**, **`room`**, **`example`**, **`guidance`**, **`situation`**, **`worldState`**, **`StandardMark`**, **`StandardLens`**).
  - **Propagation (pattern C):** **`processComponents`** threads **`standardizeMode`** on props recursively; **`standardComponentFactory`** passes context into **`fromSchema`**. Payload **`fromSchema(node, context?)`** and facet **`fromSchema(node, ref, context?)`** updated. **Done:** [`processComponents.ts`](../../../packages/mtw-wml/ts/standardize/processComponents.ts), [`componentFactory.ts`](../../../packages/mtw-wml/ts/standardize/componentFactory.ts), payload / facet implementations.
  - **Documentation (minimal in Phase 1):** Threading and constructor notes in [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) (**Payload vocabulary vs semantic mode** section). Phase 2 may add package index / component doc pointers.
- [X] Ensure **asset** mode behavior matches **pre-change** behavior for all existing tests; add tests that **`ephemeraWire`** without new tags behaves like asset for current inputs. **Done:** full **`packages/mtw-wml`** **`npm test`** green on default **`asset`**; **`index.test.ts`** **`describe('standardizeMode')`** covers default, constructor **`ephemeraWire`**, **`toJSON`**; **`wmlStandardizeMode.test.ts`** covers resolvers. Phase 1 design: no new tags, so **`ephemeraWire`** does not widen parse outcomes yet (see **`standardize/AGENT.md`**); no dedicated side-by-side snapshot asserting identical schema under both modes (optional follow-up).
- [X] No **`Object`** (or other ephemera-only) tags accepted yet in either mode **or** reject in both until Phase 3 implements ephemera branch (choose explicitly in implementation notes). **Done:** Phase 3 not started; tag set unchanged.

**Phase 2 --- documentation**

- [X] Update [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) (and related component docs) with **Asset vs ephemera wire** section: purpose, **`mode`**, forbidden tags in asset pipeline. **Done:** **`## Payload vocabulary vs semantic mode (`standardizeMode`)`** plus constructor overload note; Phase 1 parity sentence (no parse delta until ephemera-only tags).
- [X] Extend [`packages/mtw-wml/ts/standardize/components/AGENT.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.md) with a short cross-link to **`standardize/AGENT.md`** for **`standardizeMode`** / single-component **`options`** (optional polish). **Done:** paragraph after **IMPORTANT** in Overview.
- [X] Add a short pointer from [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) if that file is the package index readers use first. **Done:** bullet under **Standardize** in directory structure.

**Phase 3 --- `<Object>` ephemera-only tag**

- [ ] Extend **`mtw-base`** schema with **`Object`** tag type (attributes / children as agreed; minimal v1: enough to carry ephemera object **handles** / ids).
- [ ] **`mtw-wml`**: parse / print / standardize **`Object`** only under **`ephemeraWire`**; **asset** path throws or reports structured error.
- [ ] Unit tests: asset rejects **`Object`**; ephemeraWire accepts and round-trips (or standardizes to expected shape).
- [ ] Cross-links: update [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) or [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md) to cite **ephemera wire** + **`Object`** when those teams emit WML.

**Closeout**

- [ ] Update **Progress** and **Recommended order** in this file after merge; move enduring rules into package **`AGENT.md`** as appropriate; archive or delete this plan per [`taskPlanning/AGENT.md`](../../AGENT.md).

---

## Progress

| Milestone | Status |
| --- | --- |
| Task plan (this file) | Done (this update reflects Phase 1 complete) |
| Phase 1: `mode` plumbing | **Done** (`WmlStandardizeMode`, **`StandardForm`** + factory + **`fromSchema`** threading, generated **`Standard*`** optional second **`options`**, tests) |
| Phase 2: documentation | **Done** (`standardize/AGENT.md`, `standardize/components/AGENT.md`, package `AGENT.md`) |
| Phase 3: `<Object>` + tests + contract links | Not started |
| Closeout | Not started |

---

## Verification

From repository root:

```bash
cd packages/mtw-wml
npm test
```

Scope while iterating:

```bash
cd packages/mtw-wml
npx jest path/to/relevant.test.ts
```

If **`mtw-base`** types change:

```bash
cd packages/mtw-base
npm test
```

**Manual / grep checks (after Phase 3):**

- Grep: **`ephemeraWire`** (or chosen mode name) appears next to **`StandardForm`** / standardize docs.
- Grep: **`Object`** schema guard exists; asset pipeline tests fail on sample **`Object`** WML.

---

## Links

| Doc / code | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](../../AGENT.md) | Task plan framework |
| [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) | Standardize index |
| [`packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts`](../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.ts) | **`WmlStandardizeMode`** type, default **`asset`**, runtime guard |
| [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) | WML test commands / patterns |
| [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md) | Downstream consumer (room channels) |
| [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md) | **`Meta::Room.objects`** context |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| Plan path | **`taskPlanning/packages/mtw-wml/AGENT.ephemeraWMLMode.plan.md`** |
| Mode names | **`asset`** vs **`ephemeraWire`** (encoded as **`WmlStandardizeMode`** in **`mtw-wml`**) |
| `WmlStandardizeMode` placement | **`mtw-wml`** only (not **`mtw-base`**); orthogonal to **`StandardFormSemanticMode`** |
| Phase 1 scope | **`mode`** only; **no** ephemera-only tags until Phase 3 |
| **`standardizeMode` threading** | **Public:** optional **second** arg **`StandardFormConstructionOptions`** on **`StandardForm`** (pattern A). **Same** optional second arg on **`componentClassFactory`**-generated **`Standard*`** for WML/schema construction. **Implementation:** **`processComponents`** props + **`standardComponentFactory`** + **`fromSchema(node, context?)`** / facet **`fromSchema(node, ref, context?)`** with **`StandardizeFromSchemaContext`** (pattern C); persist **`standardizeMode`** on **`StandardForm`**. |

---

## When this task plan can retire

After Phases 1--3 and closeout: **`mode`** and **`<Object>`** rules live in **`mtw-wml`** / **`mtw-base`** docs and tests; ephemera task plans link here or to package docs. Archive or delete per [`taskPlanning/AGENT.md`](../../AGENT.md).
