# Diegetic logic --- operators

Operator semantics for play-time object manipulation. Normative ingress and apply rules live in lane contracts; this file holds **fiction**, **transcript obligations**, and **lane split** for each operator.

Extension of [`AGENT.concepts.md`](AGENT.concepts.md). Unknowns vocabulary: [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md). Four-lane wiring hub: [`AGENT.implementation.md`](AGENT.implementation.md).

---

## Intent, fact, presentation

Atomic manipulation operators follow the same three-leg pattern as navigate:

| Leg | Lane | Role |
| --- | --- | --- |
| **Intent** | `mtw.ephemera.actions` | Grounded proposal after classify + split-stage enrich (trusted ids post-parse) |
| **Fact** | `mtw.ephemera.positions` | Graph persist + **`Object Moved`** membership-host endpoints |
| **Presentation** | `mtw.ephemera.perception` | Fan-in intent + fact -> single **`WorldMessage`** transcript line |

Affordance refresh on placement change reuses the existing **`Object Moved`** -> affordance orchestration path.

---

## `takeHold` (shipped)

**Player fiction:** The character picks up an object that is present in the current room. The object leaves the room's play membership graph and enters the character's inventory graph in **one** atomic apply --- not a separate "in plain sight" fiction with unchanged storage.

**Graph delta:** Remove **`Object`** node from source **`Meta::Room.positionGraph`**; add **`Object`** node to **`Meta::Character.positionGraph`**; update adjacency reverse index accordingly.

**Lane split:**

| Stage | Artifact |
| --- | --- |
| Classify | **`ObjectManipulationIntent`** + raw object span(s) + **`verbClass: acquire`** (no **`operationKind`** at classify) |
| Enrich | Identity -> membership observation -> complexity pre-gates (optional LLM); atomic path yields **`operationKind: takeHold`** |
| Egress | **`Object Take Hold`** stream (`characterId`, `objectId`, `roomId`) |
| Apply | [`applyObjectTakeHold`](../dataSource/positions/manipulation/membership/applyObjectTakeHold.ts) |
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

Copy is **deterministic template** at fan-in emit (no copy-generating LLM hop). Labels resolve at emit time via [`resolveTakeHoldPresentationLabels.ts`](../dataSource/perception/resolveTakeHoldPresentationLabels.ts); fallbacks **`Someone`** / **`something`** when names are unavailable.

Implementation: [`../dataSource/perception/objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts), [`publishObjectManipulationPresentation.ts`](../dataSource/perception/publishObjectManipulationPresentation.ts).

---

## `drop` (shipped)

**Player fiction:** The character releases a held object. The object leaves the character's inventory graph and enters the current room's play membership graph in **one** atomic apply --- symmetric inverse of pick-up, not a separate "in plain sight" fiction with unchanged storage.

**Graph delta:** Remove **`Object`** node from **`Meta::Character.positionGraph`**; add **`Object`** node to **`Meta::Room.positionGraph`**; update adjacency reverse index accordingly.

**Lane split:**

| Stage | Artifact |
| --- | --- |
| Classify | **`ObjectManipulationIntent`** + raw object span(s) + **`verbClass: release`**; **`movementObjectLabels`** = room + held (parallel **`heldInventoryCatalog`** fetch on **`Parse Requested`**) |
| Enrich | Held-catalog identity only; in-room-only span -> terminal **`Error`**; membership observation -> complexity pre-gates (optional LLM); atomic path yields **`operationKind: drop`** |
| Egress | **`Object Drop`** stream (`characterId`, `objectId`, `roomId`) |
| Apply | [`applyObjectDrop`](../dataSource/positions/manipulation/membership/applyObjectDrop.ts) |
| Fact | **`Object Moved`**: `froms: [CHARACTER#...]`, `to: ROOM#...` |
| Transcript | Fan-in -> **`${Player} drops ${Object}`** |

**Persist path:** [`applyObjectDrop`](../dataSource/positions/manipulation/membership/applyObjectDrop.ts) -> [`planObjectDropTransfer`](../dataSource/positions/manipulation/adapters/planObjectDropTransfer.ts) -> [`applyHostEffects`](../dataSource/positions/manipulation/applyHostEffects.ts). **Must not** add `updateDropPositionGraphs` or any `update*PositionGraphs` fork. Symmetric bounded apply to **`takeHold`** (trusted ingress `characterId` + `roomId`). Detail: [`manipulation/AGENT.implementation.md`](../dataSource/positions/manipulation/AGENT.implementation.md) Section B **`drop`**.

**Pre-flight legality:** v1 rejects illegal applies at positions apply (and parse-time resolve failures in actions). Actions does not duplicate full held-inventory legality checks before egress.

### Transcript obligations (unknowns --- withhold)

Per [`AGENT.unknowns.concepts.md`](AGENT.unknowns.concepts.md) **Withhold**: v1 drop copy states only the committed membership change in plain template form.

| Concern | v1 drop |
| --- | --- |
| Where in room the object lands | **Do not** assert or elaborate |
| How the object falls or comes to rest | **Do not** elaborate beyond "drops" |
| Unstated object attributes | **Do not** invent in transcript |

Copy is **deterministic template** at fan-in emit (no copy-generating LLM hop). Labels resolve at emit time via [`resolveTakeHoldPresentationLabels.ts`](../dataSource/perception/resolveTakeHoldPresentationLabels.ts) (shared for both operators; does not require object to remain in room graph post-apply); fallbacks **`Someone`** / **`something`** when names are unavailable.

Implementation: [`../dataSource/perception/objectManipulationPresentationFanIn.ts`](../dataSource/perception/objectManipulationPresentationFanIn.ts), [`publishObjectManipulationPresentation.ts`](../dataSource/perception/publishObjectManipulationPresentation.ts).

---

## Complex / relational manipulation (out of scope)

Commands that require relational edges (`On`, `In`, ...), multi-object coordinated deltas, or nested container hosts finalize to a terminal parse **`Error`** in v1 --- no stream, no positions ingress. Player-facing rejections include:

- **`multiObject`**: the command names or resolves more than one object target (e.g. "pick up the broom and the anvil").
- **`multiPresent`**: one named object appears on more than one membership host (ambiguous which copy to move).
- **`relationalPlacement`**: the move depends on in-room relational edges (e.g. "put the broom on the table").

Full processing requires a **separate follow-on task plan** for relational **operators** (parse, facts, presentation). Persist-layer hook (documented stub): [`../dataSource/positions/manipulation/AGENT.implementation.md`](../dataSource/positions/manipulation/AGENT.implementation.md#future-host-local-relational-patch-m4-stub-slice-5).

---

## Related documentation

| Doc | Role |
| --- | --- |
| [`AGENT.implementation.md`](AGENT.implementation.md) | Four-lane hub + follow-on operators table |
| [`../dataSource/actions/AGENT.implementation.md`](../dataSource/actions/AGENT.implementation.md) | Parse classify / enrich / egress playbook |
| [`../dataSource/positions/AGENT.implementation.md`](../dataSource/positions/AGENT.implementation.md) | Cross-host apply coordinator playbook |
| [`../dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md) | **`Object Moved`**, **`Object Take Hold`**, **`Object Drop`** ingress (normative) |
| [`../dataSource/perception/AGENT.md`](../dataSource/perception/AGENT.md) | Object-manipulation fan-in steady-state |
