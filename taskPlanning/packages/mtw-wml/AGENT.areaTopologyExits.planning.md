# Area topology exits (platform initiative)

**Status:** In progress. **Milestone 0 (decisions)** complete; **Milestone 1** complete (WML + StandardArea asset mode); **Milestone 2** complete (persisted `referencedBy`); **Milestone 3** complete (projection library + gateways pull); **Milestone 4** complete (ephemera affordance pipeline); **Milestone 5** complete; **Milestone 6** next (forbid room-local exits + remove Room exit UI).

**Next step:** **Milestone 6** --- forbid room-local **`<Exit>`** under **`<Room>`** in asset mode, remove **`ExitEditor`** from Workbench, retire room-local authoring tests. **Production topology restore** (Coyote demo edges in **`AREA#WORLD`**) moves to [`AGENT.topologyRelationsRefactor.planning.md`](ts/AGENT.topologyRelationsRefactor.planning.md) Phase 4 after Area exit authoring is usable.

This plan is task-scoped. Delete it after the initiative ships; move lasting norms into package `AGENT.md` files next to code.

**Framework:** [`taskPlanning/AGENT.md`](../../AGENT.md)

---

## Purpose

Move **navigational topology** out of **Room content** and into **Area**:

- **Authoring (`standardizeMode: 'asset'`):** `<Exit>` under `<Room>` is **disallowed**. Rooms hold prose (Situation facets), references, etc., not edges.
- **Area:** `<Exit uuid=(...)>` with **`From`**, **`To`**, **`Forward`**, **`Back`** children (**D29**) --- not **`from=` / `to=`** attributes (attributes do not participate in **Replace** / **With** layering). At least **one** endpoint must be tied to the Area's **position graph** (**D4**). Edges are **always bidirectional** (**D1**, **D26**). Stable **`uuid`** on the edge (**D28**).

```xml
<Exit uuid=(highwayToTown)>
    <From>ROOM#highway</From>
    <To>ROOM#townCenter</To>
    <Forward>east</Forward>
    <Back>west</Back>
</Exit>
```

Standing in the **`From`** room, the player sees **`Forward`** toward **`To`**; standing in the **`To`** room, they see **`Back`** toward **`From`** (projection per **D16**).
- **Runtime (`standardizeMode: 'ephemeraWire'`):** `StandardRoom.exits` remains the **wire projection** for affordances and navigation, synthesized from Area edges + asset union --- not stored on the room blueprint row.

**Tradeoff (accepted):** We give up today's brutally efficient "read exits off the room row per asset" path in exchange for cleaner scopes of concern, topology edits by **reference**, and alignment with **Area v1** and the **room-affordances** channel.

**Related coordination (link only; do not re-decide here):**

| Doc | Role |
| --- | --- |
| [`lambda/ephemera/dataSource/AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) | Affordances own exits; render channel prose-only terminal path |
| [`taskPlanning/lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md`](../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) | Movement authority vs topology authority |
| [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) | **StandardArea** v1; edges were explicitly deferred |
| [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md) | `standardizeMode`, subset cascade, `referencedBy()` |
| [`lambda/assets/componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md) | Skinny invalidation + pull assembly precedent (**D18**) |
| [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | Ephemera durable cache + invalidate-then-hydrate-on-demand precedent (**D18**) |
| [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) | `ComponentExamples` / `ComponentAggregate` gateway cache handlers |

**Child plans (tracked in Milestones 2 and 4; both disposed --- see steady-state docs):**

- **M2 (disposed):** [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) + [`lambda/assets/componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md) --- **`referencedBy`** / **`cacheAsset`**, **`mtw.assets.componentTopology`**. *(Former task plan `taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md` removed.)*
- **M4 (disposed):** [`lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md) + [`affordanceCache/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md) --- **D30**, **D32-D38**, three-layer affordance pipeline, navigation

---

## Agreed direction (normative for this initiative)

1. Room-local exits are **not** authoring surface area; they are **ephemeraWire projection** only.
2. Area owns **edges**; updating topology is a change to Area (or its graph), not Room **content**.
3. **One projection function** (name TBD) feeds both affordance WML and command-time exit resolution (`getRoomExitTargetsForCharacter`).
4. **Persisted inverse references** (`referencedBy` or equivalent at blueprint / meta layer) are **required** for practical ephemera fetch --- in-memory `StandardForm.referencedBy()` is not sufficient at runtime scale. Index by **target `ComponentUUID`** (component-wide, not room-only); **v1 consumer** is topology (Areas referencing **`ROOM#`**). Align writer with per-component **`referencedKeys()`** ([`StandardForm.referencedBy`](../../../packages/mtw-wml/ts/standardize/index.ts)).
5. Delivery is **phased**; dual-read or migration tooling may be required (see **D23**).
6. **Bidirectional topology:** Every Area **exit edge** is traversable in both directions. Topology lives on **`StandardArea.positionGraph.edges`** (with **`nodes`**), not on Room blueprint rows. **`edges`** is a **union** (extensible); **`<Exit>`** is the **first** member shape (**D3**). Each edge has a stable **`uuid`** (**D28**) **local to that Area's `positionGraph`** (**D5b**). Layered assets merge edges by **`uuid`** inside one Area like components, but the same **`uuid` in two Areas is not one edge**. Endpoints are **`From`** / **`To`** (**D29**); labels are **`Forward`** / **`Back`** (**D26**). Runtime room wire still exposes a **single** outbound label per direction via projection (**D16**).
7. **Caching (D18):** Follow the **`componentExamples` + `renderCache`** split. **Assets** owns skinny topology invalidation and **pull** assembly (`mtw.assets.componentTopology` + gateways **`ComponentTopology`** handler). **Ephemera** owns durable affordance-topology rows: **push** catalog invalidation on **`TopologyInvalidated`**, **pull** hydrate-on-demand when a stale slice is next read (**D32**). **Persisted `referencedBy`** (**D8-D12**) is still required for cheap pull; the topology DataSource does **not** replace the inverse index.
8. **Inverse index (D8-D10):** Embed **`referencedBy`** on existing forward rows **`(targetUniversalKey, ASSET#assetId)`**; maintain on **`cacheAsset`** (**D9 B**, **D10**). Read via **`ComponentData`** pair load inside **`ComponentAggregate.get`** (**D31**).
9. **Plumbing (D31):** Strip **`referencedBy`** before **`StandardComponent`**; carry on **`ComponentPairRow`**; extend **[`MergedComponentResult`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts)** with **`referencedByUnion`** (same **`getAcrossAssets`** batch as merge --- no second fetch for topology). Callers that do not need inverse data use **`.merged`** only (**D30**, **ComponentExamples**).
10. **`ComponentStackMerge` refactor (D30):** **`ComponentAggregate.get`** -> **`result.merged`** for blueprint room fields; ignore **`referencedByUnion`**. Keep ephemera-only roster / **`objects`** and **ephemeraWire** envelope.
11. **Affordance pipeline (D37):** Mirror **`renderOrchestration` + `renderCache` + perception**. **`mtw.ephemera.affordanceOrchestration`** owns ingress (**`Affordances Requested`**), intake, **`ensureAffordanceTopology`** preflight, and stream outbounds. **`mtw.ephemera.affordanceCache`** owns invalidation, durable rows, and correlated **`Affordances Pertain`**. **`mtw.ephemera.perception`** owns terminal **`PublishMessage`** per occupant on **`Affordances Pertain`** --- legacy triggers (**`RoomUpdate`**, **`Objects Changed`**, topology fan-out) must **not** call publish helpers directly (**D37**). **`ComponentStackMerge`** remains an **`internalCache`** compose memo invoked from perception (and nav via shared slice helpers), not a pipeline ingress center (**D38**).

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../AGENT.md)
2. **WML / StandardForm:** [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)
3. **Area implementation:** [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardArea**)
4. **Facets today (one ref + payload):** [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md), [`exit.ts`](../../../packages/mtw-wml/ts/standardize/keys/facets/exit.ts) (room-local; superseded for Area topology by **D27**)
5. **Ephemera affordances + navigation:** [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) (`ComponentStackMerge`, `ComponentRender`), [`lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts), [`lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)
6. **Render pipeline precedent (required for M4):** [`lambda/ephemera/dataSource/renderOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md), [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md) (**`Render Requested`** -> **`ensureAuthoredCatalog`** -> **`Render Pertains`** -> perception terminal publish)
7. **Caching precedents (D18):** [`lambda/assets/componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md), [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**ComponentExamples** / **ComponentAggregate**)
8. **Asset persistence:** [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) (`Meta::${tag}`, `cacheAsset`)

**Test command authority:** [`packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md). If commands conflict, follow that file for `mtw-wml`; for ephemera/assets, use each lambda's `AGENT.testing.md` when child plans exist.

**Baseline (before edits):**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/components/area.test.ts ts/standardize/components/area.integration.test.ts ts/standardize/components/room.test.ts
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
```

---

## Decisions register

Mark decisions **`[X]`** in the **Status** column when normative. Milestone gates reference IDs below.

### Blockers --- data model and WML

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D1** | [X] | **Edge direction and player-visible exits** | **Always bidirectional.** WML: **`<Exit uuid=(...)>`** with **`From`**, **`To`**, **`Forward`**, **`Back`** (**D29**, **D26**). In **`From`** room, show **`Forward`** toward **`To`**; in **`To`** room, show **`Back`** toward **`From`**. No one-way edges; no separate `bidirectional` flag. |
| **D2** | [X] | **Exit-edge payload (authoring)** | Each **`<Exit>`** in **`positionGraph.edges`**: **`from`** / **`to`** as editable **`StandardReference`** slots (**D29**); **`forward`** / **`back`** as **`StandardLiteral`** (**D26**). Navigation: require non-empty projected label per direction (**D1**). Room wire projection may remain a single string per outbound `ExitFacet` (**D16**). |
| **D26** | [X] | **`Forward` / `Back` in Exit context** | Add **`Forward`** and **`Back`** as legal child tags under **Area** `<Exit>` in schema + converters (`mtw-base`, `mtw-wml`). Parse into **`StandardLiteral`** (same patterns as **`ShortName`**). Reject bare String children or legacy single-string exit body on Area edges in asset mode. Implement in Milestone 1 with **D3**. |
| **D29** | [X] | **`From` / `To` child tags (not attributes)** | **Reject** **`from=` / `to=`** on Area **`<Exit>`** --- attributes are not editable via **`<Replace>` / `<With>`** in layered assets. Use **`<From>`** and **`<To>`** with **`Parent`**-style wire: **String** body holding a **ComponentUUID** (e.g. `<From>ROOM#highway</From>`), parsed to **`StandardReference`** with full edit algebra --- **not** nested `<Room ... />` under **From** / **To**. Precedent: [`Parent` converter](../../../packages/mtw-wml/ts/schema/converters/components.ts). Layered retarget: `<Replace><To>ROOM#abc</To></Replace><With><To>ROOM#ghi</To></With>`. **Map / legacy room** `<Exit to=(...)>` remains a separate schema context until removed (**D6**). |
| **D3** | [X] | **`positionGraph` shape** | Extend v1 **`positionGraph: { nodes }`** to **`{ nodes, edges }`** on **`StandardAreaData`** / [`StandardPositionGraph`](../../../packages/mtw-wml/ts/standardize/components/positionGraph.ts). **`edges`**: union-ready list via **edge pattern** (**D27**); v1 member **`<Exit uuid=(...)>`** with **`From`**, **`To`**, **`Forward`**, **`Back`**. **Not** room **`ExitFacetList`**. WML: participant refs under **`<Area>`** for **`nodes`**; **`<Exit>`** blocks populate **`edges`**. Omit **`positionGraph`** when both **`nodes`** and **`edges`** are empty. |
| **D28** | [X] | **Edge `uuid` (edit identity)** | Each edge item has a stable **`uuid`** on **`<Exit uuid=(...)>`** (canonical id form TBD, e.g. **`EXIT#...`** in JSON). **Scoped to parent Area's `positionGraph`** (**D5b**) --- not global across Areas. **Not** keyed by **`(from, to)`** alone: retarget **`From`** / **`To`** in place via **D29**; **`Forward`** / **`Back`** stay on the same edge. **Contrast facets:** facet identity **is** the target **reference**. **D27** merge/diff/edit paths key off **`uuid`** within one **`EdgeList`**. |
| **D27** | [X] | **Edge pattern (two refs + payload)** | Pre-create **`standardize/keys/edges/`** parallel to [**facets**](../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md): **`{ uuid, from, to, payload }`** where **`from`** / **`to`** are **editable reference fields** (**D29**) and Exit **`payload`** is **`{ forward?, back? }`** (**D26**). List factory on **`positionGraph.edges`**. **Tagged union** (Exit first). **Do not** overload **`facetClassFactory`**. |
| **D4** | [X] | **Validation: one endpoint in graph** | For each **Exit** in **`positionGraph.edges`**: at least one of **`from`** or **`to`** must match a participant in **`positionGraph.nodes`** (same-key / same-universalKey as a node ref). **If neither endpoint is in `nodes`, standardization throws an error** (asset mode). One endpoint inside and one outside **`nodes`** is **allowed** (portal / border). |
| **D5** | [X] | **Duplicates vs navigation ambiguity** | **Intentional (not a bug):** Multiple **`positionGraph.edges`** items (distinct **`uuid`**, distinct **Forward** / **Back** labels) may share the same **`(From, To)`** pair --- e.g. "door" vs "window" between the same two rooms. **Not ambiguous** in the data model. **Navigation (unchanged):** After projection, [`resolveExitLabelToTargetId`](../../../lambda/ephemera/dataSource/actions/discriminateIntent/exitResolution.ts) **`ambiguousMatch`** only when the player's normalized command matches **more than one distinct target room** from the current room; same label + same target dedupes to one resolution. Layered asset merge for edges: **D5b**. |
| **D5b** | [X] | **Edge merge scope (`uuid`)** | Edges are **not** freestanding **`StandardComponent`**s, but **`uuid`** lets **`EdgeList.merge`** use **merge-by-`universalKey`** semantics **within one Area's `positionGraph`** when combining layered assets (e.g. canon defines **`<Exit uuid=(...)>`**, overlay **Replace**s **`<To>`** per **D29**). **Scope guard:** the same **`EXIT#...`** (or local uuid) in **different** Areas' **`positionGraph`s** is **not** the same edge --- edge identity is **local to the parent Area** / its **`positionGraph`**. Do not globalize edge uuids across Areas. |
| **D6** | [X] | **Room `exits` in asset JSON (transition)** | **Dual-read** until **M6** forbid: asset mode may still **ingest** room-local **`exits`** / **`<Exit>`** under **`<Room>`**. **M6:** room-local exits **illegal** in asset authoring (no longer gated on Area-edge migration --- production room-local data already cleared). **ephemeraWire** projection unchanged. |
| **D7** | [X] | **`Edge` reference type** | Add **`'Edge'`** to **`StandardComponentReferenceKey`** ([`baseClasses.ts`](../../../packages/mtw-wml/ts/standardize/components/baseClasses.ts)) for **Area `positionGraph.edges`** endpoint refs (**From** / **To**). **Do not** reuse **`'Position'`** (Map placement + structural parent tiers) or legacy **`'Exit'`** (room-local **`ExitsAndShortName`** subset). **Subset (normative):** cascade **`connectionType: 'Edge'`** -> target **Room** with **`requestType: 'Stub'`** (empty shell; no Situation/prose; **no** room-local exits copied). Mirror **Position** stub behavior only, not Map semantics. **SchemaOrganization:** treat **`Edge`** as **non-structural** (like **`Link`** / legacy **`Exit`** in [`standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)) --- do **not** add to **Direct**/**Position** parent tiers; **nodes** stay **Direct** for participation. **Milestone 1:** wire **`StandardArea.referencedKeys()`**, subset tests, and any cascade docs/examples that today say **Exit** for room-to-room. |

### Blockers --- persisted `referencedBy`

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D8** | [X] | **Index granularity (logical)** | **Target:** any **`ComponentUUID`** (same as in-memory **`referencedBy(StandardReference)`**). **Entry:** `{ referrerUniversalKey, referenceType? }` --- tag is **not** stored (**`AREA#...`** prefix is sufficient). **`assetId` omitted** when stored on **`(target, ASSET#)`** forward row (**D9**). **v1 read filter:** topology pull reads **`referencedBy`** on **`ROOM#r`** rows and keeps **`AREA#`** referrers (per **D14**). Forward rows **`(ComponentUUID, ASSET#assetId)`** are component bodies; **`referencedBy`** is derived inverse data colocated per **D9**. **`Meta::Room.cached`** = assets with a forward row, not the inverse list. See [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10). |
| **D9** | [X] | **Storage pattern** | **(B) Embed on forward row (chosen):** `referencedBy: [{ referrerUniversalKey, referenceType? }]` on **`(targetUniversalKey, ASSET#assetId)`** written by **`cacheAsset`**. Rejected for steady-state: **(A)** separate **`Meta::ReferencedBy::...`** rows (extra SK surface; **D12** diverges from **`ComponentAggregate`** batch); **(C)** rebuild-only scan. **(B)** aligns with **`ComponentPairRow`** + **`referencedByUnion`** (**D31**). |
| **D10** | [X] | **Writer** | **`cacheAsset` only** (no separate vertical in v1). On each cache pass, maintain **`referencedBy`** for targets touched by **`referencedKeys()`** on changed components --- **not** only rows in **`StandardForm.diff`** (Area edge edits must update target room/stub rows). See [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10). |
| **D11** | [X] | **Invalidation** | **Assets:** **`mtw.assets.componentTopology`** emits skinny **`TopologyInvalidated`** on Area **`positionGraph`** / edge edits, Room blueprint during **D6** dual-read, and **`referencedBy`** target patches from **`cacheAsset`** (**D10**) --- component ids, `editAssetId`, optional **`AREA#`** / edge **`uuid`** hints; **no** projected body on bus. **Ephemera (invalidate handler):** **`mtw.ephemera.affordanceCache`** bumps catalog / drops stale durable rows for affected **`ROOM#`** + **`perspectiveKey`** only --- **no** **`ComponentTopology.get`** on receive (mirror **`handleExampleInvalidated`**). **Layer participation (**D35**):** bump only catalog rows whose **`assetStack`** includes **`editAssetId`**. **Hydrate (pull):** deferred to **`affordanceOrchestration`** resolve (**D32**). **Republish:** **`TopologyInvalidated`** fans out **`Affordances Requested`** (**reason: topology**) via **`affordanceOrchestration`** (**D37**). **`RoomCharacterList`** / **`Meta::Room.objects`** -> **`Affordances Requested`** (**reason: roster** / **objects**). Detail: [Affordance pipeline (M4)](#affordance-pipeline-m4) and ephemera child plan. |
| **D12** | [X] | **Cross-asset scope** | For target **`ROOM#r`**: one **`ComponentAggregate.get({ universalKey: ROOM#r, mergeParticipationOrder })`** yields **`merged`** + **`referencedByUnion`** (**D31**). Filter **`AREA#`** referrers; batch **`ComponentAggregate.get`** for those Area perspectives at the **same** **`mergeParticipationOrder`** (**D30**). Optional per-asset **`referencedBy`** on authoritative envelope for diagnostics only. **Participation order** (ephemera perspective / asset stack) selects which **`(component, ASSET#)`** rows **`getAcrossAssets`** loads --- not **`Meta::Import`** (**D13**). |
| **D13** | [X] | **Imports / import vertical (out of scope)** | **`Meta::Import::...`** ([`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md)) records **inheritance hops** for one **universalKey** across assets (`_from`: child asset inherits parent asset's appearance). It answers **which parent asset rows to walk** on **`fetchImports`** / import-defaults assembly --- **not** "which **Area** components reference **ROOM#r**." Topology discovery uses **`referencedByUnion`** (**D8-D10**, **D31**) plus **`mergeParticipationOrder`** (**D12**). **No** topology read path queries the import vertical. **Track separately:** **`SchemaImportMapping`** / asset graph gaps (**C4**), not this initiative's referrer model. |
| **D31** | [X] | **Plumb `referencedBy` (gateway envelope)** | **Dynamo:** **`referencedBy`** on forward row JSON (**D9 B**). **`mtw-wml`:** **do not** add **`referencedBy`** on **`StandardComponent`** --- not authoring state; must not run through **`StandardRoom.merge`**. **Gateways:** strip in [`fetch.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/fetch.ts); **`ComponentPairRow.referencedBy?`**; [`authoritativeFromParticipationOrder`](../../../packages/mtw-gateways/ts/assets/components/componentData/participationBatch.ts) preserves per-asset lists from the same **`getAcrossAssets`** batch already used for merge. Extend **[`MergedComponentResult`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts)** with **`referencedByUnion?: PersistedReferencedByEntry[]`** (union across **`mergeParticipationOrder`**, **D12** --- not **`merge()`**). **`ComponentAggregate.get`** returns **`Promise<MergedComponentResult[]>`**; existing callers use **`.merged`** only; topology uses **`.referencedByUnion`**. Rejected: optional field on all **`StandardComponent`** classes; separate topology-only **`getAcrossAssets`** when aggregate already loaded the row. See [Plumb persisted `referencedBy` (D31)](#plumb-persisted-referencedby-d31). |

*Precedents:* forward component rows and **`Meta::${tag}.cached`** --- [`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md), [`lambda/assets/README.md`](../../../lambda/assets/README.md). Import vertical --- [`verticals/AGENT.md`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) (orthogonal to topology; **D13**).

### Projection --- runtime assembly

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D14** | [X] | **Which Areas to consult for room R** | **v1 (affordances / nav exits):** **`AREA#`** ids in **`referencedByUnion`** from **`ComponentAggregate.get(ROOM#R)`** where the Area references **R** as an edge endpoint (**`From`** / **`To`** only --- same filter as **D8** v1 consumer). Batch **`ComponentAggregate.get`** for those Areas (**D12**). **Out of scope v1:** Areas where **R** is only in **`positionGraph.nodes`** (no edge touching **R**) --- not needed for exit affordances as recorded today. **Future expansion (track only):** node-only membership may matter when **Area-level Features** (or similar) should be visible from every room in the Area without an edge; may also intersect **positions** "active area." Rejected v1: scan all Areas in the participation stack without **`referencedByUnion`**. |
| **D15** | [X] | **Merge order** | Layer Area edge sets and room projection using **`ComponentAggregate`** **`mergeParticipationOrder`** --- the same stable order as **D30** / ephemera **`perspectiveKey`**. **Not** **`mergeRoomExitsToJSON`** concat. Area **`EdgeList.merge`** runs inside each merged **`StandardArea`** after cross-asset participation fold (**D5b**). |
| **D16** | [X] | **Outbound wire shape** | **`projectRoomExits(ROOM#R, ...)`** builds one **`ExitFacetList`** for **R**. For each Area edge, **at most one** facet in **R**'s list: if **R** is **`from`**, emit `reference` = **`to`** room, payload = **`Forward`**; if **R** is **`to`**, emit `reference` = **`from`** room, payload = **`Back`** (**D1**). **Normal A -> B:** one facet on **A**'s list and one on **B**'s list from that edge --- not two on **A**. **Self-loop (`From` = `To` = R):** up to **two** facets on **R**'s list (both roles). **Portal (**D17**):** one facet when only one endpoint is **R**. Output on **`StandardRoom.exits`** in **ephemeraWire** for client/nav parity (**D21**). |
| **D17** | [X] | **Portal / outside endpoint (**D4**)** | In-graph **R** gets **one** facet per edge (**D16**). Player-facing affordance from **R** when **R** is **`from`** or **`to`**. **`ExitFacet.reference`** / movement resolution requires the **other** endpoint to resolve to **`ROOM#`**; non-room peers are not nav targets in v1 (label-from-**R** behavior at implement time). |
| **D18** | [X] | **Caching (`renderCache` analogue)** | **Assets:** **`mtw.assets.componentTopology`** DataSource (like **`mtw.assets.componentExamples`**) --- subscribe to topology-relevant **`Component Updated` / `Removed`** (Area **`positionGraph`**, Room during **D6** dual-read); publish skinny **`TopologyInvalidated`** only. **Gateways:** **`assembleRoomTopologyAtPerspective`** + **`createComponentTopologyCacheHandler({ ComponentAggregate })`** --- room perspective via **`ComponentAggregate.get`** -> **`referencedByUnion`** + batch Area **`merged`** (**D31**); **`projectRoomExits`** (**D16**). Ephemera registers **`internalCache.ComponentTopology`**. **Ephemera:** **`mtw.ephemera.affordanceOrchestration`** + **`mtw.ephemera.affordanceCache`** --- Dynamo slice per **`(ROOM#, perspectiveKey)`**; **invalidate on bus**, **hydrate-on-demand on orchestration resolve** (**D32**, not in invalidation handler); **`Affordances Pertain`** -> perception terminal publish (**D37**). See [Caching architecture (D18)](#caching-architecture-d18), [Affordance pipeline (M4)](#affordance-pipeline-m4). |

### Product, authoring, client

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D19** | [X] | **Workbench Area editor** | **Area** workbench surface (not edges-only): **`shortName`**, **`positionGraph.nodes`**, **`positionGraph.edges`**. **Edges:** select/update by **`uuid`**; retarget **`From`** / **`To`** in place; edit **`Forward`** / **`Back`**. **Room** editor: remove room-local exit authoring UI in **M6** (with asset-mode forbid). Area exit UX fixes tracked in [`AGENT.topologyRelationsRefactor.planning.md`](ts/AGENT.topologyRelationsRefactor.planning.md). |
| **D20** | [X] | **Client merge** | Affordances channel still `render.merge(affordances)`; exits only on affordances projection |
| **D21** | [X] | **RoomExit UI** | **Confirmed:** **`RoomExit`** chips unchanged if **D16** holds (same **`StandardExitFacet`** wire). **No manual parity smoke test** --- not planned; rely on **`projectRoomExits`** / ephemera projection tests (**D16**) and affordances-channel integration. |
| **D22** | [X] | **Parse / LLM** | `movementExitLabels` stable if projection stable |

### Migration

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D23** | [X] | **Migration strategy** | **Original:** dual-read until production room-local exits migrated into Area **`positionGraph.edges`**, then M6 forbid. **Revised (2026):** production room-local exits already removed manually --- there is temporarily **no** navigational connective tissue between rooms. **M6 forbid** proceeds without waiting for Area-edge restore. **Restore topology (follow-up):** [`AGENT.topologyRelationsRefactor.planning.md`](ts/AGENT.topologyRelationsRefactor.planning.md) Phase 4 --- re-author or script demo edges into **`AREA#WORLD`** using [Production exit inventory](#production-exit-inventory-coyote-demo) once Area exit authoring works (Phases 1-3 of that plan). |
| **D24** | [X] | **Canon / production** | **Operator:** room-local exits cleared from production DB (no **`positionGraph.edges`** yet). Full Area-edge restore is a separate follow-up after Workbench Area exit editing is usable; inventory below is the reference spec. |
| **D25** | [X] | **Test matrix** | Add Area edge, **`projectRoomExits`**, and ephemera topology tests. **Retire** room-local exit **authoring** tests only when room-local authoring is removed (**D23** M6 follow-up) --- same gate as forbid, not earlier. |

### Ephemera --- `ComponentStackMerge` consolidation

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D30** | [X] | **`ComponentStackMerge` uses `ComponentAggregate`** | **Replace** [`componentStackMerge.ts`](../../../lambda/ephemera/internalCache/componentStackMerge.ts) **`getAcrossAssets` + `mergeRoomExitsToJSON` / `mergeRoomShortNameLiteral`** with **`internalCache.ComponentAggregate.get`** at **`mergeParticipationOrder`** derived from the same global + character asset list as today. **Discard** merged blueprint fields not needed for affordances (situations, features, lens, render on room, etc.). **Keep** ephemera-only: **`RoomCharacterList`**, **`Meta::Room.objects`**, **`ephemeraWire`** **`StandardForm`** envelope. **Why:** `mergeRoomExitsToJSON` **concatenates** per-asset room **`exits`** --- wrong for layered assets (e.g. canon **D,E** + import overlay removing **D** and adding **F** yields **D,E,F** instead of **E,F**). That divergence from **`StandardRoom.merge`** / **`ComponentAggregate`** is a **bug**, not a feature. **Cost:** extra in-memory merge work per miss; acceptable for one merge authority. **Follow-up (track, not D30):** **`ComponentRender`** still uses **`mergeRoomExitsToJSON`** for nav ([`roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)) --- align to aggregate or **affordanceCache** / topology slice in Milestone **4** (**D34**). See [ComponentStackMerge refactor (D30)](#componentstackmerge-refactor-d30). **Gate:** land **before** or at start of Milestone **4**; **D8-D10** ephemera reads assume **D30** participation order. |

### Blockers --- Ephemera affordance pipeline (M4)

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D32** | [X] | **Hydrate-on-demand entry point** | **Normative:** invalidation handler bumps catalog only; **`ensureAffordanceTopology`** runs in **`orchestrateAffordanceRequest`** ([`affordanceOrchestration`](../../../lambda/ephemera/dataSource/affordanceOrchestration/)) **after intake, before** slice read / cache handoff --- same placement as [`ensureAuthoredCatalog`](../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts) in [`orchestrationHandler.ts`](../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts). **Rejected:** eager hydrate in **`handleTopologyInvalidated`**; hydrate inside **`ComponentStackMerge.get`**; hydrate inside **`AffordanceCache.get`** as a hidden side effect. **Nav:** calls exported **`ensureAffordanceTopology`** + slice read directly (**D34**); does not run full publish orchestration. Module lives under **`affordanceCache/`**; orchestration **calls** it. Detail: [Affordance pipeline (M4)](#affordance-pipeline-m4). |
| **D33** | [X] | **Durable row / catalog schema (colocated v1)** | **One row per perspective:** **`Affordance::${perspectiveKey}`** under **`ROOM#`** with **`assetStack`**, **`catalogVersion`**, **`hydratedCatalogVersion`**, and embedded **`ProjectedRoomTopology`** ( **`exits`** as **`ExitFacetList`** JSON from gateways [`result.ts`](../../../packages/mtw-gateways/ts/assets/components/componentTopology/result.ts)). **Rejected for M4:** split catalog + separate **`TOPOLOGY#`** / **`AFFORDANCES#`** body row(s) --- v1 is **1:1** deterministic projection (not render's multi-**`CACHE#`** cardinality). **Follow-on:** if a **second** durable slice per perspective is needed (e.g. LLM enrichment separate from deterministic exits), introduce a split row layout then --- do not pre-split for symmetry alone. **Must** gate reads on **`catalogVersion` / `hydratedCatalogVersion`** (stale **`exits`** on the row must not be served after invalidation). **Must not** store full ephemeraWire (roster / **`objects`** stay ephemera-only; composed in perception via **D38**). Catalog prefix mirrors render **`Cache::`** meta-row convention; affordance-specific prefix avoids collision with render rows on the same **`ROOM#`**. |
| **D34** | [X] | **Navigation exit source (sync bypass)** | **Normative (M4):** [`getRoomExitTargetsForCharacter`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts) calls exported **`ensureAffordanceTopology`**, then reads projected **`exits`** via **`internalCache.AffordanceCache`** (colocated **`Affordance::`** row, **D33**) --- **not** **`ComponentRender`**. **Does not** enqueue **`Affordances Requested`**, emit **`Affordances Pertain`**, or **`PublishMessage`**. **Shared projection:** same **`ProjectedRoomTopology`** / **`ExitFacetList`** as affordance publish (**D16**, **D21**). **Documented limitations (accepted v1):** (1) nav is a **synchronous command path** --- may block on hydrate / single-flight (**D36**) in-process; (2) nav does **not** fan out affordance-channel updates to room occupants; (3) future LLM enrichment slice (if any) is **out of scope** for nav until product revisits --- nav uses deterministic topology slice only. **Rejected:** routing nav through full **`affordanceOrchestration`** event pipeline for M4. |
| **D35** | [X] | **Layer participation on invalidation** | **Normative:** mirror **`renderCache`** --- for each listed **`roomId`**, query **`Affordance::`** catalog rows and bump only those whose stored **`assetStack`** includes **`TopologyInvalidated.editAssetId`** ([`assetStackIncludesEditAssetId`](../../../packages/mtw-gateways/ts/assets/components/componentExamples/membership.ts)); same handler shape as [`handleExampleInvalidated`](../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts) + [`catalogRowMatchesEditAssetId`](../../../packages/mtw-gateways/ts/ephemera/renderCache). **Rejected:** coarse bump of all perspectives for a room regardless of edit layer. **Area-scoped v1 (**no `roomIds`**):** handler no-op (catalog bump and topology **`Affordances Requested`** fan-out require room targets); rare (e.g. Area removal with empty **`positionGraph`**). **Future:** assets expands affected **`roomIds`** on emit when recoverable from persisted state. |
| **D36** | [X] | **Hydrate single-flight** | **Normative:** mirror [`ensureAuthoredCatalog`](../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts) + [`singleFlightAuthoredCatalogHydrate`](../../../lambda/ephemera/dataSource/renderCache/singleFlightAuthoredCatalogHydrate.ts) --- wrap stale hydrate in **`singleFlight`** (**coalesce** mode) keyed **`roomId::perspectiveKey`**. **All callers** (orchestration, nav) use the same exported **`ensureAffordanceTopology`**; concurrent callers join one cohort --- no separate nav vs orchestration pools. **Leader `computation`:** re-check stale, **`ComponentTopology.get`**, version-guarded persist. **Follower `retrieval`:** poll catalog until not stale (render **catalog hydrate** pattern --- **not** the asymmetric **`generateRoomPreview`** generation follower). **Accepted library limits:** leader timeout / self-promote may duplicate hydrate work; version-guarded writes keep this safe. **Rejected:** nav bypassing singleFlight; caller-type-specific follower policies. |
| **D37** | [X] | **Three-layer affordance pipeline** | **Normative (M4):** mirror render pass-through. **`mtw.ephemera.affordanceOrchestration`:** subscribe **`Affordances Requested`** ingress (internal stream + adapters from **`RoomUpdate`**, **`Objects Changed`**, **`TopologyInvalidated`** fan-out); **`orchestrateAffordanceRequest`** runs intake -> **`ensureAffordanceTopology`** -> stream outbounds (**`Slice Ready`**, **`Orchestration Error`** v1-active; skipped tests for future enrichment outbounds). **`mtw.ephemera.affordanceCache`:** **`handleTopologyInvalidated`** (catalog bump only); subscribe orchestration outbounds; on hydrate / hit emit **`Affordances Pertain`**. **`mtw.ephemera.perception`:** subscribe **`Affordances Pertain`**; terminal **`PublishMessage`** per occupant (**`roomChannel: 'affordances'`**). **Rejected:** legacy triggers calling **`publishRoomAffordancePerceptionMessages`** directly once orchestration ships. Precedent: [`renderOrchestration`](../../../lambda/ephemera/dataSource/renderOrchestration/AGENT.md) -> [`renderCache`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md) **`Render Pertains`** -> [`orchestrate.ts`](../../../lambda/ephemera/dataSource/perception/orchestrate.ts). Detail: [Affordance pipeline (M4)](#affordance-pipeline-m4). |
| **D38** | [X] | **`ComponentStackMerge` role** | **Normative:** **`ComponentStackMerge`** stays in **`internalCache`** as an **invocation-memo compose helper** --- topology slice + **`ComponentAggregate`** **`shortName`** + ephemera-only **`RoomCharacterList`** / **`Meta::Room.objects`** -> **`ephemeraWire`** **`StandardForm`**. **Called from** perception terminal handler on **`Affordances Pertain`** (not from bus ingress). **Does not** own hydrate, orchestration, or **`PublishMessage`**. **Rejected for M4:** folding compose into perception inline with no memo; **`ComponentStackMerge`** as pipeline ingress center. **Future LLM enrichment:** slow path lives in **`affordanceOrchestration`** + durable slice in **`affordanceCache`**; perception still composes/publishes on **`Affordances Pertain`**. Detail: [ComponentStackMerge vs perception (D38)](#componentstackmerge-vs-perception-d38). |

### Coordination (track only)

| ID | Topic |
| --- | --- |
| **C1** | Positions DataSource vs topology --- [`AGENT.positionsDataSource.planning.md`](../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) |
| **C2** | Multi-channel affordances --- [`AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) |
| **C3** | Map `Position` facets vs Area topology --- division of labor |
| **C4** | Area import mapping gap (`SchemaImportMapping`) --- [`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) |
| **C5** | Gateway cache registration --- [`.cursor/rules/gateways-internal-cache.mdc`](../../../.cursor/rules/gateways-internal-cache.mdc); **`ComponentTopology`** on Ephemera **`internalCache`** |
| **C6** | **`ComponentStackMerge` -> `ComponentAggregate`** (**D30**); parity with [`componentAggregate.mergeParity.test.ts`](../../../lambda/assets/componentAggregate.mergeParity.test.ts) |
| **C7** | **`referencedByUnion` on `MergedComponentResult`** (**D31**); [`aggregate/result.ts`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts), [`participationBatch.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/participationBatch.ts) |
| **C8** | **Affordance pipeline** (**D32-D38**); **`affordanceOrchestration`** + **`affordanceCache`** + perception; ephemera child plan |

---

## Milestone gates

| Milestone | Blocked until |
| --- | --- |
| **1** WML + `StandardArea` (asset mode) | **D1-D7**, **D5b**, **D26-D29** [X] |
| **2** Persisted `referencedBy` | **D8-D13** [X], **D31** [X]; **`cacheAsset`** + pair strip/carry + **`referencedByUnion`** on **`MergedComponentResult`** |
| **3** Projection library + gateways pull | **D1-D6**, **D14-D17** [X]; **`projectRoomExits`**; **`mtw-gateways/ts/assets/components/componentTopology/`** (**`createComponentTopologyCacheHandler`**, primary) |
| **4** Ephemera + assets caching integration | **D2**, **D11**, **D14-D18** [X], **D30** [X], **D32-D38** [X], Milestones **2-3**; **`affordanceOrchestration`** + **`affordanceCache`** + perception (**D37**) |
| **5** Authoring | **D19-D24** [X], Milestone **1**; Area workbench first draft (**D19**); **D20** Phase C merge shipped; topology restore -> topology refactor Phase 4 |
| **6** Cleanup + durable docs | Prior milestones; forbid room-local exits + UI (**D25** test retirement); delete this plan |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [X] **Milestone 0 --- Decision spike**
  - [X] **D1** --- bidirectional edges; **Forward** / **Back** WML shape (see [Decisions register](#decisions-register)).
  - [X] **D28** --- stable **`uuid`** per edge for edits; endpoints are not the identity key.
  - [X] **D2**, **D26**, **D3**, **D27**, **D29** --- payload, **`positionGraph.edges`**, edge pattern, **`From`** / **`To`** children.
  - [X] **D4** --- at least one endpoint in **`nodes`**; **error** if neither.
  - [X] **D5** --- multi-edge same room pair + distinct labels is allowed; nav **ambiguousMatch** only on label -> multiple targets.
  - [X] **D5b** --- merge edges by **`uuid`** within one Area **`positionGraph`**; **`uuid`** not global across Areas.
  - [X] **D6** --- dual-read room-local exits until **M6** forbid (production room-local data already cleared; forbid no longer gated on Area-edge restore).
  - [X] **D7** --- new **`Edge`** `referenceType` for edge **From** / **To**; subset **Stub** via **`connectionType: 'Edge'`**; non-structural for org graph.
  - [X] **D18** --- **`componentTopology`** + **`affordanceOrchestration`** + **`affordanceCache`** pipeline (see [Caching architecture (D18)](#caching-architecture-d18)).
  - [X] **D8-D10** --- embed **`referencedBy`** on **`(target, ASSET#)`** forward rows; **`cacheAsset`** writer (see [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10)).
  - [X] **D31** --- **`ComponentPairRow`** strip/carry; **`referencedByUnion`** on **`MergedComponentResult`** (see [Plumb persisted `referencedBy` (D31)](#plumb-persisted-referencedby-d31)).
  - [X] **D30** --- **`ComponentStackMerge`** -> **`ComponentAggregate`** (see [ComponentStackMerge refactor (D30)](#componentstackmerge-refactor-d30)).
  - [X] **D11-D13** --- invalidation sketch (**D18**); cross-asset read via **`referencedByUnion`** (**D12**); import vertical out of scope (**D13**).
  - [X] **D14-D15** --- Area fan-out via **`referencedByUnion`** (edge endpoints only); **`mergeParticipationOrder`** for all folds (**D30**).
  - [X] **D16-D17** --- **`projectRoomExits`** wire shape; portal / outside endpoint nav rules.
  - [X] **D19-D22** --- Area workbench scope; client affordances merge; **RoomExit** confirmed; LLM labels stable with projection.
  - [X] **D23-D25** --- production room-local exits cleared; M6 forbid not gated on Area-edge restore; test retirement gated on forbid.
  - [X] Production room-local exit inventory --- see [Production exit inventory (Coyote demo)](#production-exit-inventory-coyote-demo) (reference for restore).

- [X] **Milestone 1 --- WML + StandardArea (asset mode)**
  - [X] **Schema (Area topology exits, D26 / D29):** one global **`<Exit>`** parse surface (no context-forked converters); legacy **`to=`** and new **`uuid=`** + child tags both parse; **D29** / **D6** rules enforced in **Standardize**, not schema parent context.
    - [X] **`mtw-base`:** register **`From`**, **`To`**, **`Forward`**, **`Back`** on **`tagType`** (Forward/Back via **`literalTagFactory`**; From/To like **`Parent`**).
    - [X] **Widen `<Exit>`:** optional **`uuid`** and optional **`to`** on **`SchemaExitTag`**; **`typeCheckContents`** allows **From** / **To** / **Forward** / **Back** (and edit wrappers), not only **String**; print map round-trips both shapes (room/map **`to=`** path unchanged).
    - [X] **Child converters + tests:** From/To ComponentUUID validation (**Parent** precedent); Forward/Back literals; fixtures for normative **D29** shape (including layered **Replace** on **To**).
    - [X] **Dual-read guard:** **`<Exit to=(...)>`** under **`<Room>`** (and Map) still parses/round-trips (**D6**); **`StandardRoom`** ignores Area-shaped exits (no usable **`to`** / structural children --- see existing facet skip); M6 asset-mode forbid remains on **Room** ingest, not schema.
  - [X] **Edge pattern** (**D27-D29**): **`uuid`** + editable **`from`** / **`to`** (**Parent**-style **From** / **To** tags) + literal payload; list class and factory; merge/diff keyed by **`uuid`**; layered **Replace** on **From** / **To**; **`StandardArea`** edge consumer enforces **D29** (reject **`from=`** / **`to=`** attributes, require child endpoints); asset-mode errors on bad Area edges --- defer strict Room-local forbid to M6 (**D23**).
  - [X] Add **`Edge`** to **`StandardComponentReferenceKey`**; subset cascade + tests for **`connectionType: 'Edge'`** -> **Stub** (**D7**).
  - [X] Extend **`StandardPositionGraph`**: **`positionGraph.edges`** as **`ExitEdgeList`** alongside **`nodes`**; **`referencedKeys()`** emits **From** / **To** as **`referenceType: 'Edge'`**.
  - [X] Validation for **D4** (error when neither endpoint in **`nodes`**); tests in `area.test.ts` / `area.integration.test.ts`.
  - [X] Update [`AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardArea** edges) when behavior is stable.

- [X] **Milestone 2 --- Persisted `referencedBy` (assets + gateways)**
  - [X] **Assets (disposed child plan):** [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) + [`componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md) --- **`cacheAsset`** writer, **`referencedBy`** tests, **`mtw.assets.componentTopology`** invalidation (**D8-D11**). *(Former task plan `taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md` removed.)*
  - [X] Extend **`cacheAsset`**: compute **`referencedBy`** from in-memory **`fileAsset`** / diff; patch **`(target, ASSET#)`** rows beyond **`diff._components`** when inverse changes (**D10**).
  - [X] **`mtw-gateways`:** **`PersistedReferencedByEntry`** type; strip **`referencedBy`** in **`fetch.ts`**; extend **`ComponentPairRow`** / **`ComponentDataCache`** (**D31**).
  - [X] **`ComponentData`:** pair rows carry **`referencedBy`**; **`getAcrossAssets`** feeds **`participationBatch`** with per-asset lists.
  - [X] **`MergedComponentResult.referencedByUnion`** + union helper (**D31**, **D12**); golden test: two assets, two referrers, dedupe rules documented.
  - [X] **`ComponentExamples`** / other aggregate callers: verify unchanged (use **`.merged`** only).
  - [X] Invalidation contract (**D11**); tests in assets lambda; index updates drive **`TopologyInvalidated`** via **`mtw.assets.componentTopology`** (see [`componentTopology/AGENT.md`](../../../lambda/assets/componentTopology/AGENT.md)).

- [X] **Milestone 3 --- Projection library + gateways pull (`mtw-wml` + `@tonylb/mtw-gateways`)**
  - [X] **Naming / layout (normative):** mirror **`componentExamples`** + **`renderCache`** split ([`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md)); detail in [Gateways `componentTopology` module (M3)](#gateways-componenttopology-module-m3).
  - [X] **`mtw-wml` --- `projectRoomExits`:** pure projector (finalize name per **D16**). Inputs = **`ROOM#`**, merged **`StandardArea`** edge sets at **`mergeParticipationOrder`** (**D14-D15**); output = **`ExitFacetList`** JSON. Golden tests; document merge semantics (**D15**, **D5**). No Dynamo, no **`InternalCache`**.
  - [X] **mtw-gateways:** new [`ts/assets/components/componentTopology/`](../../../packages/mtw-gateways/ts/assets/components/componentTopology/) (compute-only; reuse **D31** types from **`componentData`** / **`aggregate`** --- do not duplicate **`referencedBy`** plumbing):
    - [X] File roles: **`ports.ts`**, **`input.ts`**, **`result.ts`**, **`keys.ts`**, **`assemble.ts`**, **`factory.ts`**, **`index.ts`** (same layout as [`componentExamples/`](../../../packages/mtw-gateways/ts/assets/components/componentExamples/)).
    - [X] **Primary:** **`ComponentTopologyMergedCache`** / **`createComponentTopologyCacheHandler({ ComponentAggregate })`**; **`componentTopologyPerspectiveCacheKey`** uses **`roomUniversalKey::computePerspectiveKey(mergeParticipationOrder)`** (aligned with **`aggregatePerspectiveCacheKey`** / **`componentExamplesPerspectiveCacheKey`**).
    - [X] **Secondary:** **`assembleRoomTopologyAtPerspective`** in **`assemble.ts`** --- package tests, goldens, parity only; **not** lambda steady-state hydrate (same rule as **`assembleComponentExamplesAtPerspective`**).
    - [X] Assembly pipeline: **`ComponentAggregate.get(ROOM#)`** -> **`.referencedByUnion`** (filter **`AREA#`**, edge endpoints only, **D14**) -> batch Area **`get`** at same **`mergeParticipationOrder`** (**D12**) -> **`projectRoomExits`** (**D16**). No second **`getAcrossAssets(ROOM#)`** beyond aggregate batch (**D31**).
    - [X] Update **`packages/mtw-gateways/AGENT.md`**: ownership table row + **Component topology read surfaces (primary vs secondary)** subsection.
  - [X] **Explicit M3 non-goals:** Ephemera **`internalCache.ComponentTopology`** registration; **`mtw.ephemera.affordanceCache`** Dynamo rows; ephemeraWire **`StandardRoom.exits`** on affordance publish; **D30** **`ComponentStackMerge`** refactor (all **M4**).

- [X] **Milestone 4 --- Ephemera caching integration + affordance pipeline**
  - [X] **Ephemera (disposed child plan):** [`lambda/ephemera/dataSource/affordanceOrchestration/`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md) + [`affordanceCache/`](../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md) --- **D32-D38**, perception terminal publish, navigation, **D11** invalidation matrix. *(Former task plan `taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md` removed after M4 shipped.)*
  - [X] **Assets M4 verification (disposed with M2 child plan):** M3 gateways module landed; Ephemera hydrate via **`ComponentTopology.get`** shipped; assets **`componentTopology/`** tests pass.
  - [X] **D32-D38** locked (orchestration preflight, colocated row, nav sync bypass, layer participation, single-flight hydrate, pipeline, compose role).
  - [X] **D30:** Refactor **`ComponentStackMerge`** to **`ComponentAggregate`**; remove **`mergeRoomExitsToJSON`** from affordance path; tests for layered exit overlay (**D,E** + remove **D** + add **F** -> **E,F**).
  - [X] Scaffold **`mtw.ephemera.affordanceOrchestration`** DataSource --- shell, **`Affordances Requested`** ingress types, **`orchestrateAffordanceRequest`** stub, stream outbound contracts ([`lambda/ephemera/dataSource/affordanceOrchestration/`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md)).
  - [X] Migrate **`RoomUpdate`** / **`Objects Changed`** -> **`Affordances Requested`** (**no direct publish**; ephemera child plan).
  - [X] Ephemera: register **`createComponentTopologyCacheHandler`** on **`internalCache.ComponentTopology`**; steady-state reads call **`get`**, not uncached **`assembleRoomTopologyAtPerspective`** ([`.cursor/rules/gateways-internal-cache.mdc`](../../../.cursor/rules/gateways-internal-cache.mdc)).
  - [X] Ephemera: **`mtw.ephemera.affordanceCache`** DataSource + **`ts/ephemera/affordanceCache/`** gateway --- **`TopologyInvalidated`** catalog bump; **`ensureAffordanceTopology`** module; emit **`Affordances Pertain`** on slice ready.
  - [X] **`mtw.ephemera.perception`:** subscribe **`Affordances Pertain`**; terminal publish via **`ComponentStackMerge`** compose (**D38**); retire direct **`publishRoomAffordancePerceptionMessages`** ingress.
  - [X] **`StandardRoom` in ephemeraWire:** populate **`exits`** from hydrated topology slice; **`getRoomExitTargetsForCharacter`** shares slice path (**D34**).
  - [X] Close **D11** invalidation matrix in child plans; verify `roomChannel: 'affordances'`.

- [X] **Milestone 5 --- Authoring**
  - [X] Workbench **Area** editor first draft (**D19**): **`shortName`**, **`nodes`**, **`edges`** (by **`uuid`**, retarget **From** / **To**, **Forward** / **Back**). See [`charcoal-client/src/components/Workbench/AreaEdit/`](../../../charcoal-client/src/components/Workbench/AreaEdit/). Usable exit-edge authoring tracked in [`AGENT.topologyRelationsRefactor.planning.md`](ts/AGENT.topologyRelationsRefactor.planning.md).
  - [X] Production room-local exits removed manually (**D24**); no Area **`positionGraph.edges`** yet --- temporary gap until topology restore (Phase 4 of topology refactor plan).
  - [X] Inventory captured in plan ([Production exit inventory (Coyote demo)](#production-exit-inventory-coyote-demo)) as reference for restore.
  - [X] Charcoal-client: affordances merge (**D20**) --- Phase C **`mergePerceivedRoomForms`** shipped ([`roomHeaderPhaseC.ts`](../../../charcoal-client/src/slices/messages/roomHeaderPhaseC.ts), [`VirtualMessageList`](../../../charcoal-client/src/components/Message/VirtualMessageList.tsx)); exits arrive via affordances channel from Area-projected topology, not client-side Area assembly.

- [ ] **Milestone 6 --- Cleanup (**D25**)**
  - [ ] Forbid room-local **`<Exit>`** under **`<Room>`** in asset mode; remove dual-read ingest from **`StandardRoom`**.
  - [ ] Remove room-local exit UI from Room edit component (**D19** --- **`ExitEditor`**).
  - [ ] Retire room-local exit **authoring** tests (**D25** --- same gate as forbid).
  - [ ] Durable docs: `mtw-wml` AGENT files, ephemera internalCache AGENT, multi-channel contract cross-links.
  - [ ] Delete this plan.

---

## Production exit inventory (Coyote demo)

**Current production state:** Room-local exits have been removed; Area topology edges are not yet authored. This section is the **reference spec** for restoring navigational connective tissue. **Restore work:** [`AGENT.topologyRelationsRefactor.planning.md`](ts/AGENT.topologyRelationsRefactor.planning.md) Phase 4 (after usable Area exit authoring).

**Scope:** Coyote demo topology. Canonical room ids (see [`AGENT.CoyoteGame.md`](../../../AGENT.CoyoteGame.md)): **`CLIFFBASE`** = **`ROOM#VORTEX`** (prompt seam label only).

| Seam label | Canonical id |
| --- | --- |
| STRAIGHTAWAY | `ROOM#STRAIGHTAWAY` |
| CLIFFBASE | `ROOM#VORTEX` |
| CLIFFTOP | `ROOM#CLIFFTOP` |
| CORNER | `ROOM#CORNER` |
| BRIDGE | `ROOM#BRIDGE` |

**Rooms in scope:** STRAIGHTAWAY, CLIFFBASE (VORTEX), CLIFFTOP, CORNER, BRIDGE.

**Room-local exits to migrate** (4 edges, bidirectional **D1** --- **Forward** / **Back** are player-visible labels from **`From`** / **`To`**):

| From (seam) | To (seam) | Forward | Back | Notes |
| --- | --- | --- | --- | --- |
| STRAIGHTAWAY | CLIFFBASE | east | west | Highway west -> east into cliff base |
| CLIFFBASE | CLIFFTOP | up | down | Vertical cliff |
| CLIFFBASE | CORNER | east | west | Highway east from cliff base to corner |
| CORNER | BRIDGE | south | north | Turn south to bridge |

**Target authoring shape (per edge, **D29**):** one **`<Exit uuid=(...)>`** on parent **Area** **`positionGraph.edges`** with **`<From>`**, **`<To>`**, **`<Forward>`**, **`<Back>`** --- not room-local **`<Exit>`** under **`<Room>`**.

**Restore design (follow-up):** target **`AREA#WORLD`** in **`ASSET#primitives`** (`<Area uuid=(WORLD) />`). Assign stable edge **`uuid`** values at restore time. **Verify after restore:** **`projectRoomExits`** / affordances match the labels below (east, west, up, down, south, north) and nav resolution (**D16**).

**Spatial reference (non-normative):** [`AGENT.CoyoteGame.md`](../../../AGENT.CoyoteGame.md) --- STRAIGHTAWAY -> CLIFFBASE -> CORNER along highway; CLIFFTOP above CLIFFBASE; BRIDGE south of CORNER.

---

## Verification

**`mtw-wml` (primary):**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/projection/projectRoomExits.test.ts ts/standardize/components/area.test.ts ts/standardize/components/area.integration.test.ts
npx tsc -p packages/mtw-wml/tsconfig.json --noEmit
```

**Area / exit regression greps** (from [`AGENT.testing.mtw-wml-typescript.md`](../../../packages/mtw-wml/AGENT.testing.mtw-wml-typescript.md)):

```bash
rg "<Exit\b" packages/mtw-wml --glob "*.{test.ts,ts}"
rg "mergeRoomExitsToJSON|ExitFacetList" lambda/ephemera packages/mtw-wml --glob "*.{ts,tsx}"
```

**Ephemera (after Milestone 4):**

```bash
cd lambda/ephemera
npm run test -- --watchAll=false internalCache/componentStackMerge.test.ts dataSource/actions/index.test.ts dataSource/actions/discriminateIntent/exitResolution.ts
# Expand per child plan
```

**Gateways (after Milestone 3):**

```bash
cd packages/mtw-gateways
npm test -- --watchAll=false ts/assets/components/componentTopology/
```

**Assets (Milestone 2; re-run after M4 wiring):**

```bash
cd lambda/assets
npm test -- --watchAll=false dataSource/caching/cacheAsset.test.ts dataSource/caching/referencedByPersistence.test.ts componentTopology/
```

**Client (Milestone 5 Area editor):**

```bash
cd charcoal-client
npm run test:single -- src/components/Workbench/AreaEdit/areaEditMutations.test.ts
npm run test:single -- src/slices/messages/roomHeaderPhaseC.ts
npm run test:single
```

---

## Progress

| Milestone | Status |
| --- | --- |
| Create platform task plan | Done |
| M0 Decision spike (D1-D7, D5b, D8-D31, D18-D25) | Done |
| M1 WML + StandardArea edges | Done |
| M2 Persisted referencedBy | Done (see child plan) |
| M3 Projection library + gateways `componentTopology/` | Done |
| M4 Ephemera affordance pipeline (`affordanceOrchestration` + `affordanceCache` + perception) | Done |
| M5 Authoring | Done |
| M6 Cleanup + delete plan | Next (forbid room-local + remove Room exit UI) |

---

## ADR / spike outputs

Link one-page decision records here as they land (optional):

- **D1 (normative):** Area exits are always bidirectional. Authoring WML (**D29**):

```xml
<Exit uuid=(highwayToTown)>
    <From>ROOM#highway</From>
    <To>ROOM#townCenter</To>
    <Forward>east</Forward>
    <Back>west</Back>
</Exit>
```

Projection shows **`east`** in `highway` toward `townCenter` and **`west`** in `townCenter` toward `highway`.

- **D29 (normative):** Endpoints use **`<From>` / `<To>`** with **`Parent`**-style **ComponentUUID** string bodies (not nested **`<Room />`**). Layered retarget example:

```xml
<Exit uuid=(highwayToTown)>
    <From>ROOM#highway</From>
    <Replace><To>ROOM#townCenter</To></Replace>
    <With><To>ROOM#ghi</To></With>
    <Forward>east</Forward>
    <Back>west</Back>
</Exit>
```

- **D28 (normative):** Facets use **reference as key**; edges use **`uuid` as key**; **D29** supplies in-place endpoint edits on that stable id.

- **D5b (normative):** **`EdgeList.merge`** uses merge-by-**`uuid`** / **`universalKey`** when layering assets **within the same Area**. Edges are not **`StandardComponent`**s but share that merge habit. **Same `uuid` in two different Areas' `positionGraph`s = two unrelated edges.**

- **D7 (normative):** New **`referenceType: 'Edge'`** for Area topology endpoint refs --- subset **Stub** only; not **Position** (Map) or legacy **Exit** (**ExitsAndShortName**).

- **D4 (normative):** Each Exit edge must have **at least one** of **`from`** / **`to`** present in **`positionGraph.nodes`**. **Neither** in **`nodes`** is a **hard error** at standardize time. One inside + one outside is valid.

- **D18 (normative):** **`mtw.assets.componentTopology`** (skinny invalidation + gateways pull) + **`mtw.ephemera.affordanceOrchestration`** + **`mtw.ephemera.affordanceCache`** (durable rows; invalidate on bus, hydrate-on-demand on orchestration resolve). Cache key **`(ROOM#, perspectiveKey)`**; durable shape **`Affordance::${perspectiveKey}`** with colocated **`ProjectedRoomTopology`** (**D33**). Nav reads same slice via sync **`ensureAffordanceTopology`** + **`AffordanceCache.get`** (**D34**). Invalidation uses layer participation (**D35**); hydrate coalesces per **D36**. **`referencedBy`** remains a separate persisted index (M2). Full diagram: [Caching architecture (D18)](#caching-architecture-d18).

- **D8-D10 (normative):** Embed **`referencedBy`** on **`(targetUniversalKey, ASSET#assetId)`**; **`cacheAsset`** writer; logical target = any **`ComponentUUID`**. See [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10).

- **D31 (normative):** Strip before **`StandardComponent`**; carry per-asset lists on **`ComponentPairRow`**; union into **`referencedByUnion`** on **[`MergedComponentResult`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts)** in the same **`ComponentAggregate.get`** pass as **`merged`**. Topology reads **`.referencedByUnion`**; affordances / **D30** read **`.merged`** only. See [Plumb persisted `referencedBy` (D31)](#plumb-persisted-referencedby-d31).

- **D11-D13 (normative):** **D11** invalidation per [Caching architecture (D18)](#caching-architecture-d18). **D12** one room **`ComponentAggregate.get`** + Area batch at same **`mergeParticipationOrder`**. **D13** **`Meta::Import`** vertical does not select topology referrers --- use **`referencedByUnion`**; import vertical remains for **`fetchImports`** / inheritance assembly only.

- **D14 (normative):** Consult only **`AREA#`** referrers in **`referencedByUnion`** where **R** is an edge **`From`** / **`To`** endpoint. **Not v1:** Areas that list **R** only in **`nodes`**. **Future:** node-only membership for Area-scoped affordances (e.g. Area-level Features visible from all rooms in the Area).

- **D15 (normative):** All cross-asset folds use **`mergeParticipationOrder`** / **`ComponentAggregate`** --- same as **D30**; never concat per-asset exit JSON.

- **D16 (normative):** Per room **R**, each Area edge contributes **0 or 1** **`ExitFacet`** to **R**'s list (**Forward** when **R** is **`from`**, **Back** when **R** is **`to`**). **Two facets from one edge in the same list** only when **`From`** and **`To`** resolve to the same **R** (self-loop). Distinct endpoints **A -> B** yield one facet on **A**'s wire and one on **B**'s wire, not two on **A**.

- **D17 (normative):** Portal edges (**D4**): one in-graph endpoint. Affordance from in-graph **R**; movement requires peer **`ROOM#`**.

- **D19 (normative):** Workbench **Area** editor covers **`shortName`**, **`nodes`**, **`edges`**. Room editor drops exit UI in **M6** forbid. Area exit UX improvements: [`AGENT.topologyRelationsRefactor.planning.md`](ts/AGENT.topologyRelationsRefactor.planning.md).

- **D20-D22 (normative):** Exits on affordances channel only (**D20**); **RoomExit** UI unchanged by wire shape (**D21**, no manual smoke test); stable **`movementExitLabels`** if projection stable (**D22**).

- **D23-D25 (normative):** Production room-local exits already cleared (**D24**). **M6** forbid + test retirement (**D25**) proceeds without Area-edge restore. Demo topology restore: topology refactor **Phase 4** + [inventory](#production-exit-inventory-coyote-demo).

- **D30 (normative):** **`ComponentStackMerge`** uses **`ComponentAggregate`**; retire **`mergeRoomExitsToJSON`** on affordance path. See [ComponentStackMerge refactor (D30)](#componentstackmerge-refactor-d30).

---

## Persisted `referencedBy` (D8-D10)

**Locked:** **D9 (B)** + **D10 (`cacheAsset`)**. **Dynamo / JSON field name:** **`referencedBy`** (aligned with [`StandardForm.referencedBy`](../../../packages/mtw-wml/ts/standardize/index.ts), not a separate **`referrers`** property).

**Write path:** During **`cacheAsset`**, both **`dbAsset`** and **`fileAsset`** are already in memory. Extend the write set beyond **`StandardForm.diff`**: when a referrer component changes (e.g. **Area** **`positionGraph`**), update **`referencedBy`** on each affected **target** forward row **`(targetUniversalKey, ASSET#assetId)`** for that asset. Algorithm change only --- no new fetch pattern.

**Read path (topology / gateways):** **`ComponentAggregate.get({ universalKey: ROOM#r, mergeParticipationOrder })`** (**D31**) returns **`{ merged, referencedByUnion }`** from the same **`getAcrossAssets`** batch as merge ([`participationBatch.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/participationBatch.ts)). Topology filters **`referencedByUnion`** to **`AREA#`**, then batch **`ComponentAggregate.get`** for Area perspectives. No duplicate **`getAcrossAssets(ROOM#)`** for inverse lookup.

**Dependency on D30:** Affordance path uses **`result.merged`** only; must not use **`mergeRoomExitsToJSON`**. **D30** at start of Milestone **4**; M2 gateway work can proceed in parallel.

```text
cacheAsset (fileAsset) --> patch (target, ASSET#) { referencedBy: [...] }
                                    |
ComponentAggregate.get(ROOM#, stack) --> { merged, referencedByUnion }
              --> filter AREA# from referencedByUnion --> ComponentAggregate.get(AREA#*, stack) --> merged Area
              --> projectRoomExits
```

---

## Plumb persisted `referencedBy` (D31)

**Problem:** Forward Dynamo rows colocate blueprint JSON and derived **`referencedBy`** (**D9 B**). [`standardComponentPairFromAssetDbGetItemsRow`](../../../packages/mtw-gateways/ts/assets/components/componentData/fetch.ts) must not pass **`referencedBy`** into **`isStandardComponentData`**. [`authoritativeFromParticipationOrder`](../../../packages/mtw-gateways/ts/assets/components/componentData/participationBatch.ts) already calls **`getAcrossAssets`** for every **`ComponentAggregate.get`** --- we should not throw away **`referencedBy`** from that load and re-fetch for topology.

**Locked approach:**

| Layer | Rule |
| --- | --- |
| **Dynamo / `cacheAsset`** | Write **`referencedBy`** on **`(targetUniversalKey, ASSET#assetId)`** forward item (**D10**). |
| **`mtw-wml` / `StandardComponent`** | **No** persisted **`referencedBy`** on component classes or WML. In-memory **`StandardForm.referencedBy(ref)`** remains compute-only over **`referencedKeys()`**. |
| **`mtw-gateways` / `ComponentData`** | **Strip** at load; **`ComponentPairRow.referencedBy?`**. **`getAcrossAssets`** returns pair-shaped data (or map of pairs); merge path reads **`.component`**. |
| **`AuthoritativeComponentData`** | Optional per-asset **`referencedBy?`** on **`byAssets[]`** (parallel to **`component`**) for union input. |
| **`ComponentAggregate` / [`MergedComponentResult`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts)** | **`merged: StandardComponent`** unchanged merge semantics. Add **`referencedByUnion?: PersistedReferencedByEntry[]`** --- union of per-asset **`referencedBy`** lists for this target + **`mergeParticipationOrder`** (**D12**). Computed in **`mergedComponentFromAuthoritative`** (or adjacent helper), **not** via **`StandardRoom.merge`**. |
| **`ComponentTopology` / M3-M4** | **`ComponentAggregate.get(ROOM#)`** -> **`referencedByUnion`** -> Area batch **`get`** -> **`projectRoomExits`**. |

**Entry type (v1):** `PersistedReferencedByEntry = { referrerUniversalKey: ComponentUUID; referenceType?: StandardComponentReferenceKey['referenceType'] }` (home in **`mtw-gateways`**).

**Call-site impact (minimal):** **`ComponentAggregate.get`** already returns **`MergedComponentResult[]`**, not bare **`StandardComponent`**. Existing callers (**`ComponentExamples`**, **D30** affordances) keep using **`.merged`**; they need no changes for inverse data. New field is opt-in at the result DTO layer.

**Rejected:** **`referencedBy`** on **`StandardComponent`**; topology-only second **`getAcrossAssets(ROOM#)`** when aggregate already loaded the same pairs.

**Implementation note (M2 / M3):** Extend [`result.ts`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts) and [`participationBatch.ts`](../../../packages/mtw-gateways/ts/assets/components/componentData/participationBatch.ts); update **`ComponentDataParticipationLoader`** / **`getAcrossAssets`** return type to carry **`referencedBy`** through the batch path.

---

## ComponentStackMerge refactor (D30)

**Problem:** [`mergeRoomExitsToJSON`](../../../lambda/ephemera/internalCache/componentStackMerge.ts) flattens **`exits`** from every asset appearance. Layered assets use **`StandardRoom.merge`** / **`ComponentAggregate`**, which applies **Remove** / overlay semantics. Affordances and navigation that relied on concat can show **stale exits** from lower layers.

**Refactor:** **`ComponentStackMerge.get`** reads hydrated topology slice from **`internalCache.AffordanceCache`**, uses **`ComponentAggregate.get`** -> **`result.merged`** for **`shortName`** only (**D30**), then adds **`RoomCharacterList`**, **`Meta::Room.objects`**, and builds **`ephemeraWire`** **`StandardForm`**. **Invoked from perception** on **`Affordances Pertain`** (**D38**), not from bus ingress. Nav uses **`ensureAffordanceTopology`** + slice read (**D34**).

**Non-goals for D30:** Materializing **`affordanceOrchestration`** / **`affordanceCache`** (**D18**, **D37**) --- separate M4 work. **`ensureAffordanceTopology`** runs from orchestration (**D32**), not from stack merge.

**Tests:** Layered canon + import overlay exit case; affordance publish smoke via **`Affordances Pertain`** path.

---

## Gateways `componentTopology` module (M3)

Normative **compute-only** pull surface for room exit projection at a perspective. Precedent: [**Component examples read surfaces**](../../../packages/mtw-gateways/AGENT.md) and [`ts/assets/components/componentExamples/`](../../../packages/mtw-gateways/ts/assets/components/componentExamples/).

| Concern | Package / lambda home | Milestone |
| --- | --- | --- |
| Pure **`projectRoomExits`** | **`mtw-wml`** | **M3** |
| Perspective assembly + **`DeferredCache`** | **`mtw-gateways/ts/assets/components/componentTopology/`** | **M3** |
| Skinny **`TopologyInvalidated`** bus | **`lambda/assets/componentTopology/index.ts`** (`mtw.assets.componentTopology`) | **M2** (done) |
| **`internalCache.ComponentTopology.get`** | Ephemera + diagnostics register **`createComponentTopologyCacheHandler`** | **M4** |
| Durable hydrated topology rows | **`mtw.ephemera.affordanceOrchestration`** + **`mtw.ephemera.affordanceCache`** + **`ts/ephemera/affordanceCache/`** (invalidate-on-bus, hydrate-on-orchestration-resolve; **`renderCache`** analogue) | **M4** |

**Deep import:** `@tonylb/mtw-gateways/ts/assets/components/componentTopology`

**Primary (steady-state):** **`createComponentTopologyCacheHandler({ ComponentAggregate })`**, **`componentTopologyPerspectiveCacheKey`**, stable result DTO in **`result.ts`**.

**Secondary (tests / parity only):** **`assembleRoomTopologyAtPerspective`** in **`assemble.ts`** --- do **not** wire new lambda hydrate paths to **`assemble*`** when the cache handler exists.

**Composition slice:** `{ ComponentAggregate: internalCache.ComponentAggregate }` --- same injection shape as **`createComponentExamplesCacheHandler`**.

**M3 non-goals:** **`referencedBy`** strip/carry / **`referencedByUnion`** (M2 **D31** in **`componentData`** / **`aggregate`**); Ephemera Dynamo; **`ComponentStackMerge`** / affordance publish (**M4**).

---

## Caching architecture (D18)

Normative split modeled on **`mtw.assets.componentExamples`** + **`mtw.ephemera.renderCache`** ([`componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md), [`renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md)). Module layout for the gateways pull layer: [Gateways `componentTopology` module (M3)](#gateways-componenttopology-module-m3).

```text
Legacy triggers                 affordanceOrchestration              affordanceCache                 perception
---------------                 -----------------------              ---------------                 ----------
RoomUpdate          ----\
Objects Changed     ----+---->  Affordances Requested  ------>  ensureAffordanceTopology (D32)
TopologyInvalidated ----/       orchestrateAffordanceRequest          (when catalog stale)
  (fan-out)                     intake + stream outbounds                |
                                (Slice Ready / Error v1)                 v
                                                                         ComponentTopology.get
                                                                         persist slice + catalog ready
                                                                                |
                                                                                v
                                                                         Affordances Pertain  ------>  PublishMessage
                                                                                                   (roomChannel: affordances)
                                                                                                   via ComponentStackMerge (D38)
```

**End-to-end (mirror render pass-through):**

1. **Invalidate on blueprint change:** **`TopologyInvalidated`** (no projected exit body). **`affordanceCache`** handler bumps **`catalogVersion`** only --- **no** **`ComponentTopology.get`**, **no** eager Dynamo materialization (precedent: [`handleExampleInvalidated`](../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts)). **`affordanceOrchestration`** may fan out **`Affordances Requested`** (**reason: topology**) for affected rooms.
2. **Resolve on demand:** **`Affordances Requested`** -> **`orchestrateAffordanceRequest`** -> **`ensureAffordanceTopology`** when catalog stale (**D32**). Pull via **`internalCache.ComponentTopology.get`**, persist version-stamped topology slice, mark catalog ready (precedent: [`ensureAuthoredCatalog`](../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts) in [`orchestrationHandler.ts`](../../../lambda/ephemera/dataSource/renderOrchestration/orchestrationHandler.ts)).
3. **Terminal publish:** **`affordanceCache`** emits **`Affordances Pertain`** (precedent: **`Render Pertains`**). **`perception`** composes ephemeraWire via **`ComponentStackMerge`** (**D38**) and emits **`PublishMessage`** per occupant. **Nav (**D34**): synchronous **`ensureAffordanceTopology`** + **`AffordanceCache`** read --- no event pipeline, no publish (see D34 limitations).

| Layer | Responsibility | Does **not** |
| --- | --- | --- |
| **Persisted `referencedBy` (M2, D9 B)** | **`referencedBy`** on **`(target, ASSET#)`** forward rows; read as **`referencedByUnion`** via **`ComponentAggregate.get`** (**D31**) | Store merged exit facets; separate **`Meta::ReferencedBy`** SK rows |
| **`mtw.assets.componentTopology`** | Detect topology-relevant blueprint diffs; emit skinny invalidation; optional diagnostics hooks | Ship full projected **`ExitFacetList`** on the event bus |
| **Gateways `componentTopology/` (M3)** | **`createComponentTopologyCacheHandler`**: **`ComponentAggregate.get(ROOM#)`** -> **`referencedByUnion`**; batch Area **`merged`**; **`projectRoomExits`** | Put **`referencedBy`** on **`StandardComponent`**; duplicate ROOM# pair fetch; uncached **`assemble*`** on hot paths |
| **`mtw.ephemera.affordanceOrchestration` (D37)** | **`Affordances Requested`** ingress; intake (**reason:** roster / objects / topology); **`ensureAffordanceTopology`** preflight; stream outbounds; future slow-path / LLM enrichment | Dynamo writes; **`PublishMessage`**; compose ephemeraWire |
| **`mtw.ephemera.affordanceCache`** | Colocated **`Affordance::${perspectiveKey}`** rows (**D33**): version metadata + embedded topology **`exits`**; **`handleTopologyInvalidated`**; hydrate persist; **`Affordances Pertain`** outbound; memo via **`internalCache`** | Eager hydrate in invalidation handler; separate **`TOPOLOGY#`** body rows (M4); own **`RoomCharacterList`** or **`Meta::Room.objects`**; terminal publish |
| **`mtw.ephemera.perception`** | Subscribe **`Affordances Pertain`**; compose + terminal **`PublishMessage`** per occupant (**D38**) | Topology pull; catalog versioning; orchestration policy |
| **`ComponentStackMerge` (D38)** | Invocation-memo compose: topology slice + **`shortName`** + roster + **`objects`** -> **`ephemeraWire`** | Bus ingress; hydrate; **`PublishMessage`** |

**Cache identity:** **`(ROOM#id, perspectiveKey)`** --- same participation / asset-stack notion as render cache and planned **`ComponentStackMerge`** alignment ([`internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md)). Character id selects perspective at hydrate time only.

**v1 simplifications (allowed):** No LLM / mark-state constellation; no edge-**`uuid`**-scoped invalidation (room-level **`roomIds`** list only; layer participation per **D35**).

**Lambda wiring:** Register gateway handlers on **`internalCache`** per [`.cursor/rules/gateways-internal-cache.mdc`](../../../.cursor/rules/gateways-internal-cache.mdc) --- Ephemera calls **`ComponentTopology.get`**, not uncached **`assemble*`** on hot paths.

---

## Affordance pipeline (M4)

Ephemera steady-state docs (implementation home): [`lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceOrchestration/AGENT.md), [`affordanceCache/AGENT.md`](../../../lambda/ephemera/dataSource/affordanceCache/AGENT.md).

**Why three layers (D37):** M4 lands substantial new boundaries (**D32**, durable cache, perception publish). Scaffolding **`affordanceOrchestration`** now --- thin, sync-only in v1 --- aligns with **`renderOrchestration` + `renderCache` + perception** and avoids **`ComponentStackMerge`** / direct publish paths becoming authoritative stop-gaps before future LLM topology enrichment.

**Precedent map (render -> affordance):**

| Render | Affordance (M4) |
| --- | --- |
| **`Render Requested`** / state fan-out / look kick | **`Affordances Requested`** (adapters: **`RoomUpdate`**, **`Objects Changed`**, **`TopologyInvalidated`** fan-out) |
| **`mtw.ephemera.renderOrchestration`** | **`mtw.ephemera.affordanceOrchestration`** |
| **`orchestrateRenderRequest`** | **`orchestrateAffordanceRequest`** |
| **`ensureAuthoredCatalog`** (orchestration preflight) | **`ensureAffordanceTopology`** (**D32**) |
| **`internalCache.ComponentExamples.get`** inside hydrate | **`internalCache.ComponentTopology.get`** inside hydrate |
| **`Current Cache Valid` / `Exact Match Found` / `Render Generated`** (stream) | **`Slice Ready`** / **`Orchestration Error`** (v1-active); enrichment outbounds **skipped tests** until LLM path |
| **`mtw.ephemera.renderCache`** persists on **`Render Generated`** | **`mtw.ephemera.affordanceCache`** persists on hydrate / orchestration handoff |
| **`Render Pertains`** | **`Affordances Pertain`** |
| **`orchestrate.ts` `handleRenderPertains`** -> **`PublishMessage`** | **`handleAffordancesPertain`** -> **`PublishMessage`** (via **`ComponentStackMerge`**, **D38**) |
| **`generateRoomPreview`** / LLM (shipped for render) | Future **`generateAffordanceEnrichment`** (out of scope v1) |

**Planned code homes:**

| Concern | Path | Notes |
| --- | --- | --- |
| Orchestration DataSource | [`lambda/ephemera/dataSource/affordanceOrchestration/`](../../../lambda/ephemera/dataSource/affordanceOrchestration/) | **`Affordances Requested`** ingress; **`orchestrateAffordanceRequest`**; **`publishedEvents.ts`** outbounds |
| Ingress adapters | `sendAffordanceRefreshRequested.ts`, updates to [`roomUpdate/index.ts`](../../../lambda/ephemera/roomUpdate/index.ts), [`perception/index.ts`](../../../lambda/ephemera/dataSource/perception/index.ts) | **No direct** [`publishRoomAffordancePerceptionMessages`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts) once migrated |
| Cache DataSource | [`lambda/ephemera/dataSource/affordanceCache/`](../../../lambda/ephemera/dataSource/affordanceCache/) | Subscribe **`TopologyInvalidated`** + orchestration outbounds |
| Invalidation handler | `handleTopologyInvalidated.ts` | Mirror [`handleExampleInvalidated.ts`](../../../lambda/ephemera/dataSource/renderCache/handleExampleInvalidated.ts) |
| Hydrate preflight | `ensureAffordanceTopology.ts` | Mirror [`ensureAuthoredCatalog.ts`](../../../lambda/ephemera/dataSource/renderCache/ensureAuthoredCatalog.ts); orchestration (**D32**) + nav (**D34**); wraps stale path in singleFlight (**D36**) |
| Single-flight hydrate | `singleFlightAffordanceTopologyHydrate.ts` | Mirror [`singleFlightAuthoredCatalogHydrate.ts`](../../../lambda/ephemera/dataSource/renderCache/singleFlightAuthoredCatalogHydrate.ts) (**D36**) |
| Cache inbound / outbound | `handleAffordanceOrchestrationInbound.ts`, `handleAffordancesPertain.ts` (names TBD) | Mirror [`handleRenderOrchestrationInbound.ts`](../../../lambda/ephemera/dataSource/renderCache/handleRenderOrchestrationInbound.ts) |
| Gateway types + memo | [`packages/mtw-gateways/ts/ephemera/affordanceCache/`](../../../packages/mtw-gateways/ts/ephemera/affordanceCache/) | Mirror [`renderCache`](../../../packages/mtw-gateways/ts/ephemera/renderCache/) layout |
| Invocation memo | [`internalCache/affordanceCache.ts`](../../../lambda/ephemera/internalCache/affordanceCache.ts) | Register on **`InternalCache`** |
| Compose memo | [`componentStackMerge.ts`](../../../lambda/ephemera/internalCache/componentStackMerge.ts) | Perception terminal only (**D38**) |
| Terminal publish | [`perception/orchestrateAffordances.ts`](../../../lambda/ephemera/dataSource/perception/orchestrateAffordances.ts) (name TBD) + existing [`publishRoomAffordancePerceptionMessages.ts`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts) | Refactor publish helper to accept composed WML or call **`ComponentStackMerge.get`** internally |
| Navigation | [`roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts) | Sync **`ensureAffordanceTopology`** + **`AffordanceCache.get`** (**D34**); document limitations in action / **`affordanceCache`** AGENT |

**M4 decision register:** **D32-D38** locked (ephemera child plan).

---

## ComponentStackMerge vs perception (D38)

**Question:** Should **`ComponentStackMerge`** remain a freestanding **`internalCache`** center, or move into **`mtw.ephemera.perception`** as a handler on **`Affordances Pertain`**?

**Decision (D38):** Keep **`ComponentStackMerge`** in **`internalCache`**; **move the pipeline center** to **`affordanceOrchestration` + `affordanceCache` + perception**.

| Option | Verdict | Rationale |
| --- | --- | --- |
| **A. Freestanding ingress center (today)** | **Rejected** | **`publishRoomAffordancePerceptionMessages`** calling **`ComponentStackMerge.get`** directly made stack merge the de facto orchestration layer --- no hydrate lifecycle, fragmented triggers, hard to add LLM slow path. |
| **B. Perception inline compose (no stack merge)** | **Rejected for M4** | Duplicates merge logic; loses invocation memo for multi-occupant fan-out in one lambda run; nav would need a second copy. |
| **C. `internalCache` compose memo + perception terminal (chosen)** | **Normative** | Parallel to render: terminal path uses [`roomRenderWmlFromCacheRecord`](../../../lambda/ephemera/dataSource/perception/roomRenderWmlFromCacheRecord.ts) fed by **`Render Pertains`**, not **`ComponentRender`**. Affordances: **`handleAffordancesPertain`** calls **`ComponentStackMerge.get(characterId, roomId)`** (or a thin wrapper) **after** orchestration/cache assert slice readiness. Stack merge **reads** **`internalCache.AffordanceCache`** topology slice + ephemera-only fields; it does **not** call **`ensureAffordanceTopology`**. |
| **D. Fold stack merge entirely into perception module** | **Deferred** | Possible later refactor if compose moves to **`roomAffordanceWmlFromSlice.ts`** colocated with perception; **`internalCache`** would retain only memo keys. Not worth the churn in M4. |

**Intake `reason` and compose work (orchestration policy):**

| **`Affordances Requested` reason** | Topology **`ensure*`** | Compose |
| --- | --- | --- |
| **`roster`** | Skip when catalog already hydrated for perspective | Yes --- roster changed |
| **`objects`** | Skip when catalog already hydrated | Yes --- **`objects`** changed |
| **`topology`** | Run **`ensureAffordanceTopology`** when stale | Yes --- exits may have changed |

Roster- and objects-only refreshes still flow through orchestration for **uniform ingress** (**D37**), but may skip topology hydrate when the catalog row is current.

**Cache key follow-up (non-blocking):** migrate **`ComponentStackMerge`** memo from **`(characterId, roomId)`** toward **`(roomId, perspectiveKey)`** when perception routing stabilizes --- see [`internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md).

---

## Discovery notes (non-normative)

- Today ephemera: `componentData.getAcrossAssets(ROOM#id, allAssets)` then `mergeRoomExitsToJSON(assetData)` --- O(assets) point reads, no Area fan-out; **`ComponentStackMerge`** has no **`renderCache`**-style durable topology slice.
- Today affordances: [`publishRoomAffordancePerceptionMessages`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts) calls **`ComponentStackMerge.get(characterId, roomId)`** directly from **`RoomUpdate`** / **`Objects Changed`** --- no **`affordanceOrchestration`** / **`affordanceCache`** pipeline yet (**D37** migration target).
- Today `StandardForm.referencedBy(ref)` scans loaded components in one asset --- prototype for inverse lookup, not blueprint storage.
- **Forward vs inverse Dynamo grain:** **`(ROOM#r, ASSET#a)`** holds the body; **D9 (B)** adds **`referencedBy`** on that same row. **`mergeRoomExitsToJSON`** concat vs **`ComponentAggregate`** merge is the **D30** bug class.
- Area v1 doc explicitly deferred **edges** and ephemera RoomAffordances impact; this initiative implements that follow-on.
