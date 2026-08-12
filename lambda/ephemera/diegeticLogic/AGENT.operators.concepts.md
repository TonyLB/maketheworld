# Diegetic logic --- operators

Operator semantics for play-time object manipulation. Normative ingress and apply rules live in lane contracts; this file holds **fiction**, **transcript obligations**, and **lane split** for each operator.

Extension of [`AGENT.concepts.md`](AGENT.concepts.md). Unknowns vocabulary: [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md). Four-lane wiring hub: [`AGENT.implementation.md`](AGENT.implementation.md).

---

## Intent, fact, presentation

Atomic manipulation operators follow the same three-leg pattern as navigate:

| Leg | Lane | Role |
| --- | --- | --- |
| **Intent** | `mtw.ephemera.actions` | Grounded proposal after classify + split-stage enrich (trusted ids post-parse) |
| **Fact** | `mtw.ephemera.positions` | Graph persist + descriptive fact stream (**`Object Moved`** for membership-host transfer; **`Object Relation Changed`** for in-host relational edges) |
| **Presentation** | `mtw.ephemera.perception` | Fan-in intent + fact -> single **`WorldMessage`** transcript line |

Affordance refresh on membership placement change reuses the existing **`Object Moved`** -> affordance orchestration path. Relational apply publishes internal **`RoomUpdate`** for affordance refresh on the host room.

---

## `takeHold`

**Player fiction:** The character picks up an object that is present in the current room. The object leaves the room's play membership graph and enters the character's inventory graph in **one** atomic apply --- not a separate "in plain sight" fiction with unchanged storage.

**Graph delta:** Remove **`Object`** node from source **`Meta::Room.ludicGraph`**; add **`Object`** node to **`Meta::Character.ludicGraph`**; update adjacency reverse index accordingly.

**Lane split:**

| Stage | Artifact |
| --- | --- |
| Classify | **`ObjectMembershipIntent`** + raw object span(s) + **`verbClass: acquire`** (no **`operationKind`** at classify) |
| Enrich | **`compileMembershipAtomic`**: merged identity -> membership observation -> complexity pre-gates (optional LLM) -> agreement gate; atomic path yields **`operationKind: takeHold`** |
| Egress | **`Object Take Hold`** stream (`characterId`, `objectId`, `roomId`) |
| Apply | [`orchestrateObjectMove`](../dataSource/positions/manipulation/membership/orchestrateObjectMove.ts) -> [`executeObjectMove`](../dataSource/positions/manipulation/membership/executeObjectMove.ts) |
| Fact | **`Object Moved`**: `froms: [ROOM#...]`, `to: CHARACTER#...` |
| Transcript | Fan-in -> **`${Player} picks up ${Object}`** |

**Pre-flight legality:** v1 rejects illegal applies at positions apply (and parse-time resolve failures in actions). Actions does not duplicate full room/object legality checks before egress.

### Transcript obligations (unknowns --- withhold)

Per [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md) **Withhold**: v1 pick-up copy states only the committed membership change in plain template form.

| Concern | v1 pick-up |
| --- | --- |
| Where in room the object sat | **Do not** assert or elaborate |
| How the character holds / carries it | **Do not** elaborate beyond "picks up" |
| Unstated object attributes | **Do not** invent in transcript |

Copy is **deterministic template** (no copy-generating LLM hop), assembled by the positions **presentation kernel** at flush from ingredients the compiler put on the narrate step. Labels resolve via [`resolveObjectMovePresentationLabels.ts`](../dataSource/perception/resolveObjectMovePresentationLabels.ts); fallbacks **`Someone`** / **`something`** when names are unavailable. The verb is **not** declared by this operator --- it is derived from which side of the move was the room.

Implementation: [`compilePositionKernelOp.ts`](../dataSource/positions/manipulation/kernel/compile/compilePositionKernelOp.ts) (verb + steps), [`presentStepSequence.ts`](../dataSource/positions/manipulation/kernel/presentStepSequence.ts) (copy + audience), [`orchestrateObjectMove.ts`](../dataSource/positions/manipulation/membership/orchestrateObjectMove.ts) (routing). Rules: [`positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md#narration-and-presentation).

---

## `drop`

**Player fiction:** The character releases a held object. The object leaves the character's inventory graph and enters the current room's play membership graph in **one** atomic apply --- symmetric inverse of pick-up, not a separate "in plain sight" fiction with unchanged storage.

**Graph delta:** Remove **`Object`** node from **`Meta::Character.ludicGraph`**; add **`Object`** node to **`Meta::Room.ludicGraph`**; update adjacency reverse index accordingly.

**Lane split:**

| Stage | Artifact |
| --- | --- |
| Classify | **`ObjectMembershipIntent`** + raw object span(s) + **`verbClass: release`**; **`movementObjectLabels`** = room + held (parallel **`heldInventoryCatalog`** fetch on **`Parse Requested`**) |
| Enrich | **`compileMembershipAtomic`**: merged identity -> membership observation -> complexity pre-gates (optional LLM) -> agreement gate; in-room-only + release language -> **`notCarryingObject`**; atomic path yields **`operationKind: drop`** |
| Egress | **`Object Drop`** stream (`characterId`, `objectId`, `roomId`) |
| Apply | [`orchestrateObjectMove`](../dataSource/positions/manipulation/membership/orchestrateObjectMove.ts) --- the same entry point as `takeHold`, host pair reversed |
| Fact | **`Object Moved`**: `froms: [CHARACTER#...]`, `to: ROOM#...` |
| Transcript | Fan-in -> **`${Player} drops ${Object}`** |

**Persist path:** [`executeObjectMove`](../dataSource/positions/manipulation/membership/executeObjectMove.ts) --- Synthesize executor re-run at execute time from a grounded seed, compiled to a step sequence, committed via [`commitStepSequence`](../dataSource/positions/manipulation/kernel/commitStepSequence.ts) in one transact. **Must not** add `updateDropLudicGraphs` or any `update*LudicGraphs` fork, and **must not** add a drop-specific execution module --- the direction is a host pair, not a code path. Detail: [`manipulation/AGENT.implementation.md`](../dataSource/positions/manipulation/AGENT.implementation.md).

**Pre-flight legality:** v1 rejects illegal applies at positions apply (and parse-time resolve failures in actions). Actions does not duplicate full held-inventory legality checks before egress.

### Transcript obligations (unknowns --- withhold)

Per [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md) **Withhold**: v1 drop copy states only the committed membership change in plain template form.

| Concern | v1 drop |
| --- | --- |
| Where in room the object lands | **Do not** assert or elaborate |
| How the object falls or comes to rest | **Do not** elaborate beyond "drops" |
| Unstated object attributes | **Do not** invent in transcript |

Copy is **deterministic template** (no copy-generating LLM hop), assembled by the positions **presentation kernel**. Labels resolve via [`resolveObjectMovePresentationLabels.ts`](../dataSource/perception/resolveObjectMovePresentationLabels.ts) --- shared with `takeHold`, and it does not require the object to remain in the room graph post-apply; fallbacks **`Someone`** / **`something`** when names are unavailable.

`drop` and `takeHold` stay **two intents** because the player's meaning and the pre-apply legality errors genuinely differ, but they are **one world-effect** and share one execution and narration path --- the direction is expressed solely by which host is `fromHostId`. Implementation and rules: as for `takeHold` above.

---

## `establishRelation`

**Player fiction:** The character places or arranges one in-room object relative to another on the **room host graph** without changing membership host --- e.g. putting a broom on a table or leaning a ladder against a wall.

**Graph delta:** Add directed edge on **`Meta::Room.ludicGraph`**: `from` = subject, `to` = target, `kind` (`On` | `Under` | `Against` | `Custom`), optional **`relationLabel`** when `kind === 'Custom'` (BD-3). No adjacency dual-write for relational edges.

**Lane split:**

| Stage | Artifact |
| --- | --- |
| Classify | **`ObjectRelateIntent`** + raw object span(s) (no **`verbClass`**) |
| Enrich | Frame extract LLM (**`operationKind: establishRelation`**, BD-12) -> **`normalizeRelationSpan`** -> **`compileRelational`** -> **`evaluateRelationalLegality`** |
| Egress | **`Object Establish Relation`** stream (`characterId`, `subjectId`, `targetId`, `roomId`, `relationKind`, optional `relationLabel`) |
| Apply | [`applyObjectRelationalChange`](../dataSource/positions/manipulation/relational/applyObjectRelationalChange.ts) via [`executeObjectEstablishRelation`](../dataSource/positions/manipulation/relational/executeObjectEstablishRelation.ts) -> **`applyHostRelationalPatch`** (`op: 'add'`) |
| Fact | **`Object Relation Changed`**: `operation: 'establish'`, `subjectId`, `targetId`, `hostRoomId`, `relationKind`, optional `relationLabel` |
| Transcript | Fan-in -> enum templates (`puts ... on`, `under`, `leans ... against`) or **`Custom`** label line |

**Pre-flight legality:** Actions-owned before egress: both subject and target nodes on host graph; idempotent duplicate edge -> allow/no-op; conflicting or non-trivial existing relational topology on subject/target -> **Error** stub (BD-10 defer bucket until Phase D plan LLM). Containment **`in`** / **`inside`** / **`into`** -> **`nestingRelational`** Error (future nesting operator, not **`establishRelation`**). Positions re-validates at apply.

### Transcript obligations (unknowns --- withhold)

Per [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md) **Withhold**: v1 relational copy asserts the committed relation in plain template form only.

| Concern | v1 establish |
| --- | --- |
| Exact placement geometry (position, orientation, offset) | **Do not** assert or elaborate |
| How the relation physically holds (friction, balance, tension) | **Do not** elaborate beyond template verb |
| Unstated object attributes | **Do not** invent in transcript |

Copy is **deterministic template** at fan-in emit (no copy-generating LLM hop). Labels resolve at emit time via [`resolveRelationalPresentationLabels.ts`](../dataSource/perception/resolveRelationalPresentationLabels.ts); fallbacks **`Someone`** / **`something`**.

Implementation: [`../dataSource/perception/objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts), [`publishObjectManipulationPresentation.ts`](../dataSource/perception/publishObjectManipulationPresentation.ts).

---

## `dissolveRelation`

**Player fiction:** The character removes an existing in-host relational link between two objects on the room graph --- e.g. taking a rope off a crate. Membership hosts are unchanged.

**Graph delta:** Remove matching directed edge on **`Meta::Room.ludicGraph`** (`op: 'remove'`); edge match includes **`from`**, **`to`**, **`kind`**, and **`relationLabel`** when **`Custom`**.

**Lane split:**

| Stage | Artifact |
| --- | --- |
| Classify | **`ObjectRelateIntent`** + raw object span(s) (no **`verbClass`**) |
| Enrich | Frame extract LLM (**`operationKind: dissolveRelation`**, BD-12) -> **`normalizeRelationSpan`** -> **`compileRelational`** -> **`evaluateRelationalLegality`** |
| Egress | **`Object Dissolve Relation`** stream (same payload shape as establish) |
| Apply | [`applyObjectRelationalChange`](../dataSource/positions/manipulation/relational/applyObjectRelationalChange.ts) via [`executeObjectDissolveRelation`](../dataSource/positions/manipulation/relational/executeObjectDissolveRelation.ts) -> **`applyHostRelationalPatch`** (`op: 'remove'`) |
| Fact | **`Object Relation Changed`**: `operation: 'dissolve'`, `subjectId`, `targetId`, `hostRoomId`, `relationKind`, optional `relationLabel` |
| Transcript | Fan-in -> **`${Player} takes ${Subject} off ${Target}`** |

**Pre-flight legality:** Matching edge on host graph required; no-match -> **Error** before egress (BD-10). Positions re-validates at apply.

### Transcript obligations (unknowns --- withhold)

Same **Withhold** rules as **`establishRelation`**: state only the committed relation removal; do not invent geometry or unstated physical detail.

Implementation: same fan-in modules as **`establishRelation`**.

---

## Out of scope

These finalize to terminal parse **`Error`** --- no stream, no positions ingress:

- **`multiObject`**: the command names or resolves more than one object target (e.g. "pick up the broom and the anvil").
- **`multiPresent`**: one named object appears on more than one membership host (ambiguous which copy to move).
- **`complexRelational`**: non-trivial existing in-host relational topology on subject/target blocks a deterministic plan (BD-10 defer bucket; Phase D plan LLM candidate).
- **`nestingRelational`**: containment language (`in`, `inside`, `into`) --- future **nested container** operator, not **`establishRelation`** v1.
- **`relationalPlacement`**: membership-path complexity LLM defer only (exit-edge-implied relational move on **`ObjectMembershipIntent`**); supported relational commands route via **`ObjectRelateIntent`**, not this error class.
- Held object + surface relation without explicit drop language (Phase C BD-8 composition: auto-**`drop`** then **`establishRelation`** in one atomic apply).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`AGENT.implementation.md`](AGENT.implementation.md) | Four-lane hub + follow-on operators table |
| [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md) | Parse classify / enrich / egress playbook |
| [`../dataSource/positions/AGENT.implementation.md`](../dataSource/positions/AGENT.implementation.md) | Cross-host apply + relational patch playbooks |
| [`../dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md) | **`Object Moved`**, **`Object Take Hold`**, **`Object Drop`**, **`Object Establish Relation`**, **`Object Dissolve Relation`**, **`Object Relation Changed`** ingress (normative) |
| [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) | Object-manipulation fan-in steady-state |
