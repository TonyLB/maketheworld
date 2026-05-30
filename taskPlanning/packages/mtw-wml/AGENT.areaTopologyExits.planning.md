# Area topology exits (platform initiative)

**Status:** In progress. **Milestone 0 (decisions)** complete; implementation not started.

**Next step:** Execute **Milestone 1** (WML + **`StandardArea`** edges) per [Milestone gates](#milestone-gates); **M2** may proceed in parallel once gated.

This plan is task-scoped. Archive or delete it after the initiative ships; move lasting norms into package `AGENT.md` files next to code.

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
| [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md) | Ephemera durable cache + hydrate-on-invalidate precedent (**D18**) |
| [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) | `ComponentExamples` / `ComponentAggregate` gateway cache handlers |

**Child plans (tracked in Milestones 2 and 4):**

- **M2:** [`taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md`](../../lambda/assets/AGENT.areaTopologyReferencedBy.planning.md) --- **`referencedBy`** / **`cacheAsset`**, **`mtw.assets.componentTopology`**
- **M4:** [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../lambda/ephemera/AGENT.areaTopologyExits.planning.md) --- **D30**, **`affordanceCache`**, affordance publish, navigation; extend assets child plan for **`componentTopology`** integration

---

## Agreed direction (normative for this initiative)

1. Room-local exits are **not** authoring surface area; they are **ephemeraWire projection** only.
2. Area owns **edges**; updating topology is a change to Area (or its graph), not Room **content**.
3. **One projection function** (name TBD) feeds both affordance WML and command-time exit resolution (`getRoomExitTargetsForCharacter`).
4. **Persisted inverse references** (`referencedBy` or equivalent at blueprint / meta layer) are **required** for practical ephemera fetch --- in-memory `StandardForm.referencedBy()` is not sufficient at runtime scale. Index by **target `ComponentUUID`** (component-wide, not room-only); **v1 consumer** is topology (Areas referencing **`ROOM#`**). Align writer with per-component **`referencedKeys()`** ([`StandardForm.referencedBy`](../../../packages/mtw-wml/ts/standardize/index.ts)).
5. Delivery is **phased**; dual-read or migration tooling may be required (see **D23**).
6. **Bidirectional topology:** Every Area **exit edge** is traversable in both directions. Topology lives on **`StandardArea.positionGraph.edges`** (with **`nodes`**), not on Room blueprint rows. **`edges`** is a **union** (extensible); **`<Exit>`** is the **first** member shape (**D3**). Each edge has a stable **`uuid`** (**D28**) **local to that Area's `positionGraph`** (**D5b**). Layered assets merge edges by **`uuid`** inside one Area like components, but the same **`uuid` in two Areas is not one edge**. Endpoints are **`From`** / **`To`** (**D29**); labels are **`Forward`** / **`Back`** (**D26**). Runtime room wire still exposes a **single** outbound label per direction via projection (**D16**).
7. **Caching (D18):** Follow the **`componentExamples` + `renderCache`** split. **Assets** owns skinny topology invalidation and **pull** assembly (`mtw.assets.componentTopology` + gateways **`ComponentTopology`** handler). **Ephemera** owns durable affordance-topology rows and hydrate-on-invalidate (`mtw.ephemera.affordanceCache`). **Persisted `referencedBy`** (**D8-D12**) is still required for cheap pull; the topology DataSource does **not** replace the inverse index.
8. **Inverse index (D8-D10):** Embed **`referencedBy`** on existing forward rows **`(targetUniversalKey, ASSET#assetId)`**; maintain on **`cacheAsset`** (**D9 B**, **D10**). Read via **`ComponentData`** pair load inside **`ComponentAggregate.get`** (**D31**).
9. **Plumbing (D31):** Strip **`referencedBy`** before **`StandardComponent`**; carry on **`ComponentPairRow`**; extend **[`MergedComponentResult`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts)** with **`referencedByUnion`** (same **`getAcrossAssets`** batch as merge --- no second fetch for topology). Callers that do not need inverse data use **`.merged`** only (**D30**, **ComponentExamples**).
10. **`ComponentStackMerge` refactor (D30):** **`ComponentAggregate.get`** -> **`result.merged`** for blueprint room fields; ignore **`referencedByUnion`**. Keep ephemera-only roster / **`objects`** and **ephemeraWire** envelope.

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../AGENT.md)
2. **WML / StandardForm:** [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)
3. **Area implementation:** [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardArea**)
4. **Facets today (one ref + payload):** [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md), [`exit.ts`](../../../packages/mtw-wml/ts/standardize/keys/facets/exit.ts) (room-local; superseded for Area topology by **D27**)
5. **Ephemera affordances + navigation:** [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) (`ComponentStackMerge`, `ComponentRender`), [`lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts), [`lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)
6. **Caching precedents (D18):** [`lambda/assets/componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md), [`lambda/ephemera/dataSource/renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md), [`packages/mtw-gateways/AGENT.md`](../../../packages/mtw-gateways/AGENT.md) (**ComponentExamples** / **ComponentAggregate**)
7. **Asset persistence:** [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) (`Meta::${tag}`, `cacheAsset`)

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
| **D6** | [X] | **Room `exits` in asset JSON (transition)** | **Dual-read** until production DB migrated (**D23**, **D24**): asset mode may still **ingest** room-local **`exits`** / **`<Exit>`** under **`<Room>`** (mapping into Area edges optional during dual-read). **ephemeraWire** projection unchanged. **Forbid** room-local exits in asset mode in **M6** after operator confirms migration (**D23** follow-up). |
| **D7** | [X] | **`Edge` reference type** | Add **`'Edge'`** to **`StandardComponentReferenceKey`** ([`baseClasses.ts`](../../../packages/mtw-wml/ts/standardize/components/baseClasses.ts)) for **Area `positionGraph.edges`** endpoint refs (**From** / **To**). **Do not** reuse **`'Position'`** (Map placement + structural parent tiers) or legacy **`'Exit'`** (room-local **`ExitsAndShortName`** subset). **Subset (normative):** cascade **`connectionType: 'Edge'`** -> target **Room** with **`requestType: 'Stub'`** (empty shell; no Situation/prose; **no** room-local exits copied). Mirror **Position** stub behavior only, not Map semantics. **SchemaOrganization:** treat **`Edge`** as **non-structural** (like **`Link`** / legacy **`Exit`** in [`standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)) --- do **not** add to **Direct**/**Position** parent tiers; **nodes** stay **Direct** for participation. **Milestone 1:** wire **`StandardArea.referencedKeys()`**, subset tests, and any cascade docs/examples that today say **Exit** for room-to-room. |

### Blockers --- persisted `referencedBy`

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D8** | [X] | **Index granularity (logical)** | **Target:** any **`ComponentUUID`** (same as in-memory **`referencedBy(StandardReference)`**). **Entry:** `{ referrerUniversalKey, referenceType? }` --- tag is **not** stored (**`AREA#...`** prefix is sufficient). **`assetId` omitted** when stored on **`(target, ASSET#)`** forward row (**D9**). **v1 read filter:** topology pull reads **`referencedBy`** on **`ROOM#r`** rows and keeps **`AREA#`** referrers (per **D14**). Forward rows **`(ComponentUUID, ASSET#assetId)`** are component bodies; **`referencedBy`** is derived inverse data colocated per **D9**. **`Meta::Room.cached`** = assets with a forward row, not the inverse list. See [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10). |
| **D9** | [X] | **Storage pattern** | **(B) Embed on forward row (chosen):** `referencedBy: [{ referrerUniversalKey, referenceType? }]` on **`(targetUniversalKey, ASSET#assetId)`** written by **`cacheAsset`**. Rejected for steady-state: **(A)** separate **`Meta::ReferencedBy::...`** rows (extra SK surface; **D12** diverges from **`ComponentAggregate`** batch); **(C)** rebuild-only scan. **(B)** aligns with **`ComponentPairRow`** + **`referencedByUnion`** (**D31**). |
| **D10** | [X] | **Writer** | **`cacheAsset` only** (no separate vertical in v1). On each cache pass, maintain **`referencedBy`** for targets touched by **`referencedKeys()`** on changed components --- **not** only rows in **`StandardForm.diff`** (Area edge edits must update target room/stub rows). See [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10). |
| **D11** | [X] | **Invalidation** | **Assets:** **`mtw.assets.componentTopology`** emits skinny **`TopologyInvalidated`** on Area **`positionGraph`** / edge edits, Room blueprint during **D6** dual-read, and **`referencedBy`** target patches from **`cacheAsset`** (**D10**) --- component ids, `editAssetId`, optional **`AREA#`** / edge **`uuid`** hints; **no** projected body on bus. **Ephemera:** **`mtw.ephemera.affordanceCache`** bumps catalog / drops stale rows for affected **`ROOM#`** + **`perspectiveKey`**; hydrate via **`internalCache.ComponentTopology.get`**. **Ephemera-only (no topology row rewrite):** **`RoomCharacterList`**, **`Meta::Room.objects`** still trigger affordance republish. **v1 allowed:** coarse invalidation (all perspectives for a room). Detail in child plans. |
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
| **D18** | [X] | **Caching (`renderCache` analogue)** | **Assets:** **`mtw.assets.componentTopology`** DataSource (like **`mtw.assets.componentExamples`**) --- subscribe to topology-relevant **`Component Updated` / `Removed`** (Area **`positionGraph`**, Room during **D6** dual-read); publish skinny **`TopologyInvalidated`** only. **Gateways:** **`assembleRoomTopologyAtPerspective`** (name TBD) + **`createComponentTopologyCacheHandler({ ComponentAggregate })`** --- room perspective via **`ComponentAggregate.get`** -> **`referencedByUnion`** + batch Area **`merged`** (**D31**); **`projectRoomExits`** (**D16**). Ephemera registers **`internalCache.ComponentTopology`**. **Ephemera:** **`mtw.ephemera.affordanceCache`** --- Dynamo slice per **`(ROOM#, perspectiveKey)`**; hydrate on invalidation. **Publish:** hydrated topology + ephemera-only fields; **D30** for transitional room **`merged.exits`** until projection owns exits. See [Caching architecture (D18)](#caching-architecture-d18). |

### Product, authoring, client

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D19** | [X] | **Workbench Area editor** | **Area** workbench surface (not edges-only): **`shortName`**, **`positionGraph.nodes`**, **`positionGraph.edges`**. **Edges:** select/update by **`uuid`**; retarget **`From`** / **`To`** in place; edit **`Forward`** / **`Back`**. **Room** editor: remove room-local exit authoring UI (**D23** follow-up timing --- after data migration, with asset-mode forbid). |
| **D20** | [X] | **Client merge** | Affordances channel still `render.merge(affordances)`; exits only on affordances projection |
| **D21** | [X] | **RoomExit UI** | **Confirmed:** **`RoomExit`** chips unchanged if **D16** holds (same **`StandardExitFacet`** wire). |
| **D22** | [X] | **Parse / LLM** | `movementExitLabels` stable if projection stable |

### Migration

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D23** | [X] | **Migration strategy** | **Dual-read** (**D6**): asset ingest keeps reading room-local **`<Exit>`** until production data is migrated. **In this initiative (manual step):** one-time migration of our single production DB --- move room-local exits into Area **`positionGraph.edges`**. **Follow-up (M6):** room-local exits **illegal** in asset authoring; strip-on-standardize or hard error; remove exit UI from Room edit component. **Not** big-bang code forbid before data migration. |
| **D24** | [X] | **Canon / production** | **Operator:** Anthony runs the manual data migration and **confirms** completion before the **D23** follow-up forbid. Rollback via DB restore / re-run migration tooling (document in M5). |
| **D25** | [X] | **Test matrix** | Add Area edge, **`projectRoomExits`**, and ephemera topology tests. **Retire** room-local exit **authoring** tests only when room-local authoring is removed (**D23** M6 follow-up) --- same gate as forbid, not earlier. |

### Ephemera --- `ComponentStackMerge` consolidation

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D30** | [X] | **`ComponentStackMerge` uses `ComponentAggregate`** | **Replace** [`componentStackMerge.ts`](../../../lambda/ephemera/internalCache/componentStackMerge.ts) **`getAcrossAssets` + `mergeRoomExitsToJSON` / `mergeRoomShortNameLiteral`** with **`internalCache.ComponentAggregate.get`** at **`mergeParticipationOrder`** derived from the same global + character asset list as today. **Discard** merged blueprint fields not needed for affordances (situations, features, lens, render on room, etc.). **Keep** ephemera-only: **`RoomCharacterList`**, **`Meta::Room.objects`**, **`ephemeraWire`** **`StandardForm`** envelope. **Why:** `mergeRoomExitsToJSON` **concatenates** per-asset room **`exits`** --- wrong for layered assets (e.g. canon **D,E** + import overlay removing **D** and adding **F** yields **D,E,F** instead of **E,F**). That divergence from **`StandardRoom.merge`** / **`ComponentAggregate`** is a **bug**, not a feature. **Cost:** extra in-memory merge work per miss; acceptable for one merge authority. **Follow-up (track, not D30):** **`ComponentRender`** still uses **`mergeRoomExitsToJSON`** for nav ([`roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)) --- align to aggregate or **affordanceCache** / topology slice in Milestone **4**. See [ComponentStackMerge refactor (D30)](#componentstackmerge-refactor-d30). **Gate:** land **before** or at start of Milestone **4**; **D8-D10** ephemera reads assume **D30** participation order. |

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

---

## Milestone gates

| Milestone | Blocked until |
| --- | --- |
| **1** WML + `StandardArea` (asset mode) | **D1-D7**, **D5b**, **D26-D29** [X] |
| **2** Persisted `referencedBy` | **D8-D13** [X], **D31** [X]; **`cacheAsset`** + pair strip/carry + **`referencedByUnion`** on **`MergedComponentResult`** |
| **3** Projection library + gateways pull | **D1-D6**, **D14-D17** [X]; **`assembleRoomTopologyAtPerspective`** + **`projectRoomExits`** contract |
| **4** Ephemera + assets caching integration | **D2**, **D11**, **D14-D18** [X], **D30** [X], Milestones **2-3**; **`componentTopology`** + **`affordanceCache`** |
| **5** Authoring + migration | **D19-D24** [X], Milestone **1**; manual DB migration (**D24**); Area workbench (**D19**) |
| **6** Cleanup + durable docs | Prior milestones; **D23** follow-up (forbid room-local exits + UI); **D25** test retirement |

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
  - [X] **D6** --- dual-read room-local exits until DB migration; forbid in M6 (**D23**).
  - [X] **D7** --- new **`Edge`** `referenceType` for edge **From** / **To**; subset **Stub** via **`connectionType: 'Edge'`**; non-structural for org graph.
  - [X] **D18** --- **`componentTopology`** + **`affordanceCache`** split (see [Caching architecture (D18)](#caching-architecture-d18)).
  - [X] **D8-D10** --- embed **`referencedBy`** on **`(target, ASSET#)`** forward rows; **`cacheAsset`** writer (see [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10)).
  - [X] **D31** --- **`ComponentPairRow`** strip/carry; **`referencedByUnion`** on **`MergedComponentResult`** (see [Plumb persisted `referencedBy` (D31)](#plumb-persisted-referencedby-d31)).
  - [X] **D30** --- **`ComponentStackMerge`** -> **`ComponentAggregate`** (see [ComponentStackMerge refactor (D30)](#componentstackmerge-refactor-d30)).
  - [X] **D11-D13** --- invalidation sketch (**D18**); cross-asset read via **`referencedByUnion`** (**D12**); import vertical out of scope (**D13**).
  - [X] **D14-D15** --- Area fan-out via **`referencedByUnion`** (edge endpoints only); **`mergeParticipationOrder`** for all folds (**D30**).
  - [X] **D16-D17** --- **`projectRoomExits`** wire shape; portal / outside endpoint nav rules.
  - [X] **D19-D22** --- Area workbench scope; client affordances merge; **RoomExit** confirmed; LLM labels stable with projection.
  - [X] **D23-D25** --- dual-read + manual DB migration + post-migration forbid; operator-owned migration; test retirement gated on forbid.
  - [X] Production room-local exit inventory (**D23**) --- see [Production exit inventory (Coyote demo)](#production-exit-inventory-coyote-demo).

- [ ] **Milestone 1 --- WML + StandardArea (asset mode)**
  - [ ] **Schema (Area topology exits, D26 / D29):** one global **`<Exit>`** parse surface (no context-forked converters); legacy **`to=`** and new **`uuid=`** + child tags both parse; **D29** / **D6** rules enforced in **Standardize**, not schema parent context.
    - [ ] **`mtw-base`:** register **`From`**, **`To`**, **`Forward`**, **`Back`** on **`tagType`** (Forward/Back via **`literalTagFactory`**; From/To like **`Parent`**).
    - [ ] **Widen `<Exit>`:** optional **`uuid`** and optional **`to`** on **`SchemaExitTag`**; **`typeCheckContents`** allows **From** / **To** / **Forward** / **Back** (and edit wrappers), not only **String**; print map round-trips both shapes (room/map **`to=`** path unchanged).
    - [ ] **Child converters + tests:** From/To ComponentUUID validation (**Parent** precedent); Forward/Back literals; fixtures for normative **D29** shape (including layered **Replace** on **To**).
    - [ ] **Dual-read guard:** **`<Exit to=(...)>`** under **`<Room>`** (and Map) still parses/round-trips (**D6**); **`StandardRoom`** ignores Area-shaped exits (no usable **`to`** / structural children --- see existing facet skip); M6 asset-mode forbid remains on **Room** ingest, not schema.
  - [ ] **Edge pattern** (**D27-D29**): **`uuid`** + editable **`from`** / **`to`** (**Parent**-style **From** / **To** tags) + literal payload; list class and factory; merge/diff keyed by **`uuid`**; layered **Replace** on **From** / **To**; **`StandardArea`** edge consumer enforces **D29** (reject **`from=`** / **`to=`** attributes, require child endpoints); asset-mode errors on bad Area edges --- defer strict Room-local forbid to M6 (**D23**).
  - [ ] Add **`Edge`** to **`StandardComponentReferenceKey`**; subset cascade + tests for **`connectionType: 'Edge'`** -> **Stub** (**D7**).
  - [ ] Extend **`StandardPositionGraph`**: **`positionGraph.edges`** as **`EdgeList`** alongside **`nodes`**; **`referencedKeys()`** emits **From** / **To** as **`referenceType: 'Edge'`**.
  - [ ] Validation for **D4** (error when neither endpoint in **`nodes`**); tests in `area.test.ts` / `area.integration.test.ts`.
  - [ ] Update [`AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardArea** edges) when behavior is stable.

- [ ] **Milestone 2 --- Persisted `referencedBy` (assets + gateways)**
  - [ ] **Child plan:** create [`taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md`](../../lambda/assets/AGENT.areaTopologyReferencedBy.planning.md) --- **`cacheAsset`** writer, **`referencedBy`** tests, **`mtw.assets.componentTopology`** invalidation (**D8-D11**).
  - [ ] Extend **`cacheAsset`**: compute **`referencedBy`** from in-memory **`fileAsset`** / diff; patch **`(target, ASSET#)`** rows beyond **`diff._components`** when inverse changes (**D10**).
  - [ ] **`mtw-gateways`:** **`PersistedReferencedByEntry`** type; strip **`referencedBy`** in **`fetch.ts`**; extend **`ComponentPairRow`** / **`ComponentDataCache`** (**D31**).
  - [ ] **`ComponentData`:** pair rows carry **`referencedBy`**; **`getAcrossAssets`** feeds **`participationBatch`** with per-asset lists.
  - [ ] **`MergedComponentResult.referencedByUnion`** + union helper (**D31**, **D12**); golden test: two assets, two referrers, dedupe rules documented.
  - [ ] **`ComponentExamples`** / other aggregate callers: verify unchanged (use **`.merged`** only).
  - [ ] Invalidation contract (**D11**); tests in assets lambda; index updates must drive **`TopologyInvalidated`** once **`componentTopology`** exists (detail in assets child plan).

- [ ] **Milestone 3 --- Projection library + gateways pull (`mtw-wml` + `@tonylb/mtw-gateways`)**
  - [ ] Pure `projectRoomExits(...)` (name TBD): inputs = room id, merged Area edge sets (per **D14-D15**), index; output = `ExitFacetList` JSON.
  - [ ] Golden tests; document merge semantics (**D15**, **D5**).
  - [ ] `StandardRoom` in ephemeraWire: populate `exits` only via projection helper (no asset-mode source).
  - [ ] Gateways: **`assembleRoomTopologyAtPerspective`** + **`createComponentTopologyCacheHandler`** (perspective key aligned with **`ComponentExamples`** / render cache).

- [ ] **Milestone 4 --- Assets + ephemera caching integration**
  - [ ] **Child plan:** create [`taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`](../../lambda/ephemera/AGENT.areaTopologyExits.planning.md) (**D30**, **`internalCache.ComponentTopology`**, **`mtw.ephemera.affordanceCache`**, affordance publish, navigation, **D11** invalidation matrix).
  - [ ] **Child plan:** extend assets [`AGENT.areaTopologyReferencedBy.planning.md`](../../lambda/assets/AGENT.areaTopologyReferencedBy.planning.md) for **`componentTopology`** + gateways pull integration with M3.
  - [ ] **D30:** Refactor **`ComponentStackMerge`** to **`ComponentAggregate`**; remove **`mergeRoomExitsToJSON`** from affordance path; tests for layered exit overlay (**D,E** + remove **D** + add **F** -> **E,F**).
  - [ ] Assets: **`mtw.assets.componentTopology`** DataSource --- skinny **`TopologyInvalidated`** on Area / Room topology diffs (**D11** sketch).
  - [ ] Ephemera: register **`internalCache.ComponentTopology`**; **`mtw.ephemera.affordanceCache`** --- hydrate, Dynamo rows, catalog bump on invalidation (**D18**).
  - [ ] Affordance publish + navigation use hydrated topology slice; **`ComponentStackMerge`** = aggregate blueprint slice (transitional room **`exits`** until projection) + ephemera-only fields (roster, **`objects`**).
  - [ ] `getRoomExitTargetsForCharacter` shares projection / cache path with affordances.
  - [ ] Close **D11** invalidation matrix in child plans; verify `roomChannel: 'affordances'`.

- [ ] **Milestone 5 --- Authoring + migration**
  - [ ] Workbench **Area** editor (**D19**): **`shortName`**, **`nodes`**, **`edges`** (by **`uuid`**, retarget **From** / **To**, **Forward** / **Back**).
  - [ ] **Manual step (**D23**, **D24**):** migrate production DB --- room-local exits into Area **`positionGraph.edges`**; operator confirms before M6 forbid.
  - [X] Inventory captured in plan ([Production exit inventory (Coyote demo)](#production-exit-inventory-coyote-demo)); migration script TBD.
  - [ ] Charcoal-client: affordances merge (**D20**); **RoomExit** parity smoke (**D21**).

- [ ] **Milestone 6 --- Cleanup (**D23** follow-up, **D25**)**
  - [ ] Forbid room-local **`<Exit>`** under **`<Room>`** in asset mode; remove dual-read ingest.
  - [ ] Remove room-local exit UI from Room edit component (**D19**).
  - [ ] Retire room-local exit **authoring** tests (**D25** --- same gate as forbid).
  - [ ] Durable docs: `mtw-wml` AGENT files, ephemera internalCache AGENT, multi-channel contract cross-links.
  - [ ] Archive this plan.

---

## Production exit inventory (Coyote demo)

**Scope (**D23**, **D24**):** Single production DB; Coyote demo topology. Canonical room ids (see [`AGENT.CoyoteGame.md`](../../../AGENT.CoyoteGame.md)): **`CLIFFBASE`** = **`ROOM#VORTEX`** (prompt seam label only).

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

**Migration design TBD:** which **`AREA#`** owns **`nodes`** + these **`edges`** (likely one Area for the demo graph); assign stable edge **`uuid`** values at migrate time. **Verify after migrate:** **`projectRoomExits`** / affordances match today's labels (east, west, up, down, south, north) and nav pairs (**D16**, **D21**).

**Spatial reference (non-normative):** [`AGENT.CoyoteGame.md`](../../../AGENT.CoyoteGame.md) --- STRAIGHTAWAY -> CLIFFBASE -> CORNER along highway; CLIFFTOP above CLIFFBASE; BRIDGE south of CORNER.

---

## Verification

**`mtw-wml` (primary):**

```bash
cd packages/mtw-wml
npm test -- --watchAll=false ts/standardize/components/area.test.ts ts/standardize/components/area.integration.test.ts
# After projection exists:
npm test -- --watchAll=false ts/standardize/components/room.test.ts ts/standardize/integration/
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

**Assets (after Milestone 2):**

```bash
cd lambda/assets
# Add concrete jest paths when meta writer tests exist (child plan)
```

**Client (after Milestone 5):**

```bash
cd charcoal-client
npm test
```

---

## Progress

| Milestone | Status |
| --- | --- |
| Create platform task plan | Done |
| M0 Decision spike (D1-D7, D5b, D8-D31, D18-D25) | Done |
| M1 WML + StandardArea edges | Not started |
| M2 Persisted referencedBy | Not started |
| M3 Projection library | Not started |
| M4 Ephemera integration | Not started |
| M5 Authoring + migration | Not started |
| M6 Cleanup + archive plan | Not started |

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

- **D18 (normative):** **`mtw.assets.componentTopology`** (skinny invalidation + gateways pull) + **`mtw.ephemera.affordanceCache`** (durable hydrate). Cache key **`(ROOM#, perspectiveKey)`**. **`referencedBy`** remains a separate persisted index (M2). Full diagram: [Caching architecture (D18)](#caching-architecture-d18).

- **D8-D10 (normative):** Embed **`referencedBy`** on **`(targetUniversalKey, ASSET#assetId)`**; **`cacheAsset`** writer; logical target = any **`ComponentUUID`**. See [Persisted `referencedBy` (D8-D10)](#persisted-referencedby-d8-d10).

- **D31 (normative):** Strip before **`StandardComponent`**; carry per-asset lists on **`ComponentPairRow`**; union into **`referencedByUnion`** on **[`MergedComponentResult`](../../../packages/mtw-gateways/ts/assets/components/aggregate/result.ts)** in the same **`ComponentAggregate.get`** pass as **`merged`**. Topology reads **`.referencedByUnion`**; affordances / **D30** read **`.merged`** only. See [Plumb persisted `referencedBy` (D31)](#plumb-persisted-referencedby-d31).

- **D11-D13 (normative):** **D11** invalidation per [Caching architecture (D18)](#caching-architecture-d18). **D12** one room **`ComponentAggregate.get`** + Area batch at same **`mergeParticipationOrder`**. **D13** **`Meta::Import`** vertical does not select topology referrers --- use **`referencedByUnion`**; import vertical remains for **`fetchImports`** / inheritance assembly only.

- **D14 (normative):** Consult only **`AREA#`** referrers in **`referencedByUnion`** where **R** is an edge **`From`** / **`To`** endpoint. **Not v1:** Areas that list **R** only in **`nodes`**. **Future:** node-only membership for Area-scoped affordances (e.g. Area-level Features visible from all rooms in the Area).

- **D15 (normative):** All cross-asset folds use **`mergeParticipationOrder`** / **`ComponentAggregate`** --- same as **D30**; never concat per-asset exit JSON.

- **D16 (normative):** Per room **R**, each Area edge contributes **0 or 1** **`ExitFacet`** to **R**'s list (**Forward** when **R** is **`from`**, **Back** when **R** is **`to`**). **Two facets from one edge in the same list** only when **`From`** and **`To`** resolve to the same **R** (self-loop). Distinct endpoints **A -> B** yield one facet on **A**'s wire and one on **B**'s wire, not two on **A**.

- **D17 (normative):** Portal edges (**D4**): one in-graph endpoint. Affordance from in-graph **R**; movement requires peer **`ROOM#`**.

- **D19 (normative):** Workbench **Area** editor covers **`shortName`**, **`nodes`**, **`edges`**. Room editor drops exit UI after **D23** M6 forbid.

- **D20-D22 (normative):** Exits on affordances channel only (**D20**); **RoomExit** UI unchanged (**D21**); stable **`movementExitLabels`** if projection stable (**D22**).

- **D23-D25 (normative):** Dual-read until manual DB migration (**D24** operator confirm); then M6 forbid + test retirement (**D25**).

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

**Refactor:** **`ComponentStackMerge.get`** calls **`internalCache.ComponentAggregate.get([{ universalKey: roomId, mergeParticipationOrder }])`**, uses **`result.merged`** only (**`exits`**, **`shortName`**, etc. --- ignores **`referencedByUnion`**), then adds **`RoomCharacterList`**, **`Meta::Room.objects`**, and builds **`ephemeraWire`** **`StandardForm`** as today.

**Non-goals for D30:** Replacing **`ComponentRender`** (nav still uses render path until Milestone **4** topology/aggregate alignment). Materializing **`affordanceCache`** (**D18**) --- separate; after **D30**, transitional room **`exits`** on affordances at least respect layering until **Area** projection owns exits.

**Tests:** Layered canon + import overlay exit case; affordance publish smoke.

---

## Caching architecture (D18)

Normative split modeled on **`mtw.assets.componentExamples`** + **`mtw.ephemera.renderCache`** ([`componentExamples/AGENT.md`](../../../lambda/assets/componentExamples/AGENT.md), [`renderCache/AGENT.md`](../../../lambda/ephemera/dataSource/renderCache/AGENT.md)).

```text
cacheAsset / referencedBy meta     mtw.assets.componentTopology       mtw.ephemera.affordanceCache
        |                                    |                                  |
        |                            TopologyInvalidated  ---------------->  catalog bump + hydrate
        |                                    |                                  |
        +-------- pull: ComponentTopology.get (gateways) <---------------------+
                      (referencedByUnion + Area merged + projectRoomExits)
```

| Layer | Responsibility | Does **not** |
| --- | --- | --- |
| **Persisted `referencedBy` (M2, D9 B)** | **`referencedBy`** on **`(target, ASSET#)`** forward rows; read as **`referencedByUnion`** via **`ComponentAggregate.get`** (**D31**) | Store merged exit facets; separate **`Meta::ReferencedBy`** SK rows |
| **`mtw.assets.componentTopology`** | Detect topology-relevant blueprint diffs; emit skinny invalidation; optional diagnostics hooks | Ship full projected **`ExitFacetList`** on the event bus |
| **Gateways `ComponentTopology`** | **`ComponentAggregate.get(ROOM#)`** -> **`referencedByUnion`**; batch Area **`merged`**; **`projectRoomExits`** | Put **`referencedBy`** on **`StandardComponent`**; duplicate ROOM# pair fetch |
| **`mtw.ephemera.affordanceCache`** | Durable rows + hydrate-on-invalidate; memo via **`internalCache`** | Own **`RoomCharacterList`** or **`Meta::Room.objects`** |
| **Affordance publish** | Assemble **ephemeraWire** WML from hydrated slice + runtime ephemera fields | Recompute Area fan-out on every perception tick |

**Cache identity:** **`(ROOM#id, perspectiveKey)`** --- same participation / asset-stack notion as render cache and planned **`ComponentStackMerge`** alignment ([`internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md)). Character id selects perspective at hydrate time only.

**v1 simplifications (allowed):** No LLM / mark-state constellation; coarse invalidation (all perspectives for a room on any topology event) before finer edge-uuid granularity.

**Lambda wiring:** Register gateway handlers on **`internalCache`** per [`.cursor/rules/gateways-internal-cache.mdc`](../../../.cursor/rules/gateways-internal-cache.mdc) --- Ephemera calls **`ComponentTopology.get`**, not uncached **`assemble*`** on hot paths.

---

## Discovery notes (non-normative)

- Today ephemera: `componentData.getAcrossAssets(ROOM#id, allAssets)` then `mergeRoomExitsToJSON(assetData)` --- O(assets) point reads, no Area fan-out; **`ComponentStackMerge`** has no **`renderCache`**-style durable topology slice.
- Today affordances: [`publishRoomAffordancePerceptionMessages`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts) calls **`ComponentStackMerge.get(characterId, roomId)`** --- live merge every miss.
- Today `StandardForm.referencedBy(ref)` scans loaded components in one asset --- prototype for inverse lookup, not blueprint storage.
- **Forward vs inverse Dynamo grain:** **`(ROOM#r, ASSET#a)`** holds the body; **D9 (B)** adds **`referencedBy`** on that same row. **`mergeRoomExitsToJSON`** concat vs **`ComponentAggregate`** merge is the **D30** bug class.
- Area v1 doc explicitly deferred **edges** and ephemera RoomAffordances impact; this initiative implements that follow-on.
