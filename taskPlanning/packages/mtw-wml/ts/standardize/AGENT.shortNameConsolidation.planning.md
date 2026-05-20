# shortName consolidation - planning

**Status:** Phase 1 complete. **Next:** Phase 2.1 -- implement `componentDisplayLabel` in mtw-wml.

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability, checkboxes, verification). **Dispose** after the initiative ships and lasting semantics live in [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (new **shortName** section) and any client doc updates.

---

## Goal

Treat **`shortName` as a first-class, platform-wide optional field on every `StandardComponent`**, with **one implementation pattern** and **one display-label contract**, instead of thirteen copy-pasted payload blocks and ad hoc client fallbacks.

**Non-goals:**

- Replacing **`StandardForm` (Asset) `_shortName`** (asset title metadata).
- Merging **Character `displayName`** into `shortName` (they serve different roles).
- Modeling **ephemera `<Object><ShortName>`** as a `StandardComponent` (parallel wire shape on Room only).
- Requiring `shortName` on every non-empty component (stay **omission-over-empty**).

---

## Context (current state)

Assessment (May 2026) found:

| Layer | State |
| --- | --- |
| **Data types** | All 13 `StandardComponent` tags expose optional `shortName` in `dataTypes/*` and `StandardComponentNonEditData`. |
| **`StandardComponent` interface** | Declares `shortName?: StandardLiteral` on [`baseClasses.ts`](../../../../../packages/mtw-wml/ts/standardize/components/baseClasses.ts). |
| **Implementations** | Payloads use [`shortNameField.ts`](../../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts); wrapper `shortName` delegates via `componentClassFactory`. |
| **`HasShortName` / `hasShortName()`** | **Removed** (Phase 1.4). `StandardComponent.shortName` is the contract. **`hasDisplayName`** remains (Character-only field not on `StandardComponent`). |
| **Client** | Repeated `component.shortName?._payload?.plain?.toJSON()` with ad hoc fallbacks; some paths still use `key` or a **universalKey suffix** (opaque uuid fragment). [`getComponentDisplayName`](../../../../../charcoal-client/src/slices/contentHeaders/selectors.ts) exists only in charcoal-client. |
| **Stale UI** | [`ComponentSelectorDialog`](../../../../../charcoal-client/src/components/Workbench/foundations/ComponentSelector/ComponentSelectorDialog.tsx) still special-cases Situation with a "Future: shortName" comment; [`situationIdToLabel`](../../../../../charcoal-client/src/lib/situationLabel.ts) already prefers shortName. |

**Identity model (steady state):** Stable identity is **`universalKey`**; **`key`** is optional WML sugar; **`shortName`** is the human-facing anchor for UI, maps, breadcrumbs, content headers, and prompts where a readable label is needed.

---

## Getting Started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md) once for task-plan conventions.
2. Read steady-state architecture (link, do not duplicate here):
   - [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) (StandardForm role, test layout, refactor gate)
   - [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (per-tag content properties; will gain **shortName** section in Phase 3)
   - [`packages/mtw-wml/ts/standardize/components/abstract.ts`](../../../../../packages/mtw-wml/ts/standardize/components/abstract.ts) (keep `HasDisplayName`; `HasShortName` removed in 1.4)
3. Skim one **reference implementation** and one **minimal** one:
   - Feature or Knowledge: full shortName + situations pattern
   - Image or Moment: shortName-only payload
4. Skim client label call sites (grep `shortName` under `charcoal-client/` and `lambda/assets/contentHeaders/`).
5. **Command authority:** Jest from `packages/mtw-wml` per [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md). Charcoal-client tests when touching UI: `cd charcoal-client && npm test` (or project convention in root [`AGENT.md`](../../../../../AGENT.md)).
6. **Baseline (before edits):**

```bash
cd packages/mtw-wml
npm test -- ts/standardize/index.test.ts ts/standardize/integration/ \
  ts/standardize/components/*.integration.test.ts
```

---

## Decision points (resolved for this initiative)

These were open questions after the assessment; defaults below are **binding for this task** unless explicitly revisited in PR review.

| Topic | Decision |
| --- | --- |
| **Universal on `StandardComponent`?** | **Yes, de jure.** Coverage is already 13/13; work is **consolidation and contracts**, not adding the field to new tags. |
| **Required vs optional?** | **Optional** everywhere (omission-over-empty). No schema or `isEmpty()` change that forces shortName for existence. Editors may still mark fields "required" in UX (e.g. Character) without model enforcement. |
| **Character `displayName` vs `shortName`** | **Keep both.** `shortName` = authoring / UI tag (Workbench "Short Name"). `displayName` = in-world character name. See **Label fallback chain** for precedence. |
| **Situation labels** | **shortName wins** when non-empty; else marks-summary (`situationToMarksSummary` / `situationIdToLabel`). Selector and breadcrumbs must use the same precedence. |
| **Label fallback chain** | Human-readable sources only, in order: **shortName** -> **displayName** (Character, via `hasDisplayName`) -> **key** (optional; `includeKeyFallback` default **true**) -> **Situation marks-summary** when `standardForm` is passed. **Do not** fall back to **universalKey** or uuid suffixes (not human-readable). If nothing matches: return **`undefined`**. Callers that need a string pass **`fallbackLabel`** (e.g. `'Untitled'`) in options, or apply their own default at the call site. |
| **`hasShortName()` guard** | **Remove.** No production callers; one test assertion replaced with `component.shortName` (or non-empty check). Dead `hasShortName` imports in integration tests cleaned up. Do **not** extend the `instanceof` list. |
| **`HasShortName` interface / `implements`** | **Remove.** Redundant with `StandardComponent.shortName`. Payloads use shared shortName helpers without a marker interface. **`hasDisplayName` / `HasDisplayName` unchanged** (still needed for Character). |
| **Implementation strategy** | **Phase 1:** Introduce shared helper(s) in `components/` (e.g. `shortNamePayload.ts`: factory functions for merge/toJSON/fromJSON consumer, optional `isEmpty` contribution). Migrate payloads **incrementally** (Room + Feature first, then remainder). **Do not** change serialized JSON shape. |
| **Wrapper `get shortName()`** | Prefer **`componentClassFactory` exposes `get shortName()`** delegating to payload when payload satisfies a small interface, to drop 13 duplicate wrapper getters. If factory change is too risky in one PR, keep wrapper getters until Phase 1b. |
| **Display label API** | Add **`componentDisplayLabel(component, options?)`** returning **`string | undefined`** on **`@tonylb/mtw-wml`** ([`standardize/index.ts`](../../../../../packages/mtw-wml/ts/standardize/index.ts)). Options: `standardForm` (Situation marks-summary), `includeKeyFallback` (default **true**), `fallbackLabel?: string` (when set, return this instead of `undefined` when the chain is empty). Charcoal-client migrates call sites; replace today’s universalKey-suffix and bare-uuid patterns with `fallbackLabel: 'Untitled'` or explicit local defaults where product context differs (e.g. map layers). |
| **Asset `StandardForm.shortName`** | **Out of scope** except cross-link in durable doc (asset title != component shortName). |
| **Room `objects[].shortName`** | **Out of scope**; document as ephemera-only parallel in implementation AGENT. |
| **Message / Moment / Image UI** | **Phase 2 optional:** add minimal shortName fields in Workbench only if product wants parity; **not** blocking Phase 1. Data layer already supports them. |
| **contentHeaders grouping** | **Out of scope** for this task (navigator omits Mark/Lens/Situation/etc.); file separate issue if needed. Header projection already passes `shortName` via [`extractHeaderComponent`](../../../../../lambda/assets/contentHeaders/index.ts). |

---

## Progress

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Decisions recorded (this doc) | Done |
| 1 | mtw-wml: shared shortName payload + factory getter + remove vestigial guards + tests | Done |
| 2 | Export `componentDisplayLabel`; migrate charcoal-client + lambda header paths | Not started |
| 3 | Durable doc in `AGENT.implementation.md`; remove stale comments; dispose task plan | Not started |

---

## Recommended order

Mark pending work `[ ]` and completed work `[X]` (including nested bullets).

### Phase 1 - mtw-wml consolidation

- [X] **1.1** Add shared shortName payload utilities (new module under `components/`, [`shortNameField.ts`](../../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts)):
  - [X] `createShortNameFromJSON` / `shortNameToJSON` / `mergeShortName` / `invertShortName`
  - [X] `shortNameSchemaChildren` for `nestedSchema`
  - [X] `standardizeShortNameConsumer()` returning `StandardizeConsumerStandardLiteral` config
- [X] **1.2** Migrate **two** reference payloads (Feature, Image) to prove pattern; run Layer 0 tests for those tags.
  - Image: added payload `invert()` (required for shortName diff); Layer 0 shortName tests added. Image `equals` undefined-vs-empty parity with Feature deferred (no wrapper override).
- [X] **1.3** Migrate remaining payloads (Room, Knowledge, Character, Map, Message, Moment, Situation, Guidance, Mark, Lens).
  - All 11 payloads use [`shortNameField.ts`](../../../../../packages/mtw-wml/ts/standardize/components/shortNameField.ts) helpers for fromJSON/fromSchema/merge/invert/schema/toJSON.
  - **Message:** fixed `invert()` to include shortName (was omitted). Added merge/diff shortName Layer 0 tests in `message.test.ts`.
  - **Mark:** `shortNameSchemaChildren` replaces `nestedSchema({ tag: 'ShortName' })` (equivalent output; worldState tests pass).
  - Room ephemera `objects[].shortName` unchanged (out of scope).
- [X] **1.4** Remove vestigial shortName typing artifacts:
  - [X] Delete `hasShortName()` from [`standardize/index.ts`](../../../../../packages/mtw-wml/ts/standardize/index.ts) (and `HasShortName` import there)
  - [X] Delete `HasShortName` from [`abstract.ts`](../../../../../packages/mtw-wml/ts/standardize/components/abstract.ts); drop `implements HasShortName` from all payloads
  - [X] Fix [`situation.integration.test.ts`](../../../../../packages/mtw-wml/ts/standardize/components/situation.integration.test.ts) to assert on `situation.shortName` directly
  - [X] Remove unused `hasShortName` imports from `integration/standardForm.*.test.ts` files
- [X] **1.5** Add factory-level `get shortName()` on `componentClassFactory` when payload has shortName getter (remove duplicate wrapper getters if safe).
  - Added `get shortName()` on [`component.ts`](../../../../../packages/mtw-wml/ts/standardize/components/component.ts); removed 12 duplicate wrapper getters; factory test in `component.test.ts`.
- [X] **1.6** Add Layer 0 or integration test: **every** `StandardComponent` tag round-trips `<ShortName>` in minimal WML snippet.
  - [`shortNameRoundTrip.test.ts`](../../../../../packages/mtw-wml/ts/standardize/components/shortNameRoundTrip.test.ts) (12 component tags; parameterized matrix).
- [X] **1.7** Grep cleanup: no new direct `_payload._shortName` assignments outside tests/editors (document exceptions for workbench `updateStandard` if still needed).
  - Documented allowed assignments in [`AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) shortName bullet.

### Phase 2 - display label contract

- [ ] **2.1** Implement `componentDisplayLabel` in mtw-wml per **Label fallback chain** (returns `undefined` when empty unless `fallbackLabel` set; no universalKey suffix).
- [ ] **2.2** Unit tests for label precedence: Character (shortName / displayName / both / neither), Situation (shortName vs marks-summary), key fallback on/off, `fallbackLabel: 'Untitled'` vs `undefined`.
- [ ] **2.3** Migrate charcoal-client: `WMLComponentHeader`, `WorkbenchContainer` breadcrumbs, `getComponentDisplayName`, `ComponentSelectorDialog.getDisplayName`, map layers, exit editor - use shared helper.
- [ ] **2.4** Fix stale Situation comment in `ComponentSelectorDialog`; align with `situationIdToLabel` precedence.
- [ ] **2.5** (Optional) Message / Moment / Image Workbench shortName fields - only if requested during Phase 2 PR.

### Phase 3 - durable documentation and close-out

- [ ] **3.1** Add **"shortName (platform contract)"** section to [`AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md): identity vs label, optional semantics, Character dual fields (`hasDisplayName` for displayName only), ephemera Object exception, link to `componentDisplayLabel`; note that **`hasShortName` was removed** as redundant with `StandardComponent`.
- [ ] **3.2** Short cross-link in [`standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) under Getting Started or Integration Points.
- [ ] **3.3** Delete or archive this task plan; confirm no duplicated architecture left here.

---

## Verification

Run after each phase (adjust paths if only a subset changed).

**Phase 1 gate:**

```bash
cd packages/mtw-wml
npm test -- ts/standardize/index.test.ts ts/standardize/integration/ \
  ts/standardize/components/feature.test.ts \
  ts/standardize/components/image.test.ts \
  ts/standardize/components/worldState.test.ts \
  ts/standardize/components/situation.integration.test.ts
```

**Phase 1 full standardize slice (refactor gate from AGENT.md):**

```bash
cd packages/mtw-wml
npm test -- ts/standardize/index.test.ts ts/standardize/integration/ \
  ts/standardize/components/*.integration.test.ts \
  ts/standardize/components/*.ephemeraWire.integration.test.ts
```

**Phase 2 gate (if client touched):**

```bash
cd charcoal-client
npm test -- src/slices/contentHeaders/selectors.test.ts \
  src/lib/situationLabel.test.ts \
  src/components/Workbench/foundations/ComponentSelector/ComponentSelectorDialog.test.ts
```

(Add or create tests if missing for migrated label behavior.)

**Repo hygiene:**

```bash
rg "shortName\?\._payload\?\.plain" charcoal-client/src --glob '*.{ts,tsx}' | wc -l
```

Expect count to **drop** after Phase 2 (not zero if low-level editors still set `_payload._shortName` directly).

**Phase 1.4 hygiene (no exported `hasShortName`):**

```bash
rg "hasShortName" packages/mtw-wml --glob '*.ts' | rg -v 'const hasShortName = Boolean'
```

Expect **no** matches on the exported guard or `HasShortName` symbol after 1.4 (local `hasShortName` booleans inside `isEmpty()` are fine).

---

## Coordination notes

- **Land Phase 1 before Phase 2** so client imports a stable `componentDisplayLabel` from mtw-wml.
- **No JSON / WML shape changes** in Phase 1 unless a bug is found; this is refactor-only.
- **1.3 Message invert:** `StandardMessagePayload.invert()` now inverts shortName via `invertShortName` (bugfix; enables shortName diff).
- **Workbench `updateStandard` patches** may continue to assign `base._payload._shortName` until a typed `withShortName()` exists (optional follow-up; not required for initiative completion).

---

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Factory `get shortName()` breaks a component that used a custom getter | Migrate factory getter last; keep per-class getter until tests pass. |
| Merge/diff semantics drift | Rely on existing Layer A `standardForm.merge.test.ts` / `standardForm.diff.test.ts`; add one cross-tag shortName merge test. |
| Character labels regress | Explicit tests: shortName only, displayName only, both, neither. |
| Call sites expect uuid fragment | Migration audit in 2.3: grep `universalKey?.split` / similar; swap to `fallbackLabel` or call-site default, not helper emitting uuid. |
| Situation selector shows marks-summary when shortName set | Phase 2.4 acceptance test. |

---

## Related files (quick index)

| Area | Path |
| --- | --- |
| Interface | [`components/baseClasses.ts`](../../../../../packages/mtw-wml/ts/standardize/components/baseClasses.ts) |
| Round-trip matrix (1.6) | [`shortNameRoundTrip.test.ts`](../../../../../packages/mtw-wml/ts/standardize/components/shortNameRoundTrip.test.ts) |
| Character-only guard (keep) | [`index.ts`](../../../../../packages/mtw-wml/ts/standardize/index.ts) (`hasDisplayName`) |
| Factory | [`components/component.ts`](../../../../../packages/mtw-wml/ts/standardize/components/component.ts) |
| fromSchema | [`components/fromSchemaPipeline.ts`](../../../../../packages/mtw-wml/ts/standardize/components/fromSchemaPipeline.ts) |
| Client label (today) | [`charcoal-client/src/slices/contentHeaders/selectors.ts`](../../../../../charcoal-client/src/slices/contentHeaders/selectors.ts) |
| Situation labels | [`charcoal-client/src/lib/situationLabel.ts`](../../../../../charcoal-client/src/lib/situationLabel.ts) |
| Content headers projection | [`lambda/assets/contentHeaders/index.ts`](../../../../../lambda/assets/contentHeaders/index.ts) |
