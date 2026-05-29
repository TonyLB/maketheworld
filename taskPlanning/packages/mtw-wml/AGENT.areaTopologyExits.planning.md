# Area topology exits (platform initiative)

**Status:** In progress. Planning complete enough to execute **Milestone 0 (decisions)**; implementation not started.

**Next step:** Close **D8-D12** and **D14-D16**; **Milestone 1** data-model blockers **D1-D7**, **D5b**, **D26-D29** are decided (see [Milestone gates](#milestone-gates)).

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

**Child plans (create when milestones start):**

- Ephemera: `taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md` (affordances, `ComponentStackMerge`, navigation, cache invalidation)
- Assets: `taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md` (`cacheAsset` meta, inverse index writer)

---

## Agreed direction (normative for this initiative)

1. Room-local exits are **not** authoring surface area; they are **ephemeraWire projection** only.
2. Area owns **edges**; updating topology is a change to Area (or its graph), not Room **content**.
3. **One projection function** (name TBD) feeds both affordance WML and command-time exit resolution (`getRoomExitTargetsForCharacter`).
4. **Persisted inverse references** (`referencedBy` or equivalent at blueprint / meta layer) are **required** for practical ephemera fetch --- in-memory `StandardForm.referencedBy()` is not sufficient at runtime scale.
5. Delivery is **phased**; dual-read or migration tooling may be required (see **D23**).
6. **Bidirectional topology:** Every Area **exit edge** is traversable in both directions. Topology lives on **`StandardArea.positionGraph.edges`** (with **`nodes`**), not on Room blueprint rows. **`edges`** is a **union** (extensible); **`<Exit>`** is the **first** member shape (**D3**). Each edge has a stable **`uuid`** (**D28**) **local to that Area's `positionGraph`** (**D5b**). Layered assets merge edges by **`uuid`** inside one Area like components, but the same **`uuid` in two Areas is not one edge**. Endpoints are **`From`** / **`To`** (**D29**); labels are **`Forward`** / **`Back`** (**D26**). Runtime room wire still exposes a **single** outbound label per direction via projection (**D16**).

---

## Getting Started

1. **Task planning conventions:** [`taskPlanning/AGENT.md`](../../AGENT.md)
2. **WML / StandardForm:** [`packages/mtw-wml/ts/AGENT.md`](../../../packages/mtw-wml/ts/AGENT.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)
3. **Area implementation:** [`packages/mtw-wml/ts/standardize/components/AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardArea**)
4. **Facets today (one ref + payload):** [`packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md`](../../../packages/mtw-wml/ts/standardize/keys/facets/AGENT.facets.md), [`exit.ts`](../../../packages/mtw-wml/ts/standardize/keys/facets/exit.ts) (room-local; superseded for Area topology by **D27**)
5. **Ephemera affordances + navigation:** [`lambda/ephemera/internalCache/AGENT.md`](../../../lambda/ephemera/internalCache/AGENT.md) (`ComponentStackMerge`, `ComponentRender`), [`lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts`](../../../lambda/ephemera/dataSource/perception/publishRoomAffordancePerceptionMessages.ts), [`lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts`](../../../lambda/ephemera/dataSource/actions/roomExitTargetsForCharacter.ts)
6. **Asset persistence:** [`lambda/assets/dataSource/caching/AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) (`Meta::${tag}`, `cacheAsset`)

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
| **D6** | [X] | **Room `exits` in asset JSON (transition)** | **Dual-read period** for manual migration: asset mode may still **ingest** room-local **`exits`** / **`<Exit>`** under **`<Room>`** and map them into **Area `positionGraph.edges`** (tooling TBD). **ephemeraWire** projection unchanged. After migration, **forbid** room-local exits in asset mode (strip-on-standardize or hard error). |
| **D7** | [X] | **`Edge` reference type** | Add **`'Edge'`** to **`StandardComponentReferenceKey`** ([`baseClasses.ts`](../../../packages/mtw-wml/ts/standardize/components/baseClasses.ts)) for **Area `positionGraph.edges`** endpoint refs (**From** / **To**). **Do not** reuse **`'Position'`** (Map placement + structural parent tiers) or legacy **`'Exit'`** (room-local **`ExitsAndShortName`** subset). **Subset (normative):** cascade **`connectionType: 'Edge'`** -> target **Room** with **`requestType: 'Stub'`** (empty shell; no Situation/prose; **no** room-local exits copied). Mirror **Position** stub behavior only, not Map semantics. **SchemaOrganization:** treat **`Edge`** as **non-structural** (like **`Link`** / legacy **`Exit`** in [`standardize/AGENT.md`](../../../packages/mtw-wml/ts/standardize/AGENT.md)) --- do **not** add to **Direct**/**Position** parent tiers; **nodes** stay **Direct** for participation. **Milestone 1:** wire **`StandardArea.referencedKeys()`**, subset tests, and any cascade docs/examples that today say **Exit** for room-to-room. |

### Blockers --- persisted `referencedBy`

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D8** | [ ] | **Index granularity** | Per `ROOM#` (etc.): list of `{ assetId, referrerUniversalKey, referrerTag }`? |
| **D9** | [ ] | **Storage pattern** | `Meta::ReferencedBy::...` vs extend component meta vs rebuild-only index |
| **D10** | [ ] | **Writer** | `cacheAsset` only vs components verticals vs dual-write bridge |
| **D11** | [ ] | **Invalidation** | Which caches flush on Room vs Area vs edge-only diffs (assets + ephemera) |
| **D12** | [ ] | **Cross-asset scope** | Per-asset index + ephemera union query vs global partition on target id |
| **D13** | [ ] | **Imports / `_from`** | How import vertical affects "which Areas reference this room" |

*Precedent:* [`Meta::Import::...`](../../../lambda/assets/dataSource/components/verticals/AGENT.md) --- decide whether exit topology uses similar hop metadata or a simpler referrer list.

### Projection --- runtime assembly

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D14** | [ ] | **Which Areas to consult for room R** | All areas in asset union where R in `nodes` OR any area with edge touching R OR future "active area" from positions |
| **D15** | [ ] | **Merge order** | Align with today's asset layering / `mergeRoomExitsToJSON` ordering |
| **D16** | [ ] | **Outbound wire shape** | Project each Area edge to **up to two** room-local facets (one per endpoint): `reference` = other room; `payload` = **`Forward`** text when current room is **`from`**, **`Back`** text when current room is **`to`** (**D1**). Preserve today's `ExitFacetList` on **`StandardRoom`** in **ephemeraWire** for client/nav parity (**D21**). |
| **D17** | [ ] | **Edges with outside endpoint** | Affordance shows exit from current room; `to` must resolve to `ROOM#` |
| **D18** | [ ] | **Caching** | Cache `(characterId, roomId) -> projected exits` vs recompute; keys tied to **D11** |

### Product, authoring, client

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D19** | [ ] | **Workbench** | Area topology editor (select/update edges by **`uuid`**; retarget **`from`/`to`** in place); remove exits from room editor |
| **D20** | [ ] | **Client merge** | Affordances channel still `render.merge(affordances)`; exits only on affordances projection |
| **D21** | [ ] | **RoomExit UI** | Confirm chips unchanged if **D16** holds |
| **D22** | [ ] | **Parse / LLM** | `movementExitLabels` stable if projection stable |

### Migration

| ID | Status | Decision | Notes / options |
| --- | --- | --- | --- |
| **D23** | [ ] | **Migration strategy** | Big-bang transform vs dual-read vs tool-assisted per asset |
| **D24** | [ ] | **Canon / production** | Who runs migration; rollback |
| **D25** | [ ] | **Test matrix** | New area edge tests; ephemera projection tests; retire room-local exit authoring tests |

### Coordination (track only)

| ID | Topic |
| --- | --- |
| **C1** | Positions DataSource vs topology --- [`AGENT.positionsDataSource.planning.md`](../../lambda/ephemera/dataSource/positions/AGENT.positionsDataSource.planning.md) |
| **C2** | Multi-channel affordances --- [`AGENT.multiChannel.contract.md`](../../../lambda/ephemera/dataSource/AGENT.multiChannel.contract.md) |
| **C3** | Map `Position` facets vs Area topology --- division of labor |
| **C4** | Area import mapping gap (`SchemaImportMapping`) --- [`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md) |

---

## Milestone gates

| Milestone | Blocked until |
| --- | --- |
| **1** WML + `StandardArea` (asset mode) | **D1-D7**, **D5b**, **D26-D29** [X] |
| **2** Persisted `referencedBy` | **D8-D13** |
| **3** Projection library | **D1-D6**, **D14-D17**, **D16** |
| **4** Ephemera integration | **D2**, **D11**, **D14-D18**, Milestones **2-3** |
| **5** Authoring + migration | **D19-D24**, Milestone **1** |
| **6** Cleanup + durable docs | Prior milestones complete |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step lands.

- [ ] **Milestone 0 --- Decision spike**
  - [X] **D1** --- bidirectional edges; **Forward** / **Back** WML shape (see [Decisions register](#decisions-register)).
  - [X] **D28** --- stable **`uuid`** per edge for edits; endpoints are not the identity key.
  - [X] **D2**, **D26**, **D3**, **D27**, **D29** --- payload, **`positionGraph.edges`**, edge pattern, **`From`** / **`To`** children.
  - [X] **D4** --- at least one endpoint in **`nodes`**; **error** if neither.
  - [X] **D5** --- multi-edge same room pair + distinct labels is allowed; nav **ambiguousMatch** only on label -> multiple targets.
  - [X] **D5b** --- merge edges by **`uuid`** within one Area **`positionGraph`**; **`uuid`** not global across Areas.
  - [X] **D6** --- dual-read room-local exits during manual migration; forbid after.
  - [X] **D7** --- new **`Edge`** `referenceType` for edge **From** / **To**; subset **Stub** via **`connectionType: 'Edge'`**; non-structural for org graph.
  - [ ] Close **D8-D12** (storage + invalidation); spike `cacheAsset` meta write path ([`AGENT.diff.md`](../../../lambda/assets/dataSource/caching/AGENT.diff.md)).
  - [ ] Close **D14-D16** (projection scope + wire shape).
  - [ ] Optional: inventory room-local `<Exit>` in canon assets (**D23** sizing).
  - [ ] Create child plans under `taskPlanning/lambda/ephemera/` and `taskPlanning/lambda/assets/` when Milestones 2 and 4 start.

- [ ] **Milestone 1 --- WML + StandardArea (asset mode)**
  - [ ] Schema: Area **`<Exit uuid=(...)>`** with **`From`**, **`To`**, **`Forward`**, **`Back`** (**D26**, **D29**); reject room-local `<Exit>` in asset mode.
  - [ ] **Edge pattern** (**D27-D29**): **`uuid`** + editable **`from`** / **`to`** (**Parent**-style **From** / **To** tags) + literal payload; list class and factory; merge/diff keyed by **`uuid`**; layered **Replace** on **From** / **To**.
  - [ ] Add **`Edge`** to **`StandardComponentReferenceKey`**; subset cascade + tests for **`connectionType: 'Edge'`** -> **Stub** (**D7**).
  - [ ] Extend **`StandardPositionGraph`**: **`positionGraph.edges`** as **`EdgeList`** alongside **`nodes`**; **`referencedKeys()`** emits **From** / **To** as **`referenceType: 'Edge'`**.
  - [ ] Validation for **D4** (error when neither endpoint in **`nodes`**); tests in `area.test.ts` / `area.integration.test.ts`.
  - [ ] Update [`AGENT.implementation.md`](../../../packages/mtw-wml/ts/standardize/components/AGENT.implementation.md) (**StandardArea** edges) when behavior is stable.

- [ ] **Milestone 2 --- Persisted `referencedBy` (assets)**
  - [ ] Implement writer on `cacheAsset` (or agreed **D10** owner).
  - [ ] Read API for ephemera/gateways: "Areas referencing `ROOM#x` in asset A" (shape per **D8-D12**).
  - [ ] Invalidation contract (**D11**); tests in assets lambda.
  - [ ] Child plan: `taskPlanning/lambda/assets/AGENT.areaTopologyReferencedBy.planning.md`.

- [ ] **Milestone 3 --- Projection library (`mtw-wml` or shared)**
  - [ ] Pure `projectRoomExits(...)` (name TBD): inputs = room id, asset union, area rows / index; output = `ExitFacetList` JSON.
  - [ ] Golden tests; document merge semantics (**D15**, **D5**).
  - [ ] `StandardRoom` in ephemeraWire: populate `exits` only via projection helper (no asset-mode source).

- [ ] **Milestone 4 --- Ephemera integration**
  - [ ] `ComponentStackMerge` + `ComponentRender` exit paths use projection (not `mergeRoomExitsToJSON` on room rows).
  - [ ] `getRoomExitTargetsForCharacter` uses same projection as affordances.
  - [ ] Cache keys + invalidation (**D18**, **D11**).
  - [ ] Affordance publish unchanged envelope; verify `roomChannel: 'affordances'`.
  - [ ] Child plan: `taskPlanning/lambda/ephemera/AGENT.areaTopologyExits.planning.md`.

- [ ] **Milestone 5 --- Authoring + migration**
  - [ ] Workbench Area topology UI (**D19**); remove room exit editing.
  - [ ] Migration tool / dual-read (**D23-D24**).
  - [ ] Charcoal-client: confirm merge + `RoomExit` (**D20-D21**).

- [ ] **Milestone 6 --- Cleanup**
  - [ ] Remove deprecated room-local exit authoring paths and dual-read if any.
  - [ ] Durable docs: `mtw-wml` AGENT files, ephemera internalCache AGENT, multi-channel contract cross-links.
  - [ ] Archive this plan.

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
| M0 Decision spike (D1-D7, D5b, D26-D29 [X]; D8-D12, D14-D16) | In progress |
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

---

## Discovery notes (non-normative)

- Today ephemera: `componentData.getAcrossAssets(ROOM#id, allAssets)` then `mergeRoomExitsToJSON(assetData)` --- O(assets) point reads, no Area fan-out.
- Today `StandardForm.referencedBy(ref)` scans loaded components in one asset --- prototype for inverse lookup, not blueprint storage.
- Area v1 doc explicitly deferred **edges** and ephemera RoomAffordances impact; this initiative implements that follow-on.
