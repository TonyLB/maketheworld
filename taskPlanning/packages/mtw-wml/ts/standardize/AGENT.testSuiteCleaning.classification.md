# Phase 1 classification: `index.test.ts` and component integration inventory

**Status:** Phase 1 complete. **Layer A extraction (named describes + grab-bag) done.** **Layer B grab-bag from `index.test.ts` moved** to 8 `components/*.integration.test.ts` files (see Layer B table below). `standardizeMode` split and `room.test.ts` informal integration still pending.  
**Baseline (2026-05-19):** `npm test -- ts/standardize/index.test.ts` + `ts/standardize/integration/` + `ts/standardize/components/*.integration.test.ts` -- **217 passed** total.  
**Source of truth for remaining Phase 2 moves:** this file (`standardizeMode` in section 2; `room.test.ts` in section 3).

## Phase 2 extraction status (named describes)

All top-level named `describe` blocks except `standardizeMode` are extracted to `packages/mtw-wml/ts/standardize/integration/`:

| File | Tests (approx) |
| --- | ---: |
| `standardForm.construct.test.ts` | 15 |
| `standardForm.merge.test.ts` | 17 |
| `standardForm.isEmpty.test.ts` | 12 |
| `standardForm.equals.test.ts` | 6 |
| `standardForm.assureComponents.test.ts` | 7 |
| `standardForm.diff.test.ts` | 30 (includes grab-bag character diff at former L1838) |
| `standardForm.subset.test.ts` | 12 |
| `standardForm.keyChangesViaMerge.test.ts` | 9 |
| `standardForm.lookup.test.ts` | 5 |
| `standardForm.finalize.test.ts` | 4 |
| `standardForm.assetMeta.test.ts` | 31 |
| `standardForm.validate.test.ts` | 7 |
| `standardForm.removeComponent.test.ts` | 12 |
| `standardForm.referencedBy.test.ts` | 5 |

`index.test.ts` retains `standardizeMode` (17 `it`) and thin smoke (2 `it`) only (~328 lines). Layer A grab-bag rows are **moved**. Layer B grab-bag rows (clusters B partial, C partial, D partial, E, F, G partial, J partial) are **moved** to `components/*.integration.test.ts`.

### Layer B extraction status (`components/*.integration.test.ts`)

| File | Tests |
| --- | ---: |
| `room.integration.test.ts` | 14 (includes finalize character/room test from `standardForm.finalize.test.ts`) |
| `feature.integration.test.ts` | 3 |
| `knowledge.integration.test.ts` | 3 |
| `situation.integration.test.ts` | 3 |
| `worldState.integration.test.ts` | 2 |
| `map.integration.test.ts` | 2 |
| `message.integration.test.ts` | 1 |
| `moment.integration.test.ts` | 1 |

`standardForm.finalize.test.ts` now has 3 tests (character/room integration test moved to `room.integration.test.ts`).

Related: [`AGENT.testSuiteCleaning.planning.md`](./AGENT.testSuiteCleaning.planning.md)

---

## Decisions (resolved open questions)

| Question | Decision |
| --- | --- |
| `index.test.ts` after split | **Thin smoke** -- keep 1-2 asset construct round-trip tests; delete the rest after extraction |
| ephemeraWire ownership | **Layer B** `components/room.ephemeraWire.integration.test.ts` when Room/Object/Character is the parse/render hub; **Layer A** `integration/standardForm.ephemeraWire.test.ts` only for asset-wide mode policy (e.g. merge render+affordance, reject tags in asset mode) |
| Situation nesting owner | **room.integration.test.ts** for Room situation facet lists / Gate D hoisting; **feature.integration.test.ts** / **knowledge.integration.test.ts** when Feature/Knowledge child lists are primary |
| Feature/Knowledge ephemeraWire | **feature.ephemeraWire.integration.test.ts** / **knowledge.ephemeraWire.integration.test.ts** (or single `ephemeraWire.integration.test.ts` if combined) -- parallel to Room hub; do not duplicate in index after move |

---

## Summary counts

| Category | Count |
| --- | ---: |
| Ungrouped top-level `it` in `index.test.ts` | 64 |
| Named top-level `describe` in `index.test.ts` | 16 |
| Nested `describe` in `index.test.ts` | 11 |
| Nested `it` inside describes (not in grab-bag) | 153 |
| Phase 2 **delete** candidates (index only) | 8 |
| Phase 3 **rename** (Example -> Situation) in index | 5 titles + fixture keys |
| `room.test.ts` blocks -> Layer B | 3 describes + 2 top-level `it` |

---

## 1. Ungrouped `it` blocks (`index.test.ts`)

Top-level `it` (4-space indent, direct child of `describe('StandardForm')`).

### Cluster A: Construct / parse / facet guards (L536-727)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 536 | should return an empty wrapper unchanged | `integration/standardForm.construct.test.ts` | move | Layer A |
| 542 | should accept edit tags in JSON form | `integration/standardForm.construct.test.ts` | move | Layer A |
| 566 | should accept JSON facet entries with missing payload and inject defaults | `integration/standardForm.construct.test.ts` | move | Overlap facets; keep StandardForm path |
| 604 | should reject malformed present payload in JSON facet entries | `integration/standardForm.construct.test.ts` | move | Layer A |
| 628 | should accept NDJSON facet entries with missing payload and inject defaults | `integration/standardForm.construct.test.ts` | move | Overlap facets |
| 666 | should preserve missing-payload default through diff/merge roundtrip | `integration/standardForm.merge.test.ts` | move | StandardForm diff/merge; not facet-only |

### Cluster B: WML construct / removed refs (L728-916)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 728 | should accept edit tags | `integration/standardForm.construct.test.ts` | move | Layer A |
| 804 | should accept parsed schema | `integration/standardForm.construct.test.ts` | move | Layer A |
| 839 | should ignore authorization tags | `integration/standardForm.construct.test.ts` | move | Layer A |
| 865 | should properly nest components in a removed component | `integration/standardForm.construct.test.ts` | move | Layer A |
| 879 | should correctly round-trip a removed feature reference in a room | `components/room.integration.test.ts` | move | Layer B |
| 898 | should correctly round-trip a removed feature nested in a room | `components/room.integration.test.ts` | move | Layer B |

### Cluster C: World-state round-trips (L917-1065)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 917 | should correctly round-trip a room with lenses containing marks | `components/room.integration.test.ts` | move | Layer B; overlaps `room.test.ts` Lens block |
| 956 | should correctly round-trip a standalone Lens component | `components/worldState.integration.test.ts` | move | Layer B (Lens hub) |
| 999 | should correctly round-trip a standalone Mark component | `components/worldState.integration.test.ts` | move | Layer B |
| 1019 | should correctly round-trip a Situation with Mark facets | `components/situation.integration.test.ts` | move | Asset smoke; facets file covers payload-only |
| 1050 | should correctly parse Situation with ShortName and hasShortName | `components/situation.integration.test.ts` | move | Layer B |
| 1066 | should correctly construct classes | `integration/standardForm.construct.test.ts` | move | Layer A |
| 1083 | should correctly relocate nested components to rendering level | `integration/standardForm.construct.test.ts` | move | Layer A |

### Cluster D: Merge-like combine / exits (L1109-1180)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 1109 | should combine descriptions in rooms and features | `integration/standardForm.merge.test.ts` | move | Layer A (`form.merge` orchestration) |
| 1147 | should combine exits in rooms | `components/room.integration.test.ts` | move | Layer B; exit overlap with facets integration |

### Cluster E: Nested JSON/schema -- Situation legacy titles (L1181-1464)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 1181 | should correctly return JSON for features nested in rooms | `components/room.integration.test.ts` | move | Layer B |
| 1262 | should correctly return JSON for examples nested in rooms | `components/room.integration.test.ts` | move | **rename** title + fixtures Phase 3 |
| 1305 | should correctly return JSON for examples nested in Knowledge | `components/knowledge.integration.test.ts` | move | **rename** Phase 3 |
| 1333 | should correct return JSON for examples nested in features nested in rooms | `components/feature.integration.test.ts` | move | **rename** Phase 3; typo "correct" |
| 1379 | should correctly return schema for features nested in rooms | `components/room.integration.test.ts` | move | Layer B |
| 1421 | should correctly return schema for examples nested in knowledge | `components/knowledge.integration.test.ts` | move | **rename** Phase 3 |
| 1435 | hoists a room default Situation stub to asset scope in schema output (Gate D) | `components/room.integration.test.ts` | move | Layer B |
| 1448 | should correctly return schema for examples nested in features nested in rooms | `components/feature.integration.test.ts` | move | **rename** Phase 3 |

### Cluster F: Render / schema output by component type (L1465-1743)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 1465 | should combine render in nested rooms | `components/room.integration.test.ts` | move | Layer B |
| 1511 | should render features and links correctly | `components/feature.integration.test.ts` | move | Layer B |
| 1557 | should render knowledge correctly | `components/knowledge.integration.test.ts` | move | Layer B |
| 1603 | should render maps correctly | `components/map.integration.test.ts` | move | Layer B; position/exit overlap facets |
| 1656 | should render empty maps | `components/map.integration.test.ts` | move | Layer B |
| 1663 | should render messages correctly | `components/message.integration.test.ts` | move | Layer B |
| 1708 | should render moments correctly | `components/moment.integration.test.ts` | move | Layer B |

### Cluster G: Character integration (L1744-2021)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 1744 | should handle complex WML parsing with nested character references | `components/room.integration.test.ts` | move | **Consolidate** with `room.test.ts` Character Integration; delete index copy after move |
| 1797 | should perform complete serialization round-trip with character references | `components/room.integration.test.ts` | move | Dedupe vs room.test.ts |
| 1838 | should handle diff scenarios with character reference changes | `integration/standardForm.diff.test.ts` | move | Layer A (`form.diff`); optional duplicate in room.integration |
| 1921 | should handle merge scenarios with conflicting character references | `integration/standardForm.merge.test.ts` | move | Layer A |
| 1971 | should handle empty character lists correctly in integration | `components/room.integration.test.ts` | move | Dedupe `room.test.ts` L574 |
| 1994 | should handle origin properties correctly in WML parsing and serialization | `integration/standardForm.construct.test.ts` | move | Layer A |
| 2022 | should correctly reflect empty imports in byId | `integration/standardForm.lookup.test.ts` | move | Layer A |

### Cluster H: Merge / edits / universalKey (L2045-2458)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 2045 | should render Remove tags correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2071 | should handle characters correctly | `components/room.integration.test.ts` | move | Layer B |
| 2086 | should merge edit value tags correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2119 | should merge edit component remove correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2148 | should merge edit component remove of empty base component correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2177 | should apply edits on merge | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2204 | should merge multiple standardComponents correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2256 | should merge metadata correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2312 | should merge multiple serializable standardComponents correctly | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2368 | should merge with an empty value | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2398 | should merge base component with universalKey | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2416 | should merge incoming component with universalKey | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2434 | should merge identical universalKeys | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2452 | should throw error on conflicting universalKeys | `integration/standardForm.merge.test.ts` | move | Layer A |
| 2458 | should deserialize empty NDJSON correctly | `integration/standardForm.construct.test.ts` | move | Layer A |

### Cluster I: NDJSON / grouping gap (L3718-3906)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 3718 | should round-trip all component types through NDJSON | `integration/standardForm.construct.test.ts` | move | Layer A |
| 3769 | should group sub-components correctly in JSON | `integration/standardForm.construct.test.ts` | move | Layer A |
| 3865 | should round-trip nested subcomponents | `integration/standardForm.construct.test.ts` | move | Layer A |
| 3895 | should round-trip imports through NDJSON | `integration/standardForm.assetMeta.test.ts` | move | Layer A (imports graph) |

### Cluster J: Origin merge / Situation facet edits (L4426-4477)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 4426 | should merge origin properties correctly in StandardForm merge | `integration/standardForm.merge.test.ts` | move | Layer A |
| 4447 | should allow nested Situation facet edits in edit mode | `components/situation.integration.test.ts` | move | Layer B |

---

## 2. Named `describe` blocks (`index.test.ts`)

### Top-level describes (16)

| Line | `describe` | Lines (approx) | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- | --- |
| 28 | input vs normative typeguards | 28-54 | `integration/standardForm.construct.test.ts` | extract-describe | 1 `it`; facet typeguard overlap |
| 56 | isEmpty() | 56-150 | `integration/standardForm.isEmpty.test.ts` | extract-describe | 11 `it` |
| 152 | equals() | 152-261 | `integration/standardForm.equals.test.ts` | extract-describe | 6 `it` |
| 263 | standardizeMode | 263-534 | **split** (see below) | extract-describe | 17 `it` |
| 2466 | assureComponents method | 2466-2550 | `integration/standardForm.assureComponents.test.ts` | extract-describe | 7 `it` |
| 2552 | diff method | 2552-3198 | `integration/standardForm.diff.test.ts` | extract-describe | 23 top-level + nested |
| 3200 | subset method | 3200-3716 | `integration/standardForm.subset.test.ts` | extract-describe | 11 `it`; map/position overlap facets |
| 3908 | key changes via merge | 3908-4206 | `integration/standardForm.keyChangesViaMerge.test.ts` | extract-describe | 4 nested describes |
| 4209 | byId | 4209-4241 | `integration/standardForm.lookup.test.ts` | extract-describe | 2 `it` |
| 4243 | byUniversalId | 4243-4277 | `integration/standardForm.lookup.test.ts` | extract-describe | 2 `it` |
| 4279 | finalize | 4279-4424 | `integration/standardForm.finalize.test.ts` | extract-describe | 4 `it`; L4334 -> Layer B candidate |
| 4479 | Asset-level ShortName and Summary | 4479-5147 | `integration/standardForm.assetMeta.test.ts` | extract-describe | 28 `it` |
| 5149 | validate() | 5149-5277 | `integration/standardForm.validate.test.ts` | extract-describe | nested circular parent |
| 5279 | removeComponent | 5279-5513 | `integration/standardForm.removeComponent.test.ts` | extract-describe | nested cascade |
| 5515 | referencedBy | 5515-5597 | `integration/standardForm.referencedBy.test.ts` | extract-describe | 5 `it` |

### `standardizeMode` per-`it` split (17 tests)

| Line | Title | Destination | phase2_action | notes |
| --- | --- | --- | --- | --- |
| 264 | defaults to asset | -- | **delete** | Dup `wmlStandardizeMode.test.ts` L9 |
| 268 | accepts ephemeraWire via constructor options | -- | **delete** | Dup `resolveStandardizeMode` coverage |
| 273 | includes standardizeMode in toJSON when not asset | `integration/standardForm.standardizeMode.test.ts` | move | Layer A StandardForm-specific |
| 278 | parses Object children under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 303 | normalizes Object uuid=(OBJECT#id) same as bare id in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 328 | throws when Object uuid has wrong typed prefix | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 341 | round-trips Object uuid as bare key in WML output | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 357 | rejects Object under Room in asset mode (unconsumed tag) | `integration/standardForm.standardizeMode.test.ts` | move | Layer A policy |
| 370 | throws when Object ShortName is whitespace-only inside Room | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 383 | parses Render under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 409 | round-trips Render under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 433 | rejects Render under Room in asset mode (unconsumed tag) | `integration/standardForm.standardizeMode.test.ts` | move | Layer A |
| 448 | throws when more than one Render under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 468 | throws when Render DisplayName is whitespace-only inside Room | `components/room.ephemeraWire.integration.test.ts` | move | Layer B |
| 487 | merges ephemeraWire render form with affordance form for the same room UUID | `integration/standardForm.standardizeMode.test.ts` | move | Layer A asset merge policy |

### Nested describes under `diff method` (5)

| Line | `describe` | Destination | notes |
| --- | --- | --- | --- |
| 2772 | Nested Component Change (In-Place) - Minimal Diff Format | `integration/standardForm.diff.test.ts` | Layer A |
| 2892 | Case 2: Explicit Top-Level Component | `integration/standardForm.diff.test.ts` | Layer A |
| 2926 | Case 3: Component Moving from Nested to Top-Level | `integration/standardForm.diff.test.ts` | Layer A |
| 3000 | Case 4: Component Moving from Asset-Level to Nested | `integration/standardForm.diff.test.ts` | Layer A; Situation reparent |
| 3052 | key changes | `integration/standardForm.diff.test.ts` | Layer A |

### Other nested describes

| Parent | Line | `describe` | Destination |
| --- | --- | --- | --- |
| key changes via merge | 3909 | validation | `integration/standardForm.keyChangesViaMerge.test.ts` |
| key changes via merge | 3950 | reference updates | same |
| key changes via merge | 4120 | merge behavior | same |
| key changes via merge | 4177 | integration | same |
| validate() | 5150 | circular explicit parent detection | `integration/standardForm.validate.test.ts` |
| removeComponent | 5394 | cascade option | `integration/standardForm.removeComponent.test.ts` |

### Layer B exceptions inside named describes

| Line | Title | Parent | Destination | notes |
| --- | --- | --- | --- | --- |
| 4334 | should integrate characters with rooms in StandardForm.schema scenarios | finalize -> `room.integration.test.ts` | **moved** | Was in finalize; now in room.integration Character references |
| 2730 | should return the diff for nested situation components | diff method | stays in diff.test.ts | Uses `Example1` fixture keys -- rename Phase 3 |

---

## 3. Component tests: informal integration inventory

### `room.test.ts` (~1,567 lines, 96 `it`)

| Block | Line | Future home | phase2_action | notes |
| --- | --- | --- | --- | --- |
| (top-level) | 137 | `room.integration.test.ts` | move | Situation facet diff->merge chain |
| (top-level) | 119 | `room.integration.test.ts` | move | Situation facet WML round-trip |
| Character Integration | 361 | `room.integration.test.ts` | move | Dedupe index L1744-1971 |
| Guidance references | 585 | **unit** `room.test.ts` | stay | Room reference buckets only |
| explicitParent | 640 | **unit** `room.test.ts` | stay | Unless full asset needed |
| invert method | 884 | **unit** `room.test.ts` | stay | |
| explicitKey | 971 | **unit** `room.test.ts` | stay | |
| assureReferences method | 1311 | **unit** `room.test.ts` | stay | Multi-bucket dispatch |
| removeReferences method | 1459 | **unit** `room.test.ts` | stay | |
| Lens output in schema | 1519 | `room.integration.test.ts` | move | StandardForm + full Asset; dedupe index L917 |

### Secondary component files

| File | Signal | Future home | phase2_action |
| --- | --- | --- | --- |
| `map.test.ts` | `schema output with shared references` (L168) | `map.integration.test.ts` | move describe |
| `feature.test.ts` | ephemeraWire Render parse/round-trip (L335, L356) | `feature.ephemeraWire.integration.test.ts` | move 2 `it` |
| `knowledge.test.ts` | ephemeraWire Render parse/round-trip (L271, L292) | `knowledge.ephemeraWire.integration.test.ts` | move 2 `it` |
| `guidance.test.ts` | `Guidance facet round-trip (WML -> StandardForm -> WML)` (L193) | `guidance.integration.test.ts` | move describe |
| `worldState.test.ts` | Large; mostly unit + mergeTest | defer | No StandardForm multi-tag blocks found |
| `utils/referenceCollection.test.ts` | `integration scenarios` | **unit** | Not StandardForm asset |
| `utils/keyCollection.test.ts` | `integration scenarios` | **unit** | Not StandardForm asset |

---

## 4. Overlap vs existing suites

### vs [`keys/facets/integration.test.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/facets/integration.test.ts)

| Topic | Keep in | Delete or narrow in index |
| --- | --- | --- |
| Mark facet WML round-trip (payload) | facets integration | Do not add facet-only dup in index after move |
| Situation+Mark asset smoke (L1019) | `situation.integration.test.ts` | Keep one asset-level test |
| Missing Mark payload (JSON/NDJSON/guards) | `standardForm.construct.test.ts` | Keep StandardForm paths |
| Position / Exit on Map | `map.integration.test.ts` + `standardForm.subset.test.ts` | Drop index tests that only repeat facet round-trip |
| renderFacet / Replace via facet.diff | facets integration | Never duplicate in index |

### vs [`wmlStandardizeMode.test.ts`](../../../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.test.ts)

| Topic | Keep in | Delete in index (Phase 2) |
| --- | --- | --- |
| `defaults to asset` | wmlStandardizeMode | index L264 |
| `isWmlStandardizeMode` / `resolveStandardizeMode` | wmlStandardizeMode | index L268 (constructor accepts ephemeraWire) |
| ephemeraWire parse/merge/render | index -> split to Layer A/B files | Keep until extracted |

### vs `room.test.ts` (cross-file dedupe)

| Topic | Single owner | Delete after move |
| --- | --- | --- |
| Character WML/merge/diff | `room.integration.test.ts` | index L1744, L1797, L1971 |
| Lens StandardForm round-trip | `room.integration.test.ts` | index L917 + room.test.ts Lens describe (consolidate) |
| Situation facet on Room | `room.integration.test.ts` | index L1262 block + room.test.ts L119-137 |

---

## 5. Rename (Example -> Situation) vs delete

### Phase 3 rename (index.test.ts)

| Line | Current title / fixture | Action |
| --- | --- | --- |
| 1262 | `examples nested in rooms` | Rename title; fixtures use Situation |
| 1305 | `examples nested in Knowledge` | Rename |
| 1333 | `examples nested in features nested in rooms` | Rename + fix "correct" typo |
| 1421 | `examples nested in knowledge` | Rename |
| 1448 | `examples nested in features nested in rooms` | Rename |
| 1088, 1100, 1384, 1407 | `testFeatureExample` keys | Rename fixture keys Phase 3 |
| 2731-2732 | `Example1`, `Example2` in diff fixtures | Rename Phase 3 |

### Stale-term search results (`standardize/**/*.test.ts`)

| Pattern | Matches (files) |
| --- | --- |
| `examples nested` | `index.test.ts` (5 titles) |
| `Example1` / `testFeatureExample` | `index.test.ts`, `feature.test.ts`, `knowledge.test.ts`, `processComponents.test.ts` |
| `<Example` | `feature.test.ts`, `knowledge.test.ts` |
| `.examples\b` | **0** in standardize test files |

### Phase 2 delete candidates (index only; 8 total)

| Line | Title | Rationale |
| --- | --- | --- |
| 264 | defaults to asset | Dup `wmlStandardizeMode.test.ts` |
| 268 | accepts ephemeraWire via constructor options | Dup mode helpers |
| -- | (none facet-only) | Keep L1019 as asset smoke |

*Note:* Character dedupe (index vs room) is **delete after move**, not immediate delete -- count as consolidation, not redundant coverage removal.

---

## 6. Phase 2 recommended order

1. **Layer A:** Extract `diff method` then `subset method` (already grouped; lowest risk).
2. **Layer B:** Create `room.integration.test.ts`; move situation-nesting grab-bag (Cluster E) + character cluster (G).
3. **Dedupe:** Remove index `standardizeMode` L264-268 after extraction; consolidate character tests into `room.integration.test.ts`.
4. **Layer A:** Extract `merge` grab-bag (Cluster H) and remaining construct (A, B, I).
5. **Thin smoke:** Leave 1-2 tests in `index.test.ts` or delete file per Decisions.

---

## 7. Thin smoke candidates (post-split `index.test.ts`)

| Line | Title | Rationale |
| --- | --- | --- |
| 536 | should return an empty wrapper unchanged | Minimal construct sanity |
| 804 | should accept parsed schema | Second smoke optional |

---

## Verification checklist

- [x] 64 ungrouped `it` rows classified
- [x] 16 top-level `describe` destinations filled
- [x] `room.test.ts` integration blocks listed
- [x] Overlap with facets + wmlStandardizeMode documented
- [x] Rename and delete candidates enumerated
- [x] Baseline 217 pass recorded
