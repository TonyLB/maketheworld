# Phase 1 classification: `index.test.ts` and component integration inventory

**Status:** Phase 4 Step 0 complete (2026-05-19). Steps 1-3 not started. Section 8 Step 0 overlap context is the reference for Layer A/B sweeps.  
**Baseline (2026-05-19):** gate suite -- **226 passed** total (`index` + `integration/` + `*.integration.test.ts`).  
**Source of truth:** section 4 (Phase 1 overlap rules); section 5 (Phase 3 renames **done**); **section 8** (Phase 4 per-file sweep results).

## Phase 2 extraction status (named describes)

All top-level named `describe` blocks are extracted to `packages/mtw-wml/ts/standardize/integration/`:

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
| `standardForm.standardizeMode.test.ts` | 4 |

`index.test.ts` retains thin smoke only (2 `it`, ~52 lines). Layer A grab-bag rows are **moved**. Layer B grab-bag rows are **moved** to `components/*.integration.test.ts`.

### Layer B extraction status (`components/*.integration.test.ts`)

| File | Tests |
| --- | ---: |
| `room.integration.test.ts` | 19 (includes Situation facets on Room, Lens round-trips from `room.test.ts`) |
| `room.ephemeraWire.integration.test.ts` | 10 |
| `feature.integration.test.ts` | 3 |
| `feature.ephemeraWire.integration.test.ts` | 2 |
| `knowledge.integration.test.ts` | 3 |
| `knowledge.ephemeraWire.integration.test.ts` | 2 |
| `situation.integration.test.ts` | 3 |
| `worldState.integration.test.ts` | 2 |
| `map.integration.test.ts` | 3 (includes shared Feature implicit parent from `map.test.ts`) |
| `guidance.integration.test.ts` | 1 |
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
| 263 | standardizeMode | 263-534 | **split** (see below) | **done** | 17 `it` -> Layer A (4) + room.ephemeraWire (10) + 2 deleted |
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
| 264 | defaults to asset | -- | **deleted** | Dup `wmlStandardizeMode.test.ts` L9 |
| 268 | accepts ephemeraWire via constructor options | -- | **deleted** | Dup `resolveStandardizeMode` coverage |
| 273 | includes standardizeMode in toJSON when not asset | `integration/standardForm.standardizeMode.test.ts` | **moved** | Layer A StandardForm-specific |
| 278 | parses Object children under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 303 | normalizes Object uuid=(OBJECT#id) same as bare id in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 328 | throws when Object uuid has wrong typed prefix | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 341 | round-trips Object uuid as bare key in WML output | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 357 | rejects Object under Room in asset mode (unconsumed tag) | `integration/standardForm.standardizeMode.test.ts` | **moved** | Layer A policy |
| 370 | throws when Object ShortName is whitespace-only inside Room | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 383 | parses Render under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 409 | round-trips Render under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 433 | rejects Render under Room in asset mode (unconsumed tag) | `integration/standardForm.standardizeMode.test.ts` | **moved** | Layer A |
| 448 | throws when more than one Render under Room in ephemeraWire | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 468 | throws when Render DisplayName is whitespace-only inside Room | `components/room.ephemeraWire.integration.test.ts` | **moved** | Layer B |
| 487 | merges ephemeraWire render form with affordance form for the same room UUID | `integration/standardForm.standardizeMode.test.ts` | **moved** | Layer A asset merge policy |

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
| (top-level) | 137 | `room.integration.test.ts` | **moved** | Situation facet diff->merge chain |
| (top-level) | 119 | `room.integration.test.ts` | **moved** | Situation facet WML round-trip |
| Character Integration | 361 | **unit** `room.test.ts` | **stay** | StandardRoom-only; asset-level coverage in `room.integration.test.ts` Character references |
| Guidance references | 585 | **unit** `room.test.ts` | stay | Room reference buckets only |
| explicitParent | 640 | **unit** `room.test.ts` | stay | Unless full asset needed |
| invert method | 884 | **unit** `room.test.ts` | stay | |
| explicitKey | 971 | **unit** `room.test.ts` | stay | |
| assureReferences method | 1311 | **unit** `room.test.ts` | stay | Multi-bucket dispatch |
| removeReferences method | 1459 | **unit** `room.test.ts` | stay | |
| Lens output in schema | 1519 | `room.integration.test.ts` | **moved** | StandardForm + full Asset; merged into Lens in Room |

### Secondary component files

| File | Signal | Future home | phase2_action |
| --- | --- | --- | --- |
| `map.test.ts` | `schema output with shared references` (L168) | `map.integration.test.ts` | **moved** |
| `feature.test.ts` | ephemeraWire Render parse/round-trip (L335, L356) | `feature.ephemeraWire.integration.test.ts` | **moved** |
| `knowledge.test.ts` | ephemeraWire Render parse/round-trip (L271, L292) | `knowledge.ephemeraWire.integration.test.ts` | **moved** |
| `guidance.test.ts` | `Guidance facet round-trip (WML -> StandardForm -> WML)` (L193) | `guidance.integration.test.ts` | **moved** |
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
| ephemeraWire parse/merge/render | Layer A/B integration files | **extracted** |

### vs `room.test.ts` (cross-file dedupe)

| Topic | Single owner | Delete after move |
| --- | --- | --- |
| Character WML/merge/diff | `room.integration.test.ts` | index L1744, L1797, L1971 |
| Lens StandardForm round-trip | `room.integration.test.ts` | index L917 + room.test.ts Lens describe (consolidate) |
| Situation facet on Room | `room.integration.test.ts` | index L1262 block + room.test.ts L119-137 |

---

## 5. Rename (Example -> Situation) vs delete

### Phase 3 rename (**done** 2026-05-19)

| File | Was | Now |
| --- | --- | --- |
| `components/room.integration.test.ts` | `examples nested in rooms`; `testFeatureExample` / `testGlobalExample` | `situations nested in rooms`; `testFeatureSituation` / `testGlobalSituation` |
| `components/knowledge.integration.test.ts` | `examples nested in Knowledge` / `knowledge` | `situations nested in ...` |
| `components/feature.integration.test.ts` | `examples nested...`; typo `correct return` | `situations nested...`; `correctly return` |
| `integration/standardForm.diff.test.ts` | `Example1`, `Example2` | `situation1`, `situation2` |
| `integration/standardForm.construct.test.ts` | `testFeatureExample` | `testFeatureSituation` |
| `integration/standardForm.subset.test.ts` | comment "Example link" | "Situation link" |
| `integration/standardForm.removeComponent.test.ts` | comment "Examples" | "Situations" |
| `keys/facets/integration.test.ts` | Mock Example / Examples with Mark | Mock Situation / Situations with Mark |
| `processComponents.test.ts` (optional hygiene) | `*Example` uuid keys | `*Situation` uuid keys |

### Phase 3 overlap audit (**done**; 0 deletions)

Re-checked classification section 4. Kept all gate tests: construct missing-payload paths (StandardForm-specific), `situation.integration` Mark smoke, `map.integration` schema org, `room.integration` vs `room.test.ts` character blocks (unit vs asset harness), `processComponents` exit combine vs `room.integration` (different APIs). No relocations required.

### Stale-term search results (`standardize/**/*.test.ts`, post-Phase 3)

| Pattern | Matches (files) |
| --- | --- |
| `examples nested` | **0** |
| `Example1` / `testFeatureExample` (misleading) | **0** in gate files; intentional legacy-parse only in `feature.test.ts`, `knowledge.test.ts` (`<Example key=(Example1)>`) |
| `<Example` | `feature.test.ts`, `knowledge.test.ts` (legacy rejection tests) |
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

## 8. Phase 4 coverage sweeps (redundancy + gaps)

**Goal:** Now that tests are sorted by topic (Layer A / Layer B / unit), systematically review each integration file and its paired unit file. Document **(a) redundancies** and **(b) gaps** without requiring fixes to close Phase 4.

**Rubric (per test or describe block):**

| Field | What to record |
| --- | --- |
| `primary_assertion` | What is under test (e.g. `form.diff`, `StandardRoom.merge`, Mark facet round-trip, implicit parent in schema) |
| `harness` | `StandardForm` asset, single-component WML, facet class only, `processComponents`, etc. |
| `redundancy` | `none`, or cite other file + title if same assertion **and** same harness |
| `gap` | `none`, or cite API/behavior from `AGENT.md` / implementation missing at this layer |
| `action` | `keep` / `delete` / `move` / `narrow` / `add` (implementation deferred unless doing a fix slice) |

**Sweep depth:** Step 0 uses **file-level** summaries in the table below plus describe-level notes for large partners (`schemaOrganization`). Steps 1-3 may add per-`describe` detail when judging individual Layer A/B files.

**Overlap rules:** See [section 4](#4-overlap-vs-existing-suites). Do not flag as redundant when harness differs (e.g. facet unit vs `StandardForm.schema`, `processComponents` vs `room.integration`). Do flag when the same asset graph and assertion appear twice at the same layer.

### Step 0 -- Cross-cutting partners (sweep first)

| File | ~`it` | Paired / related | Sweep | Redundancies | Gaps |
| --- | ---: | --- | --- | --- | --- |
| [`keys/facets/integration.test.ts`](../../../../../packages/mtw-wml/ts/standardize/keys/facets/integration.test.ts) | 39 | All Layer A/B using Position/Exit/Mark | [x] | **none** at facet-class harness. Layer consumers (`construct` missing-payload, `situation.integration` Mark smoke, `map.integration` / `subset` map position) use different APIs -- keep all per section 4. | **none** for Position/Mark/Exit family (`AGENT.facets.md`). Guidance / `situationProse` / `lensMark` facets intentionally absent here; covered in `guidance.integration.test.ts` + `guidance.test.ts`. Do not add facet-only dup of `renderFacet` in Layer A/B. |
| [`wmlStandardizeMode.test.ts`](../../../../../packages/mtw-wml/ts/standardize/wmlStandardizeMode.test.ts) | 4 | `standardForm.standardizeMode.test.ts` (4), `room.ephemeraWire.integration.test.ts` (10) | [x] | **none** vs `standardForm.standardizeMode` (pure guards vs `StandardForm` policy). **none** vs ephemeraWire integration (parse/render hub vs literals). Index dups removed Phase 2. | **none** at this layer. EphemeraWire parse/merge/render gaps belong in Layer B ephemeraWire files, not here. |
| [`processComponents.test.ts`](../../../../../packages/mtw-wml/ts/standardize/processComponents.test.ts) | 19 | Layer B combine/render tests; `standardForm.merge` | [x] | **none** -- same titles as `merge` / `room.integration` / `feature.integration` assert `processComponents()` output, not `StandardForm.merge` / `.schema` (Phase 3 audit; see overlap context below). | `standardizeMode` / ephemeraWire not passed in any test (AGENT.md threading); defer to Layer A/B if walker-level coverage needed. `should correctly localize subcomponents` has open **TODO** (context not asserted). |
| [`schemaOrganization.test.ts`](../../../../../packages/mtw-wml/ts/standardize/schemaOrganization.test.ts) | 65 | `map.integration`, `subset`, `construct`, `validate`, `diff`, `referencedBy`, `removeComponent` | [x] | **none** vs integration files that assert end-to-end WML/schema (e.g. Gate D hoisting, shared Feature implicit parent) -- different harness than direct `getImplicitParent` / `getChildrenOfParent`. | Proposed WML `<Parent>` tag on Situation ([`AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md) Future Plans) not implemented -- no test expected yet. `getExplicitParent` covers component-stored explicit parent, not that proposal. Diff reference-change debt lives in `standardForm.diff.test.ts` (TODO), not org API. |

#### Step 0 overlap context (carry forward)

Use this when sweeping Steps 1-3 so similar fixtures are not mis-tagged as duplicates.

- **Harness matrix:** `keys/facets/integration` = facet class only; `wmlStandardizeMode` = mode guards; `standardForm.standardizeMode` = `StandardForm` asset policy; `*.ephemeraWire.integration` = Room/Feature/Knowledge wire parse/render; `processComponents` = `Schema` walker; `schemaOrganization` = org API in isolation; Layer A/B = `StandardForm` orchestration or component-primary integration.
- **Facet vs StandardForm:** Never duplicate `renderFacet` / payload-only Mark round-trip from facets integration in Layer A/B. Keep `construct` missing-payload JSON/NDJSON paths and one `situation.integration` asset smoke.
- **Same title, different API (keep both):**

| `processComponents.test.ts` | Similar elsewhere | Verdict |
| --- | --- | --- |
| `should combine descriptions in rooms and features` | `standardForm.merge.test.ts` | keep both |
| `should combine exits in rooms` | `room.integration.test.ts` | keep both |
| `should combine render in nested rooms` | `room.integration.test.ts` | keep both |
| `should render features and links correctly` | `feature.integration.test.ts` | keep both |

- **`schemaOrganization` describe -> typical Layer A/B consumers:**

| `describe` | ~`it` | Consumers (integration / API) |
| --- | ---: | --- |
| `getImplicitParent` | 8 | `map.integration` (shared Feature parent), `construct` relocation |
| `getExplicitParent` | 8 | `validate`, diff reparent / key-change scenarios |
| `getChildrenOfParent` | 9 | `subset`, nested JSON grouping in `construct` |
| `createOrganizationContext` | 5 | Internal; subset/diff use context indirectly |
| `isParentContext` | 6 | `subset` cascade, parent matching |
| `buildAncestryChain` | 4 | `diff` ordering, nested moves |
| `sortOrder` | 6 | `diff`, `subset` traversal order |
| `isReferenced` | 10 | `referencedBy`, `removeComponent` |
| `global preference for addition references` | 2 | edit-mode `merge`, `diff` |
| `implicitDescendantsOfAncestor` | 7 | `removeComponent` cascade, `subset` |

### Step 1a -- Layer A (smaller API files)

| File | ~`it` | Sweep | Redundancies | Gaps |
| --- | ---: | --- | --- | --- |
| `integration/standardForm.equals.test.ts` | 6 | [ ] | | |
| `integration/standardForm.isEmpty.test.ts` | 12 | [ ] | | |
| `integration/standardForm.referencedBy.test.ts` | 5 | [ ] | | |
| `integration/standardForm.finalize.test.ts` | 3 | [ ] | | |
| `integration/standardForm.lookup.test.ts` | 5 | [ ] | | |
| `integration/standardForm.assureComponents.test.ts` | 7 | [ ] | | |
| `integration/standardForm.validate.test.ts` | 7 | [ ] | | |
| `integration/standardForm.standardizeMode.test.ts` | 4 | [ ] | | |
| `integration/standardForm.removeComponent.test.ts` | 12 | [ ] | | |

### Step 1b -- Layer A (heavy API files)

| File | ~`it` | Sweep | Redundancies | Gaps |
| --- | ---: | --- | --- | --- |
| `integration/standardForm.construct.test.ts` | 15 | [ ] | | |
| `integration/standardForm.merge.test.ts` | 17 | [ ] | | |
| `integration/standardForm.keyChangesViaMerge.test.ts` | 9 | [ ] | | |
| `integration/standardForm.subset.test.ts` | 12 | [ ] | | |
| `integration/standardForm.diff.test.ts` | 30 | [ ] | | |
| `integration/standardForm.assetMeta.test.ts` | 31 | [ ] | | |

Also sweep [`index.test.ts`](../../../../../packages/mtw-wml/ts/standardize/index.test.ts) smoke (2 `it`) for gap-only check.

### Step 2a -- Layer B (thin integration + unit pairs)

| Integration file | ~`it` | Unit pair | Sweep | Redundancies | Gaps |
| --- | ---: | --- | --- | --- | --- |
| `components/guidance.integration.test.ts` | 1 | `guidance.test.ts` | [ ] | | |
| `components/message.integration.test.ts` | 1 | `message.test.ts` | [ ] | | |
| `components/moment.integration.test.ts` | 1 | `moment.test.ts` | [ ] | | |
| `components/worldState.integration.test.ts` | 2 | `worldState.test.ts` | [ ] | | |
| `components/situation.integration.test.ts` | 3 | `situation.test.ts` | [ ] | | |
| `components/feature.integration.test.ts` | 3 | `feature.test.ts` | [ ] | | |
| `components/feature.ephemeraWire.integration.test.ts` | 2 | `feature.test.ts` | [ ] | | |
| `components/knowledge.integration.test.ts` | 3 | `knowledge.test.ts` | [ ] | | |
| `components/knowledge.ephemeraWire.integration.test.ts` | 2 | `knowledge.test.ts` | [ ] | | |

### Step 2b -- Layer B (heavy integration + unit pairs)

| Integration file | ~`it` | Unit pair | Sweep | Redundancies | Gaps |
| --- | ---: | --- | --- | --- | --- |
| `components/map.integration.test.ts` | 3 | `map.test.ts` | [ ] | | |
| `components/room.integration.test.ts` | 19 | `room.test.ts` | [ ] | | |
| `components/room.ephemeraWire.integration.test.ts` | 9 | `room.test.ts` | [ ] | | |

### Step 3 -- Large unit files (informal integration check)

| File | Notes | Sweep | Redundancies | Gaps |
| --- | --- | --- | --- | --- |
| `components/room.test.ts` | ~1,464 lines; Character Integration stays unit | [ ] | | |
| `components/worldState.test.ts` | Lens/Mark unit bulk | [ ] | | |
| `components/map.test.ts` | Shared-ref case moved; verify remainder | [ ] | | |
| `components/guidance.test.ts` | Facet round-trip moved to integration | [ ] | | |

### Step 4 -- Consolidated findings (fill when sweeps complete)

**Redundancy backlog** (candidates for delete / move / narrow):

| Source file | Test (title) | Duplicate of | Proposed action |
| --- | --- | --- | --- |
| | | | |

**Gap backlog** (candidates for add / move from unit to integration):

| Behavior / API | Suggested owner file | Priority | Notes |
| --- | --- | --- | --- |
| | | | |

**Phase 4 sign-off:** [ ] All Step 0-3 rows swept or explicitly deferred with reason; [ ] Consolidated tables reviewed; gate suite still 226+ pass if any fix slices landed.

---

## Verification checklist

- [x] 64 ungrouped `it` rows classified
- [x] 16 top-level `describe` destinations filled
- [x] `room.test.ts` integration blocks listed
- [x] Overlap with facets + wmlStandardizeMode documented
- [x] Rename and delete candidates enumerated
- [x] Baseline 217 pass recorded
- [ ] Phase 4 section 8 sweeps complete (Step 0 [x]; Steps 1-3 pending)
