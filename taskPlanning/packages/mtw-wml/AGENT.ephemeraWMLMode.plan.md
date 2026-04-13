# Ephemera wire vs asset WML mode (`mtw-wml`)

**Status:** Active --- **not started**. **Intent:** Clarify **payload language** for ephemera **wire-transfer** WML versus **asset / blueprint** WML, before leaning on that split in [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md) and related perception work.

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

1. **`mode` parameter (Phase 1):** Optional constructor / factory argument on **`StandardForm`** and **`StandardComponent`** (or single shared options type threaded through standardize) with at least **`'asset'`** and **`'ephemeraWire'`** (exact names TBD). **Default** preserves **today's** behavior (treat as asset). **No** new tags in this step; ephemera-only tags still absent or still rejected everywhere until Phase 3 enables them under **`ephemeraWire`**.
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

- [ ] Define **`WmlStandardizeMode`** (or equivalent) in **`mtw-wml`** / **`mtw-base`** as appropriate; document default **`'asset'`**.
- [ ] Thread optional **`mode`** into **`StandardForm`** constructor and **`StandardComponent`** standardize entry points (exact API: constructor vs `fromSchema` options --- pick one consistent pattern and document).
- [ ] Ensure **asset** mode behavior matches **pre-change** behavior for all existing tests; add tests that **`ephemeraWire`** without new tags behaves like asset for current inputs.
- [ ] No **`Object`** (or other ephemera-only) tags accepted yet in either mode **or** reject in both until Phase 3 implements ephemera branch (choose explicitly in implementation notes).

**Phase 2 --- documentation**

- [ ] Update [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) (and related component docs) with **Asset vs ephemera wire** section: purpose, **`mode`**, forbidden tags in asset pipeline.
- [ ] Add a short pointer from [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md) if that file is the package index readers use first.

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
| Task plan (this file) | Done |
| Phase 1: `mode` plumbing | Not started |
| Phase 2: documentation | Not started |
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
| [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md) | WML test commands / patterns |
| [`taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/perception/AGENT.multiChannel.plan.md) | Downstream consumer (room channels) |
| [`taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md`](../../../taskPlanning/lambda/ephemera/dataSource/objects/AGENT.objectHandling.plan.md) | **`Meta::Room.objects`** context |

---

## Decisions log

| Topic | Decision |
| --- | --- |
| Plan path | **`taskPlanning/packages/mtw-wml/AGENT.ephemeraWMLMode.plan.md`** |
| Mode names | **`asset`** vs **`ephemeraWire`** (working names; finalize in Phase 1 PR) |
| Phase 1 scope | **`mode`** only; **no** ephemera-only tags until Phase 3 |

---

## When this task plan can retire

After Phases 1--3 and closeout: **`mode`** and **`<Object>`** rules live in **`mtw-wml`** / **`mtw-base`** docs and tests; ephemera task plans link here or to package docs. Archive or delete per [`taskPlanning/AGENT.md`](../../AGENT.md).
