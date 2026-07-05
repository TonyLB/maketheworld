# `mtw.ephemera.actions` - Implementation Guide

Detailed implementation playbook for parser affordances and related wiring in `mtw.ephemera.actions`.
For architecture and normative contract boundaries, see [`AGENT.md`](./AGENT.md).

---

## Adding a new command affordance

**Pipeline design:** Before adding deterministic shortcuts or LLM hops, read [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md) and [`../../llm/AGENT.contract.md`](../../llm/AGENT.contract.md). Deterministic short-circuits are allowed only at the **owning stage** when **closure-trusted inputs** suffice (frozen syntactic template or state-derived facts) --- not as phrase-bucket semantics in downstream compilers.

Use this checklist when adding a parse affordance (for example, `help`).

### 1) Extend parse result contracts

1. Add a new discriminant in [`baseClasses.ts`](baseClasses.ts) (`ParseCommandResult` variant + type guard).
2. Include the result in the appropriate unions (`IntentClassificationResult` in [`baseClasses.ts`](baseClasses.ts) and/or terminal `ParseCommandResult`) based on whether it is intent-discrimination-only or terminal parse output.
3. Keep confidence and shape requirements aligned with existing result variants.

### 2) Wire parse pipeline behavior

1. In [`parseCommand.ts`](parseCommand.ts), prefer deterministic short-circuit logic first when possible (no Bedrock call) **only when the owning stage can close over closure-trusted inputs** per [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md) (syntactic template or state-derived facts). Do not skip Bedrock to approximate semantic reasoning.
2. Keep discriminate-intent classification and interpretation aligned:
   - [`discriminateIntent/buildIntentClassificationPrompt.ts`](discriminateIntent/buildIntentClassificationPrompt.ts)
   - [`discriminateIntent/intentClassification.ts`](discriminateIntent/intentClassification.ts)
  - [`discriminateIntent/baseClasses.ts`](discriminateIntent/baseClasses.ts) (intent-only guards)
  - [`baseClasses.ts`](baseClasses.ts) (`IntentClassificationResult`, terminal parse union, and shared guards)
3. Run enrich flows only for intents that actually need post-discrimination enrichment.

### 3) Handle affordance in actions receive path

1. In [`index.ts`](index.ts), branch on the new affordance guard (from **`parseCommand`** on **`Parse Requested`**, or from **`content.assessed`** on **`Action Assessed`** when the outcome is server-trusted).
2. Choose one of two output paths:
   - `streamEvent` (preferred for cross-DataSource workflows and durable internal contracts)
   - `PublishMessage` side effect only (for strictly local player feedback with no stream contract)
3. Keep fallback/unknown behavior unchanged unless explicitly part of the affordance design.

### 4) Add/update stream contracts when needed

If the affordance emits a new internal stream payload:

1. Add payload type and runtime guard in [`publishedEvents.ts`](publishedEvents.ts).
2. Subscribe from downstream DataSource(s) and update subscribed guards where needed.
3. Add tests proving envelope guard acceptance and reject behavior for malformed payloads.

### 5) Wire message protocol end-to-end when needed

If the affordance introduces a new display protocol (for example, a specialized help card):

1. Add message bus publish variant in [`../../messageBus/baseClasses.ts`](../../messageBus/baseClasses.ts).
2. Add wire/interface message type and guards in [`../../../../packages/mtw-interfaces/ts/messages.ts`](../../../../packages/mtw-interfaces/ts/messages.ts) and related tests.
3. Ensure publish translation exists in [`../../publishMessage/index.ts`](../../publishMessage/index.ts).
4. Add client renderer route in [`../../../../charcoal-client/src/components/Message/index.tsx`](../../../../charcoal-client/src/components/Message/index.tsx) and component/test coverage.
5. If visual tokens are introduced, update client theme extensions in `charcoal-client/src/theme/`.

### Action Assessed (server-trusted outcomes)

When adding a new assessed outcome type (beyond **`Navigation`** and **`Home`**):

1. Extend **`ActionAssessedCommand.assessed`** union and **`isActionAssessedCommand`** in [`../localApiEvents.ts`](../localApiEvents.ts).
2. Add **`sendActionAssessed`** callers only from trusted server ingress (never raw websocket payloads).
3. Branch in [`index.ts`](index.ts) **`handleActionAssessed`** / shared **`processAssessedParseResult`** tail --- skip **`CommandTranscriptMessage`**.
4. Reuse or extend the same stream contracts as the parse path where behavior matches (e.g. **`Character Navigate`** for navigation, **`Character Home`** for home, **`Character Spoke`** for speech).

### Adding an atomic position-manipulation operator

Use when a player command commits a **membership-host** graph change via **`mtw.ephemera.positions`** (not relational in-room edges; not objects-lane existence). Shipped operators: **`takeHold`** (room -> character), **`drop`** (character -> room).

Cross-lane hub: [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md). Positions apply: [**Adding a cross-host manipulation apply coordinator**](../positions/AGENT.implementation.md#adding-a-cross-host-manipulation-apply-coordinator). Normative ingress: [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md).

1. **When to use this path** --- atomic transfer between eligible membership hosts (room, character inventory in v1). Atomic eligibility is decided by cardinality gate + membership complexity pre-gates (not a single enrich disposition hop). Relational placement, multi-object deltas, and multi-host membership (`multiPresent`) terminalize as **`Error`** (no stream, no positions) until a follow-on planner ships.

2. **Classify (usually unchanged for new atomics)** --- **`ObjectMembershipIntent`** + **`rawObjectSpans`** + **`verbClass`** (`acquire` | `release`); thread **`movementObjectLabels`** (union of room + held labels from parallel fetch) into the classify prompt via [`roomObjectLabelsFromCatalog`](roomObjectCatalogForCharacter.ts).

3. **Enrich (split stages)** --- **`parseCommand`** routes **`ObjectMembershipIntent`** -> membership path (`compileMembershipAtomic`); **`ObjectRelateIntent`** -> frame extract (B1), **`normalizeRelationSpan`** (B2), compiler stub. Complex outcomes remain terminal **`Error`** stubs. Containment **`in`** / **`inside`** / **`into`** -> **`nestingRelational`** Error.

4. **Identity resolve** --- deterministic **`shortName`** match in identity stage ([`resolveObjectSpan.ts`](enrich/objectManipulation/resolveObjectSpan.ts) + merged catalog via [`mergeObjectManipulationCatalogs`](enrich/objectManipulation/catalogMerge.ts)); optional identity LLM on NoMatch / AmbiguousMatch; fail closed on ambiguity. Agreement gate after pre-gates: **`release` + room host** -> **`notCarryingObject`**; **`acquire` + actor character host** -> **`alreadyHoldingObject`**.

5. **Terminal parse** --- extend **`ParseCommandObjectManipulationResult`** / guards in [`baseClasses.ts`](baseClasses.ts) when adding **`operationKind`** values.

6. **Egress** --- one stream type per atomic operator (**`Object Take Hold`** for **`takeHold`**; **`Object Drop`** for **`drop`**). Payload + guard in [`publishedEvents.ts`](publishedEvents.ts); wire **`Parse Requested`** branch in [`index.ts`](index.ts) only (no **`Action Assessed`** in v1).

7. **Reference files (`takeHold`)** --- egress wiring mirrors existing **`Object Take Hold`** path; tests under **`dataSource/actions/enrich/objectManipulation/`**, **`parseCommand.test.ts`** (mocked classify + enrich, agreement failures, **`on`**/**`under`** guard E2E), **`index.test.ts`** (stream egress + agreement OOC player copy).

8. **Downstream** --- positions registers envelope guard in [`../positions/subscribedEvents.ts`](../positions/subscribedEvents.ts) and routes to **`executeObject*`** under [`../positions/manipulation/membership/`](../positions/manipulation/membership/); perception extends object-manipulation fan-in (see [`../perception/AGENT.md`](../perception/AGENT.md)).

### `CharacterSpoke` steady-state

1. Trusted UI **`SayMessage`** / **`NarrateMessage`** / **`OOCMessage`** ingress via [`routeTrustedUiAction`](../routeTrustedUiAction.ts) -> **`sendActionAssessed`** with **`CharacterSpoke`** and `source: 'uiSpeech'`.
2. [`index.ts`](index.ts) checks **`CharacterMeta.RoomId`**; if absent, silent noop (legacy parity).
3. Else **`streamEvent`** **`Character Spoke`**; [`mtw.ephemera.narration`](../narration/AGENT.md) publishes room **`PublishMessage`**.
4. **`ReturnValue`** only when **`requestId`** is present on **`Action Assessed`** (no bare **`Success`** without **`RequestId`**).

### `Home` steady-state

1. Deterministic bare **`home`** and Bedrock **`HomeIntent`** resolve to terminal **`Home`** in [`parseCommand.ts`](parseCommand.ts) / [`discriminateIntent/index.ts`](discriminateIntent/index.ts).
2. [`resolveHomeTargetForCharacter.ts`](resolveHomeTargetForCharacter.ts) maps **`Home`** to `fromRoomId` (play membership) and `toRoomId` (`CharacterMeta.HomeId`).
3. [`index.ts`](index.ts) **`streamEvent`** **`Character Home`**; positions subscribes and calls **`executeCharacterNavigate`**.
4. Trusted UI/API home uses **`sendActionAssessed`** with **`Home`** and `source: 'uiHome'` ([`routeTrustedUiAction`](../routeTrustedUiAction.ts)).

---

## Affordance design notes

### Object manipulation classify + enrich steady-state (shipped --- B2.5 split intents)

**Pipeline design (general):** [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md), [`../../llm/AGENT.contract.md`](../../llm/AGENT.contract.md). This section documents the **instance** (field ownership table below).

Operator semantics: [`../../diegeticLogic/AGENT.operators.concepts.md`](../../diegeticLogic/AGENT.operators.concepts.md). Playbook for new atomics: [Adding an atomic position-manipulation operator](#adding-an-atomic-position-manipulation-operator). Positions ingress + apply: [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md). Manipulation kernel + adapter: [`../positions/manipulation/AGENT.implementation.md`](../positions/manipulation/AGENT.implementation.md#target-layering). Module inventory: [`enrich/AGENT.md`](enrich/AGENT.md).

**Classify contract (BD-11):** two intent types replace the retired umbrella **`ObjectManipulationIntent`**:

| Intent | Topology | Classify fields | Enrich path |
| --- | --- | --- | --- |
| **`ObjectMembershipIntent`** | Membership host transfer | **`objectSpans`**, **`verbClass`** (`acquire` \| `release`) | **`compileMembershipAtomic`** |
| **`ObjectRelateIntent`** | In-host edge on host graph | **`objectSpans`** only (no **`verbClass`**) | frame extract -> **`normalizeRelationSpan`** -> **`compileRelational`** |

**Pipeline sequence:**

```text
Parse Requested
  -> parallel: roomExitContext + roomObjectCatalog + heldInventoryCatalog
  -> [optional] deterministic fast path: minimal-verb take/drop/get -> ObjectMembershipIntent (skip Bedrock classify only)
  -> classify (LLM): ObjectMembershipIntent OR ObjectRelateIntent (movementObjectLabels = room + held)
  -> parseCommand branches by intent type -> enrichObjectManipulation(enrichRoute):
       membership: cardinality gate -> compileMembershipAtomic
            -> merged-catalog identity + optional identity LLM
            -> unary collapse -> membership observation + complexity pre-gates
            -> agreement gate (verbClass vs operationKind) on atomic path
            -> complexity LLM only on pre-gate defer
       relational: frame extract LLM -> normalizeRelationSpan -> compileRelational -> EstablishRelation | Error
  -> terminal parse / egress (Object Take Hold | Object Drop | EstablishRelation stream) or Error
```

**Bedrock budget (after classify):** membership path 0--2 hops (identity LLM when deterministic per-span resolve fails; complexity LLM when pre-gates do not decide). Relational route adds one frame-extract hop (B1). **`normalizeRelationSpan`** (B2) is deterministic --- no Bedrock. Containment **`in`** / **`inside`** / **`into`** -> **`nestingRelational`** Error (not **`establishRelation`**). Eligible exact-name, single-span, single-host, edge-free **`takeHold`** or **`drop`** may need **zero** post-classify Bedrock calls.

1. **In-room catalog:** [`roomObjectCatalogForCharacter.ts`](roomObjectCatalogForCharacter.ts) --- merged-layer read (`Positions` + character perspective + `ComponentAggregate` with improvisation fallback); labels via [`roomObjectLabelsFromCatalog`](roomObjectCatalogForCharacter.ts). Wired on **`Parse Requested`** as **`roomObjectCatalog`** on **`parseCommand`** input.
2. **Held inventory catalog:** [`heldInventoryCatalogForCharacter.ts`](heldInventoryCatalogForCharacter.ts) --- character `positionGraph` + character asset-stack perspective merge; parallel fetch on **`Parse Requested`**; threaded as **`heldInventoryCatalog`** on **`parseCommand`**. Identity resolves against [`mergeObjectManipulationCatalogs`](enrich/objectManipulation/catalogMerge.ts) (room entries first; held-only entries appended; dedupe by `objectId` with room winning).
3. **Classify prompt:** Section A2 (**`ObjectMembershipIntent`**) and A2b (**`ObjectRelateIntent`**) in [`discriminateIntent/buildIntentClassificationPrompt.ts`](discriminateIntent/buildIntentClassificationPrompt.ts); **`movementObjectLabels`** = union of room + held labels (parallel to **`movementExitLabels`**). Tie-breakers: **`ObjectRelateIntent`** beats **`ObjectMembershipIntent`** when line establishes an in-host relation; in-room **`get <noun>`** beats **`AcmeOrder`** when noun is in labels. **Deterministic classify skip:** minimal-verb **`take <object>`**, **`drop <object>`**, **`get <object>`** in [`deterministicChecks.ts`](discriminateIntent/deterministicChecks.ts) synthesize **`ObjectMembershipIntent`** (`confidence: 1`); **`get`** is label-gated so unknown products still reach Bedrock classify -> **`AcmeOrder`**.
4. **Model JSON (classify):**
   - Membership: `{ "type": "ObjectMembershipIntent", "objectSpans": [...], "verbClass": "acquire" | "release", "confidence": <number> }` -> **`rawObjectSpans`** + **`verbClass`**
   - Relate: `{ "type": "ObjectRelateIntent", "objectSpans": [...], "confidence": <number> }` -> **`rawObjectSpans`** only (legacy **`ObjectManipulationIntent`** rejected)
   - Interpreter: [`intentClassification.ts`](discriminateIntent/intentClassification.ts)

**Classify vs enrich ownership:**

| Field | Lane | Meaning |
| --- | --- | --- |
| **`verbClass`** | Classify (**`ObjectMembershipIntent` only**) | Membership **language** direction (`acquire` \| `release`) |
| **`operationKind`** (membership) | Enrich / compiler | Membership **ground truth** (`takeHold` \| `drop`) from pre-gates + agreement gate |
| **`operationKind`** (relational) | Frame extract LLM (BD-12) | Relational operator (`establishRelation` \| `dissolveRelation`); compiler validates only |

5. **Enrich:** [`enrich/objectManipulation/`](enrich/objectManipulation/) --- **`parseCommand`** passes **`enrichRoute: 'membership' | 'relational'`** and **`hostRoomId`** (from **`roomExitContext.fromRoomId`**) from classify intent type ([`index.ts`](enrich/objectManipulation/index.ts)); preposition regex in [`relationalRoute.ts`](enrich/objectManipulation/relationalRoute.ts) is **not** the primary router (retained for unit tests / documentation). Relational path: frame extract ([`frameExtract/runFrameExtractStage.ts`](enrich/objectManipulation/frameExtract/runFrameExtractStage.ts)) emits **`operationKind`** (BD-12), **`normalizeRelationSpan`** (B2), **`resolveRelationalGrounding`** (room catalog only, BD-5), **`evaluateRelationalLegality`** (BD-10), **`compileRelational`**. Membership path: **`compileMembershipAtomic`** with **`MembershipManipulationFrame`** ([`membershipFrame.ts`](enrich/objectManipulation/membershipFrame.ts)). Relational frames: **`ManipulationFrame`** ([`manipulationFrame.ts`](enrich/objectManipulation/manipulationFrame.ts)).
6. **Complexity pre-gates** (first decisive outcome wins; otherwise complexity LLM):

| Order | Condition | Outcome (no Bedrock) |
| --- | --- | --- |
| 0 | `containers.length === 0` | **Error** --- fail closed (no membership host) |
| 1 | `containers.length > 1` | **complex** --- `complexityClass: multiPresent` |
| 2 | Sole host `positionGraph` has exit edges touching target | **LLM fall-through** |
| 3 | Sole host is `ROOM#`, no edge-touch | **atomic** --- `operationKind: takeHold` |
| 4 | Sole host is actor `CHARACTER#`, no edge-touch | **atomic** --- `operationKind: drop` |
| 5 | otherwise | **LLM fall-through** --- relational / edge-implied complexity |

7. **`complexityClass` taxonomy** (all terminal **`Error`**, no stream, no positions): **`multiObject`** (multiple spans or multiple grounded targets in one command); **`multiPresent`** (one object, multiple membership hosts); **`relationalPlacement`** (edge-implied or LLM-classified relational move); unsupported atomic **`operationKind`**.
8. **Terminal parse outcomes:** **`ObjectManipulation`** (`operationKind: takeHold` | `drop`, grounded **`objectId`**); **`EstablishRelation`** (`operationKind: establishRelation` | `dissolveRelation`, grounded **`subjectId`** / **`targetId`**, **`relationKind`**, optional **`relationLabel`**, **`hostRoomId`** --- BD-1); or **`Error`** (complex classes, resolve/enrich failure, legality failures, no membership host, agreement failures **`notCarryingObject`** / **`alreadyHoldingObject`**).
9. **Receive path:** [`index.ts`](index.ts) --- **`Error`** -> **`WorldOOCMessage`** (player-mapped copy); grounded **`ObjectManipulation`** and grounded **`EstablishRelation`** -> silent success (no OOC); transcript from perception fan-in.
10. **Egress:** **`streamEvent`** **`Object Take Hold`** or **`Object Drop`** (`characterId`, `objectId`, `roomId`, optional `confidence`) from **`Parse Requested`** only (no **`Action Assessed`** branch in v1). Membership **`roomId`** from **`roomExitContext.fromRoomId`**; defensive OOC when character has no current room. Relational: **`Object Establish Relation`** or **`Object Dissolve Relation`** (`characterId`, `subjectId`, `targetId`, `roomId` from **`hostRoomId`**, `relationKind`, optional `relationLabel`, optional `confidence`) from grounded **`EstablishRelation`** parse on **`Parse Requested`** only. Stream contracts in [`publishedEvents.ts`](publishedEvents.ts). Positions subscribers: [`executeObjectTakeHold`](../positions/manipulation/membership/executeObjectTakeHold.ts), [`executeObjectDrop`](../positions/manipulation/membership/executeObjectDrop.ts), [`executeObjectEstablishRelation`](../positions/manipulation/relational/executeObjectEstablishRelation.ts), [`executeObjectDissolveRelation`](../positions/manipulation/relational/executeObjectDissolveRelation.ts). Perception fan-in: actions intent + positions **`Object Relation Changed`** fact -> **`WorldMessage`** ([`objectManipulationPresentationFanIn.ts`](../perception/objectManipulationPresentationFanIn.ts)). Parse must reject **`multiPresent`** and relational complexity before egress so bounded apply never receives ambiguous multi-host targets.

### `PromptInjectionAttempt` steady-state

Discriminate intent returns JSON `type: 'PromptInjectionAttempt'` when the intent prompt section H labels parser-manipulation tone.
`parseCommand` skips Acme order enrich like `Unknown`, and [`index.ts`](index.ts) emits `WorldOOCMessage` only (no `streamEvent` / `publishedEvents` entry), since this is in-franchise player feedback rather than a security boundary.

### `PredictHypothesis` steady-state

Coyote Game hypothesis is triggered by explicit player command (`predict` or LLM-classified paraphrase), not automatic **`Object Moved`**. Affordance refresh on **`Object Moved`** still runs via [`../affordanceOrchestration/AGENT.md`](../affordanceOrchestration/AGENT.md); coyoteGame does not subscribe to **`Object Moved`**.

1. **Deterministic:** bare **`predict`** only (no **`p`** alias) in [`discriminateIntent/deterministicChecks.ts`](discriminateIntent/deterministicChecks.ts).
2. **LLM paraphrases:** Section C2 in [`discriminateIntent/buildIntentClassificationPrompt.ts`](discriminateIntent/buildIntentClassificationPrompt.ts) (e.g. "what's my plan", "read the setup").
3. **Parse result:** `type: 'PredictHypothesis'` with `confidence`; no Acme enrich. Stream header and published payload use **`Predict Hypothesis`** (mirror **`Await RoadRunner`** / **`AwaitRoadRunner`** naming).
4. **Receive path:** [`index.ts`](index.ts) --- not in a Coyote demo room -> **`WorldOOCMessage`** guidance, no **`streamEvent`** and no Bedrock. In a Coyote room (including empty staging), **`streamEvent`** **`Predict Hypothesis`**. Do **not** add a parallel **`WorldOOCMessage`** on the actions path (unlike **`Await RoadRunner`**, which uses both OOC ack and outcome-channel placeholder); in-flight feedback is the coyoteGame **`CoyoteGameHypothesisMessage`** placeholder. Payload + guard: [`publishedEvents.ts`](publishedEvents.ts); envelope guard: [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts).
5. **Downstream:** `mtw.ephemera.coyoteGame` subscribes to **`Predict Hypothesis`** and runs the hypothesis pipeline via [`handlePredictHypothesis`](../coyoteGame/handlers/handlePredictHypothesis.ts).

### `LookRoom` / `LookComponent` as reference pattern

`LookRoom` (parsed bare `look` / `l`) and `LookComponent` (trusted UI/link with explicit `componentId`) are the preferred cross-DataSource pattern for affordances that need render/perception ordering:

1. actions publishes `Look Command Requested` (`componentId` is the character's current room for `LookRoom`, or the trusted EphemeraId for `LookComponent`; optional `directResponse` for Knowledge links)
2. `mtw.ephemera.renderOrchestration` subscribes
3. [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) registers the appropriate perception thread (`roomDescription`, `featureDescription`, or `knowledgeDescription`), then runs `orchestrateRenderRequest` in the same `receiveEvents` invocation

This preserves perception-thread ordering before downstream render behavior (`Render Pertains` to terminal `PerceptionMessage`).

Trusted UI **`look`** and link API Feature/Knowledge ingress use **`sendActionAssessed`** with **`LookComponent`** (`source: uiLook` | `link`) via [`routeTrustedUiAction`](../routeTrustedUiAction.ts) or [`app.ts`](../../app.ts) --- not direct orchestration calls.

---

## Acme `stableKey` implementation notes

This section complements the normative contract in [`AGENT.md`](./AGENT.md).

### Pre-Bedrock placement cap

[`enrich/acmeOrder/index.ts`](enrich/acmeOrder/index.ts) runs **[`countCoyotePlacedObjectsAcrossRooms`](utilities/countCoyotePlacedObjectsAcrossRooms.ts)** before any **`invokeBedrockAcmeOrderEnrich`**. If total Coyote demo-room placement rows exceed **20**, enrich returns **`ParseCommandErrorResult`** and skips Bedrock and finalize.

### Two phases (required order)

1. **LLM-first (Acme order enrich):** [`buildPrompt.ts`](enrich/acmeOrder/buildPrompt.ts) provides occupied key context and model proposes candidate **`stableKey`** values per valid line (only after the placement cap passes).
2. **Deterministic finalize (contract boundary):** [`finalizeStableKeysDeterministic`](stableKey/finalizeStableKeysDeterministic.ts) validates and repairs collisions/invalid proposals with deterministic allocation rules before publish.

### Where enforcement runs

In [`index.ts`](index.ts), Acme order flow is:

1. [`collectCoyoteOccupiedStableKeys`](stableKey/collectCoyoteOccupiedStableKeys.ts) builds occupancy snapshot from Coyote game rooms and room objects.
2. **`parseCommand({ command, occupiedStableKeys })`** calls **`enrichAcmeOrder`**, which applies the placement cap (step above); on success, reuses the snapshot from (1) in Acme order enrich prompts.
3. **`finalizeStableKeysDeterministic`** assigns final **`stableKey: string`** values per valid line.
4. actions publishes **`Acme Order`**, then objects persists pass-through keys in current room context.

---

## Verification

From [`lambda/ephemera/`](../../):

```bash
cd lambda/ephemera && npx jest dataSource/actions/ dataSource/objects/
```

When message protocols or client rendering are part of the affordance change, also run:

- `npx jest ../../packages/mtw-interfaces/ts/messages.test.ts ../../packages/mtw-interfaces/ts/ephemera.test.ts`
- relevant tests under `lambda/ephemera/publishMessage/`
- relevant tests under `charcoal-client/src/components/Message/`
