# Acme enrich: generative affinity roles (`prep`, `creation`)

**Status:** Planning. Next: implement **`prep`** + **`creation`** in **`mtw-interfaces`** + Step B + bus validation --- **before** picking up clustering phase work (**[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)**).

This document is task-scoped; retire it after the initiative ships and fold lasting contracts into **`lambda/ephemera/dataSource/actions/AGENT.md`** and **[`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** (see [`taskPlanning/AGENT.md`](../../../../AGENT.md)).

## Purpose

Today **Acme Step B enrich** emits **[`CoyoteAffinityPossibility`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** rows per catalog line:** **`entity_modification`** ( **`target`** / **`mode`** ) **or** structural **`terminal` / `trigger` / `delivery` / `autonomous_agent`** --- each with **`aptness`**. Today **`entity_modification`** allows **`target`**: **`coyote` \| `road_runner` \| `environment`** --- we replace vague **`environment`** with **`prop`**: modifying **another staged prop** (**Resolved** --- tarp camouflaging a pit or catapult). **`prep`** stays separate (**before-beat** scene setup). Rows persist on **[`EphemeraMetaRoomObject.affinities`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** and ride the **`Acme Order`** bus (**[`AcmeOrderPublishedOrder`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)**).

**[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)** discussed **`priorAssembly`** first as a **clustering-seam** escape hatch (**Non-goal** there was unchanged enrich). Persisted affinities use **`prep`** and **`creation`** as the JSON **`role`** strings on **`CoyoteAffinityPossibility`** (not the seam token **`priorAssembly`**). Clustering docs may still say **`priorAssembly`** until seams align; treat **`prep`** as the enrich-backed equivalent for before-beat work. **This initiative ships enrich-side types first** so **`intendedRole`** can select among **real rows** on **`Meta::Room`**. Distinctions after Step B:

- **`prep`** --- assembly, rigging, digging, playspace setup **before** the main maneuver (shovel apt to **dig holes**; rope apt to **rig** before launch).
- **`creation`** --- **during** the plan, apt to **introduce ephemeral or generative effects** not modeled as separate inventory (Tesla coil apt for **lightning arcs** during the beat).

**Goal:** Extend **`CoyoteAffinityPossibility`** (and Step B prompts + validators + merge pass-through + snapshot formatting) so **`intendedRole`** in hypothesis clustering can stay **selection among persisted rows** without a parallel seam-only vocabulary, and downstream prompts gain **expressiveness** grounded in order-time labeling.

## Relationship to clustering refinement

| Track | Role |
| --- | --- |
| **This plan** | Schema + Acme Step B + **`isCoyoteAffinityPossibility`** + **`publishedEvents`** + **[`formatCoyoteAffinityPossibility`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts)** |
| **[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)** | Seam, **`parseHypothesisStageOneOutput`**, combine layer, Stage Two consumption (**resume implementation after this track**). |

**Ordering (locked): Enrich first.** Finish **this** initiative (interfaces + Step B + plumbing + snapshot formatting + tests), **then** return to clustering / combine / Stage Two work in **`AGENT.clusteringRefinement.plan.md`**. Clustering can keep designing on paper, but **prefer not** merging seam/parser/combine churn until **`prep`** / **`creation`** exist on **`Meta::Room`** from Acme enrich (**[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)** should align **`priorAssembly`** seam wording with **`prep`** when wired).

## Success criteria (draft)

- **`CoyoteAffinityPossibility`** includes new discriminated variants **`prep`** and **`creation`** (each with **`aptness`**), documented and distinct from **`entity_modification`** and structural roles.
- **`entity_modification` semantics (prompt + docs):** **`target`** is **`coyote` \| `road_runner` \| `prop`** (third target replaces **`environment`** in types + prompts). **`coyote` / `road_runner`** = modify **those characters**. **`prop`** = this catalog item is apt to **modify another staged prop** (camouflage, cover, disguise how another trap or device reads --- e.g. **tarp** over a **pit**). **Do not** emit **`environment`**; **do not** use **`prop`** for raw terrain / digging / rigging --- use **`prep`** for **before-beat** playspace setup; **plan-phase** may still imply constructed intermediates not present as **`OBJECT#`** rows.
- **`isCoyoteAffinityPossibility`** + **`AcmeOrderPublishedOrder`** validation (**[`isAcmeOrderPublishedOrder`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)**) accept only valid shapes; **`mergeAcmeOrderEnrich`** continues to pass **`affinities`** through without dropping unknown keys once typed. Drop **`environment`** from **`CoyoteAffinityTarget`** in lockstep with scrubbing **repo** tests/fixtures that still cite **`target: environment`** (**Resolved**: no production **`Meta::Room`** affinity rows to migrate during redesign).
- **`buildParseAcmeOrderEnrichPrompt`** documents the new roles **and** expanded **boundary examples** (**`prep`**: shovel dig; **`entity_modification` + `prop`**: tarp camouflaging pit; **`entity_modification`**: magnet-on-RR / glue-on-feet; **`creation`**: Tesla coil arcs; structural roles): when **`prep`** vs **`entity_modification`** (**three targets**) vs **`creation`** vs structural; deprecate **`environment`**; Step B JSON schema examples updated.
- **Snapshot serialization:** **`formatCoyoteAffinityPossibility`** / **`formatCoyoteObjectAffinitySuffix`** produce stable, readable lines for Coyote prompts (hypothesis, plan outcome).
- **Persistence path unchanged in shape:** **`handleAcmeOrderAddObjects`** / **`mergePersistMetaRoomObjects`** already store **`EphemeraMetaRoomObject`** blobs; **`Objects Changed`** carries full objects --- verify no validator strips new fields (**[`isEphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)** only checks **`affinities`** is an array when present; per-entry validation may need tightening if we require stricter rows).
- **Tests:** **`packages/mtw-interfaces`** (`coyotePlanAffinities.test.ts`), **`mergeAcmeOrderEnrich.test.ts`**, **`publishedEvents`** / **`parseCommand`** surfaces as touched, **`coyoteRoomObjectSnapshot.test.ts`** if formatting changes.

## Constraints and non-goals

- **Constraint:** **Coyote staged-object redesign:** instantiated **`Meta::Room`** databases are **empty of objects** --- there is **no** production Dynamo migration for legacy **`target: environment`**. **Repo** work only: update **Jest** / fixtures / sample JSON that still use **`environment`** when **`CoyoteAffinityTarget`** narrows to **`coyote` \| `road_runner` \| `prop`** (**Recommended order**). Expanding **`CoyoteAffinityPossibility`** must keep **`packages/mtw-interfaces`** and **`lambda/ephemera`** tests green at each step.
- **Constraint:** **`affinitiesFailed`** semantics unchanged: failure still means empty **`affinities`** array with optional flag per existing rules.
- **Non-goal:** Rewriting clustering or **`parseHypothesisStageOneOutput`** in this task (coordinate with clustering plan owners).
- **Non-goal:** Client UI work --- **`charcoal-client`** does not currently reference **`affinities`** in grep; confirm before scope creep if bus payloads reach the client indirectly through room meta.
- **Non-goal:** Inventing net-new Dynamo attributes; **`affinities`** remains the JSON carrier on **`Meta::Room.objects`**.

## Plumbing map (serialize, fetch, transmit)

Use this as the implementation checklist for **touch points**:

1. **Types + runtime guards:** **[`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)** --- **`CoyoteAffinityPossibility`**, **`isCoyoteAffinityPossibility`**, **`formatCoyoteAffinityPossibility`** if moved or mirrored (today formatting lives in **`coyoteRoomObjectSnapshot`**).
2. **Step B prompt:** **[`buildParseAcmeOrderEnrichPrompt.ts`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts)** --- **`prep`** / **`creation`** sections; **`entity_modification`** (**`coyote` / `road_runner` / `prop`** vs **`prep`**); deprecate **`environment`** for new emissions; JSON examples; **`COYOTE_AFFINITY_APTNESS_MIN`** interaction.
3. **Merge:** **[`mergeAcmeOrderEnrich.ts`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts)** --- pass-through already; confirm multi-line merge preserves new variants.
4. **Finalize / orders:** **`finalizeAcmeOrderFromStepB`** / **`AcmeOrder`** types if affinities are duplicated on command result types (**grep** **`AcmeOrder`** in actions).
5. **Bus:** **[`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts)** **`isAcmeOrderPublishedOrder`** --- array elements must satisfy extended **`isCoyoteAffinityPossibility`**.
6. **Objects persist:** **[`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts)** (and related) --- objects receive **`affinities`** on **`EphemeraMetaRoomObject`**; **[`mergePersistMetaRoomObjects`](../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts)** merges by **`uuid`**.
7. **Fetch / snapshot:** **`getRoomMeta`** path unchanged; **[`loadCoyoteRoomObjectsByRoom`](../../../../../lambda/ephemera/dataSource/coyoteGame/coyoteRoomObjectSnapshot.ts)** loads full meta; **format** functions serialize for Bedrock.

## Unknowns and decisions

### Resolved

| Topic | Resolution |
| --- | --- |
| **Payload shape** | **Flat `role` discriminator** on each **`CoyoteAffinityPossibility`** variant (same pattern as existing structural / **`entity_modification`** rows). **No** optional **`kind`** subtree for generative verbs in this initiative --- keeps **`isCoyoteAffinityPossibility`** straightforward. |
| **v1 `role` names** | **`prep`** (before-beat prep / assembly / rigging / playspace setup) and **`creation`** (in-plan generative or ephemeral effects). JSON **`role`** field uses these exact strings. |
| **Temporal sequencing vs clustering** | **Agreed:** enrich tags encode **aptness for** prep vs in-plan effects; **temporal ordering stays downstream** (combine, Stage Two, plan outcome). They **do not** instruct Stage One ordering. Document in Step B prompt + durable **`actions/AGENT.md`** when roles land. |
| **Dependency gate** | **Enrich first** --- ship **this** plan **before** returning to clustering-phase implementation (**[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)**). |
| **entity_modification vs prep** | **`prep`** = **before-beat** assembly, digging, rigging, playspace setup (**not** “how this SKU modifies another SKU”). **`entity_modification`** = apt to modify **something that counts as an entity** in cartoon logic: **`target`**: **`coyote` \| `road_runner`** (characters) **or** **`prop`** --- **another staged prop** (JSON string **`prop`**): this line item works **on** another trap/device/piece of gear (e.g. **tarp** camouflaging a **pit** or **catapult**). That is **not** generic “environment” terrain --- it is **prop-on-prop** narrative. Terrain-only / hole-digging **without** another named prop as the object of modification stays **`prep`** unless Step B ties **`entity_modification`** + **`prop`** to a specific **other** constructed or staged prop. |
| **Third `entity_modification` target** | **`prop`** --- JSON **`target`** value for **modify-another-prop** (**[`CoyoteAffinityTarget`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)**). |
| **`environment` in prompts** | **Deprecate:** do not emit **`environment`**. Use **`prep`** (scene setup), **`prop`** (modify another prop), or **`coyote` / `road_runner`** (modify character). |
| **`environment` in types** | **Remove** **`environment`** from **`CoyoteAffinityTarget`** and **add** **`prop`** (**Recommended order**). **No** persisted player data to rewrite --- only **tests**, fixtures, and prompts that still mention **`environment`**; retarget examples to **`prep`** or **`prop`** as semantics dictate; then **`CoyoteAffinityTarget`** = **`coyote` \| `road_runner` \| `prop`** + **`isCoyoteAffinityPossibility`** / **`isCoyoteAffinityTarget`** + **`formatCoyoteAffinityPossibility`** --- full test sweep. |
| **Production affinity legacy** | **None** during Coyote redesign --- **`Meta::Room.objects`** affinities are not carrying historical **`environment`** rows in live stores; scope stays **source + tests**. |
| **Generative vs structural roles** | **`prep`** / **`creation`** are **not** **`terminal` / `trigger` / `delivery` / `autonomous_agent`** --- structural = beat function in the plan graph; **`prep`** = before-beat setup; **`creation`** = in-beat ephemeral effect. Distinction is **settled** here; Step B **copy** must make it actionable (see **Recommended order**). |

**Not an unknown:** Teaching the model those edges (**examples**, counterexamples, tests) is **implementation** --- already tracked under **Step B prompt** and **Integration tests** in **Recommended order**, not an additional open decision.

### Still open

**None** --- third **`entity_modification`** **`target`** token is **`prop`** (**Resolved**).

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)).

1. **Task-plan conventions** --- [`taskPlanning/AGENT.md`](../../../../AGENT.md): durability, what belongs here vs **`AGENT.md`**.
2. **Current Acme enrich contract** --- [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) (**Acme catalog lines and `stableKey`** + links to Coyote prompts); **`buildParseAcmeOrderEnrichPrompt.ts`**, **`mergeAcmeOrderEnrich.ts`**.
3. **Types** --- **`CoyoteAffinityPossibility`**, **`isCoyoteAffinityPossibility`**, **`coyotePlanAffinities.test.ts`**.
4. **Downstream serialization** --- **`coyoteRoomObjectSnapshot.ts`**, **`coyoteRoomObjectSnapshot.test.ts`**.
5. **Clustering consumer** --- skim **[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)** **Resolved** / **`intendedRole`** so schema aligns with **selection among rows**.
6. **Testing** --- [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md); commands under **Verification**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Apply checkboxes to each actionable line and nested bullets as they complete.

- [X] **Design note:** **`prep`** + **`creation`** locked (**Resolved**); confirm **`entity_modification`** (**`coyote` / `road_runner` / `prop`**) + **`prep`** boundary matches types + validators after the **`environment` / `prop` (types + tests)** checkbox --- **no** production affinity migration (**Resolved**). **`JSON shape`** (**flat `role`**) + **enrich-first** gate remain **Resolved**. Capture near **`CoyoteAffinityPossibility`** if useful.
- [X] **Interfaces:** Extend **`CoyoteAffinityPossibility`** + **`isCoyoteAffinityPossibility`** + unit tests in **`packages/mtw-interfaces`** --- add **`role`: `prep`** and **`role`: `creation`** variants ( **`aptness` only**, flat discriminator); replace **`environment`** with **`prop`** on **`CoyoteAffinityTarget`** when scrubbing tests (same PR or immediately before).
- [X] **Step B prompt:** Update **`buildParseAcmeOrderEnrichPrompt`** --- dedicated **`prep`** and **`creation`** sections; rewrite **`entity_modification`** (**`target`**: **`coyote` \| `road_runner` \| `prop`** for new orders; **do not** emit **`environment`**); **boundary examples** including **`entity_modification` + `prop`**: tarp over pit / camouflaging another device; contrast **`prep`** (dig pit, rig rope) vs **`prop`** (disguise **that** pit); **`entity_modification`**: glue on RR, magnet on RR; **`creation`**: Tesla coil arcs; structural vs **`prep`** vs **`creation`**; aptness floor copy.
- [X] **Actions wire:** **`mergeAcmeOrderEnrich`** / **`AcmeOrder`** types / **`finalizeAcmeOrderFromStepB`** as needed; **`publishedEvents`** **`isAcmeOrderPublishedOrder`** stays aligned with **`isCoyoteAffinityPossibility`**.
- [X] **Snapshot formatting:** **`formatCoyoteAffinityPossibility`** (and caps / sort in **`formatCoyoteObjectAffinitySuffix`**) + tests.
- [X] **Integration tests:** **`parseCommand`** / enrich fixtures as appropriate; **`mergePersistMetaRoomObjects`** if merge rules need adjustment for new shapes.
- [X] **`environment` / `prop` (types + tests):** Update **Jest** and **repo** fixtures that use **`target: environment`** to **`prep`** or **`prop`**; drop **`environment`** from **`CoyoteAffinityTarget`** and **add** **`prop`** (**[`coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts)**); tighten **`isCoyoteAffinityPossibility`** / **`isCoyoteAffinityTarget`**, scrub **`buildParseAcmeOrderEnrichPrompt`** / **`formatCoyoteAffinityPossibility`**; run **Verification** suites. **No** Dynamo backfill (**Resolved**). **Do not** land before **`prep`** / **`creation`** and prompt guidance for three **`entity_modification`** targets are in place (**Resolved**).
- [ ] **Cross-plan handshake:** Update **[`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)** (**prerequisite / sequencing**, **`priorAssembly`** vs persisted **`prep`**) when **`prep`** / **`creation`** ship --- **`actions/AGENT.md`** already links this plan (**Related** table).
- [ ] **Durable docs:** Refresh **`actions/AGENT.md`** affinities sentence + **`coyotePlanAffinities.ts`** header comment if needed; retire **this** plan.

## Verification

```bash
cd lambda/ephemera && npx jest dataSource/actions/ dataSource/objects/ dataSource/coyoteGame/
```

```bash
cd packages/mtw-interfaces && npx jest ts/coyotePlanAffinities.test.ts
```

- Broader actions + objects sweep: [**`lambda/ephemera/dataSource/actions/AGENT.md`**](../../../../../lambda/ephemera/dataSource/actions/AGENT.md) **Verification** block.

## References

- Clustering prerequisite / consumer: [`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)
- Actions steady state: [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md)
- Objects merge: [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md)
- Types: [`packages/mtw-interfaces/ts/coyotePlanAffinities.ts`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts), [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)
