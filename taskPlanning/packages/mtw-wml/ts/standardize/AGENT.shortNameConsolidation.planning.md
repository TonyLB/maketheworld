# shortName consolidation - planning

**Status:** Phase 2 complete (2.5 skipped). **Next:** Phase 3 -- durable doc in `AGENT.implementation.md` and task-plan dispose.

This document follows [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability, checkboxes, verification). **Dispose** after the initiative ships and lasting semantics live in [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (new **shortName** section) and any client doc updates.

---

## Goal

Treat **`shortName` as a first-class, platform-wide optional field on every `StandardComponent`**, with **one implementation pattern** in mtw-wml and **one display-label contract** in charcoal-client, instead of thirteen copy-pasted payload blocks and ad hoc client fallbacks.

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
| **Client** | [`componentDisplayLabel`](../../../../../charcoal-client/src/lib/componentDisplayLabel.ts) is the platform display-label contract; Situation marks-summary delegates to [`situationIdToLabel`](../../../../../charcoal-client/src/lib/situationLabel.ts). Workbench label call sites migrated; **no** universalKey suffix fallbacks. Editors may still assign `_payload._shortName` directly. |
| **Stale UI** | Resolved in Phase 2: `ComponentSelectorDialog` uses `componentDisplayLabel` (Situation shortName precedes marks-summary). |

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
4. Skim client label call sites (grep `shortName` under `charcoal-client/`; lambda contentHeaders projects `shortName` only, no display-label chain).
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
| **Label fallback chain** | **Product/UI contract** (charcoal-client), not mtw-wml. Human-readable sources only, in order: **shortName** -> **displayName** (Character, via `hasDisplayName` from mtw-wml) -> **key** (optional; `includeKeyFallback` default **true**) -> **Situation marks-summary** when `standardForm` is passed (reuse [`situationIdToLabel`](../../../../../charcoal-client/src/lib/situationLabel.ts) / [`situationToMarksSummary`](../../../../../charcoal-client/src/lib/situationLabel.ts)). **Do not** fall back to **universalKey** or uuid suffixes. If nothing matches: return **`undefined`**. Callers pass **`fallbackLabel`** (e.g. `'Untitled'`) or apply their own default. mtw-wml exposes field accessors only (`component.shortName`, Character `displayName`). |
| **`hasShortName()` guard** | **Remove.** No production callers; one test assertion replaced with `component.shortName` (or non-empty check). Dead `hasShortName` imports in integration tests cleaned up. Do **not** extend the `instanceof` list. |
| **`HasShortName` interface / `implements`** | **Remove.** Redundant with `StandardComponent.shortName`. Payloads use shared shortName helpers without a marker interface. **`hasDisplayName` / `HasDisplayName` unchanged** (still needed for Character). |
| **Implementation strategy** | **Phase 1:** Introduce shared helper(s) in `components/` (e.g. `shortNamePayload.ts`: factory functions for merge/toJSON/fromJSON consumer, optional `isEmpty` contribution). Migrate payloads **incrementally** (Room + Feature first, then remainder). **Do not** change serialized JSON shape. |
| **Wrapper `get shortName()`** | Prefer **`componentClassFactory` exposes `get shortName()`** delegating to payload when payload satisfies a small interface, to drop 13 duplicate wrapper getters. If factory change is too risky in one PR, keep wrapper getters until Phase 1b. |
| **Display label API** | **Charcoal-client only** (presentation). Add **`componentDisplayLabel(component, options?)`** returning **`string | undefined`** in a client module (e.g. [`charcoal-client/src/lib/componentDisplayLabel.ts`](../../../../../charcoal-client/src/lib/componentDisplayLabel.ts)). Options: `standardForm` (Situation marks-summary), `includeKeyFallback` (default **true**), `fallbackLabel?: string`. Uses mtw-wml types/accessors (`StandardComponent`, `hasDisplayName`, `component.shortName?.toJSON()`); does **not** export from `@tonylb/mtw-wml`. Migrate call sites from [`getComponentDisplayName`](../../../../../charcoal-client/src/slices/contentHeaders/selectors.ts) and ad hoc breadcrumb/map logic; replace universalKey-suffix patterns with `fallbackLabel` or call-site defaults. Lambda contentHeaders stays **shortName projection only** ([`extractHeaderComponent`](../../../../../lambda/assets/contentHeaders/index.ts)). |
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
| 2 | Client `componentDisplayLabel` + migrate UI call sites (no mtw-wml export; lambda unchanged) | Done (2.5 skipped) |
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

### Phase 2 - display label contract (charcoal-client)

- [X] **2.1** Implement `componentDisplayLabel` in charcoal-client per **Label fallback chain** (new module under `src/lib/`; returns `undefined` when empty unless `fallbackLabel` set; no universalKey suffix). Delegate Situation marks-summary to existing [`situationLabel.ts`](../../../../../charcoal-client/src/lib/situationLabel.ts) helpers.
- [X] **2.2** Unit tests in charcoal-client (`componentDisplayLabel.test.ts` alongside [`situationLabel.test.ts`](../../../../../charcoal-client/src/lib/situationLabel.test.ts)): Character (shortName / displayName / both / neither), Situation (shortName vs marks-summary), key fallback on/off, `fallbackLabel: 'Untitled'` vs `undefined`.
- [X] **2.3** Migrate charcoal-client call sites: `WMLComponentHeader`, `WorkbenchContainer` breadcrumbs, replace [`getComponentDisplayName`](../../../../../charcoal-client/src/slices/contentHeaders/selectors.ts) usages, `ComponentSelectorDialog`, map layers, exit editor, `referenceListAdapter` - use `componentDisplayLabel`. Removed `getComponentDisplayName` from selectors.
- [X] **2.4** Fix stale Situation comment in `ComponentSelectorDialog`; align with `situationIdToLabel` / `componentDisplayLabel` precedence.
- [S] **2.5** (Optional) Message / Moment / Image Workbench shortName fields — **Skipped** (out of scope for this initiative; mtw-wml already supports shortName on these tags).

**Phase 2 completed (May 2026):** [`componentDisplayLabel.ts`](../../../../../charcoal-client/src/lib/componentDisplayLabel.ts) + [`componentDisplayLabel.test.ts`](../../../../../charcoal-client/src/lib/componentDisplayLabel.test.ts). Migrated: `WMLComponentHeader`, `WorkbenchContainer`, `ImportComponentDialog`, `ComponentSelectorDialog`, `MapLayers`, `UnshownRooms`, `ExitEditor`, `referenceListAdapter`. UniversalKey uuid-suffix label fallbacks removed from Workbench component labels.

### Phase 3 - durable documentation and close-out

- [ ] **3.1** Add **"shortName (platform contract)"** section to [`AGENT.implementation.md`](../../../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md): identity vs **display label** (mtw-wml fields vs client `componentDisplayLabel`), optional semantics, Character dual fields (`hasDisplayName` for displayName only), ephemera Object exception; note that **`hasShortName` was removed** as redundant with `StandardComponent`. Cross-link client label helper (charcoal-client `AGENT.md` or `lib/componentDisplayLabel.ts`).
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

**Phase 2 gate (charcoal-client):**

```bash
cd charcoal-client
npm test -- src/lib/componentDisplayLabel.test.ts \
  src/lib/situationLabel.test.ts
```

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

- **Land Phase 1 before Phase 2** so client label helper can rely on stable `component.shortName` and shared payload helpers. Phase 2 does **not** add exports to mtw-wml.
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
| Call sites expect uuid fragment | Migration audit in 2.3: grep `universalKey?.split` / similar; swap to `fallbackLabel` or call-site default in charcoal-client helper (helper must not emit uuid suffix). |
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
| Display label API | [`charcoal-client/src/lib/componentDisplayLabel.ts`](../../../../../charcoal-client/src/lib/componentDisplayLabel.ts) |
| contentHeaders selectors | [`charcoal-client/src/slices/contentHeaders/selectors.ts`](../../../../../charcoal-client/src/slices/contentHeaders/selectors.ts) (grouping only; no display-label helper) |
| Situation labels (reuse in 2.1) | [`charcoal-client/src/lib/situationLabel.ts`](../../../../../charcoal-client/src/lib/situationLabel.ts) |
| Content headers projection | [`lambda/assets/contentHeaders/index.ts`](../../../../../lambda/assets/contentHeaders/index.ts) |
