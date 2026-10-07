# `mtw.ephemera.actions` - Implementation Guide

Detailed implementation playbook for parser affordances and related wiring in `mtw.ephemera.actions`.
For architecture and normative contract boundaries, see [`AGENT.md`](./AGENT.md).

---

## Adding a new command affordance

**Pipeline design:** Before adding deterministic shortcuts or LLM hops, read [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md) (design seams **and** output trust) and [`../../llm/AGENT.contract.md`](../../llm/AGENT.contract.md). Deterministic short-circuits are allowed only at the **owning stage** when **closed-world inputs** suffice (frozen syntactic template or state-derived facts) --- not as phrase-bucket semantics in downstream compilers.

Use this checklist when adding a parse affordance (for example, `help`).

### 1) Extend parse result contracts

1. Add a new discriminant in [`baseClasses.ts`](baseClasses.ts) (`ParseCommandResult` variant + type guard).
2. Include the result in the appropriate unions (`IntentClassificationResult` in [`baseClasses.ts`](baseClasses.ts) and/or terminal `ParseCommandResult`) based on whether it is intent-discrimination-only or terminal parse output.
3. Keep confidence and shape requirements aligned with existing result variants.

### 2) Wire parse pipeline behavior

1. In [`parseCommand.ts`](parseCommand.ts), prefer deterministic short-circuit logic first when possible (no Bedrock call) **only when the owning stage can close over closed-world inputs** per [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md) (syntactic template or state-derived facts). Do not skip Bedrock to approximate semantic reasoning.
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

1. **When to use this path** --- atomic transfer between eligible membership hosts (room, character inventory in v1). Atomic eligibility is decided by cardinality gate + membership complexity pre-gates (not a single enrich disposition hop). Multi-object deltas and multi-host membership (`multiPresent`) terminalize as **`Error`** (no stream, no positions). In-host relational edges use [Adding a host-local relational operator](#adding-a-host-local-relational-operator) instead.

2. **Classify (usually unchanged for new atomics)** --- **`ObjectMembershipIntent`** + **`verbClass`** (`acquire` | `release`); object spans come from **Parse** (LLM route) or self-built by the deterministic fast path ([`deterministicChecks.ts`](discriminateIntent/deterministicChecks.ts)), **not** from classify since iteration 3's Step 3. Thread **`movementObjectLabels`** (union of room + held labels from parallel fetch) into the classify prompt via [`roomObjectLabelsFromCatalog`](roomObjectCatalogForCharacter.ts).

3. **Transfer route (membership and containment)** --- **`parseCommand`** routes every **`transferMembership`** attempt (the fast path's synthesized skeleton included) to **`compileAttemptsFromSkeleton`** (ISS8203 slice 3). A take or drop returns **`ObjectManipulation`**; a containment move returns **`ObjectContainment`**. Terminal **`Consult`** / **`Abstain`** / **`Error`** as before; no complexity LLM. See [Object manipulation classify + enrich steady-state](#object-manipulation-classify--enrich-steady-state-b25-split-int

4. **Identity resolve (FT-2.2 membership / native skeleton relational)** --- pool emission in [`identityStage.ts`](enrich/objectManipulation/identityStage.ts) via [`resolveCatalogSpanToPool`](enrich/objectManipulation/resolveCatalogSpanToPool.ts) (exact -> single-candidate pool; non-exact -> [`buildSpanCandidatePool`](enrich/objectManipulation/embeddingMatch/buildSpanCandidatePool.ts)). **Membership:** `selectMembershipFromPool` (propose-N + FT-5 legality-gated tuple selector + existence guard; thin-margin -> terminal **`Consult`**; grey-band -> **`Abstain`**). The producer is `proposeMembershipCandidates.ts`: the verb's one plan × the one-key assignments over the v1-locus candidates, formed by the route-agnostic [`enumerateIdentityAssignments`](enrich/objectManipulation/enumerateIdentityAssignments.ts) (joint assignments over pools keyed by `stableRefKey`, confidence by `min`), plus `groundMembershipCandidate`, which builds the plan step per candidate, ungrounded (grounding in full is deferred to `sandboxMembershipDryRun`). The shared stage is [`selectPlanCandidate.ts`](enrich/objectManipulation/selectPlanCandidate.ts): `selectIdentityPlanTuple` grounds each raw candidate, then `expandAndAdjudicateMembershipCandidate` (boundary-edge Expansion + Adjudicate), `sandboxMembershipDryRun`, and `selectPlanTuple`. The identity-only fallback and the complexity-LLM re-ground in `compileMembershipAtomic.ts` reuse the same pieces. **Relational (producer/stage split, 2026-10-01):** [`identifySkeletonSpans.ts`](enrich/objectManipulation/identifySkeletonSpans.ts) runs the same `identityStage` resolver over the skeleton's `objectSpan` tokens, rekeyed onto `stableRefKey`. The producer is the shared one in [`attemptCandidates.ts`](enrich/objectManipulation/attemptCandidates.ts) (`proposeAttemptCandidates`, ISS8203 slice 2): the attempt's `stableRefKey`s, filtered to Object candidates, form the joint assignments through [`enumerateIdentityAssignments`](enrich/objectManipulation/enumerateIdentityAssignments.ts), each grounded and described into an attempt per candidate, before the dry run. Each candidate seeds the executor with a grounded `sameHost` instruction built from its ids, which the executor's `sameHost` command-expansion resolves into legs; [`synthesize/groundChange.ts`](enrich/objectManipulation/synthesize/groundChange.ts)'s relational product is no longer reached from this route. There is no construction-time Validation: every candidate whose Expansion finds a chain survives. Ranking among survivors runs through the same `selectPlanTuple` membership uses, replacing the old `preparedCandidates[0]` placeholder: `attemptDryRun` wraps each candidate's Expansion outcome as a `DryRunOutcome`, the shared describer builds Consult wording from the candidate's catalog labels, and a `defer` candidate abstains rather than reaching a complexity LLM, since this route has none (BD-25's calibrated-ranking half stays open). Identity LLM + bridge [`selectSingleSpanFromPool`](enrich/objectManipulation/selectSingleSpanFromPool.ts) retired from production. Calibration: [`enrich/objectManipulation/embeddingMatch/AGENT.md`](enrich/objectManipulation/embeddingMatch/AGENT.md).

5. **Terminal parse** --- every command attempt that reaches a route is one **`ParseCommandCommandAttemptResult`** (`type: 'CommandAttempt'`, `attempt`, `confidence`) in [`baseClasses.ts`](baseClasses.ts) (ISS8203 slice 4, PI-6). The route's operation kind, object ids and relation kind are read from the attempt's change step, not from the result. Object-directed looks use the same arm; `LookComponent` stays for UI-triggered looks only.

6. **Egress** --- **`Ludic Network Change Requested`** (2026-10-02), the generalized hand-off for every membership and relational attempt alike --- no per-operator event any more (`Object Take Hold`/`Object Drop` retired). Payload + guard in [`publishedEvents.ts`](publishedEvents.ts); wire **`Parse Requested`** branch in [`index.ts`](index.ts) only (no **`Action Assessed`** in v1). Carries the whole selected `CommandAttempt`, not flat fields; positions reads each action's `desiredResult`.

7. **Reference files (`takeHold`)** --- egress wiring mirrors the shared `publishLudicNetworkChangeRequested` path; tests under **`dataSource/actions/enrich/objectManipulation/`**, **`parseCommand.test.ts`** (mocked classify + enrich, agreement failures), **`index.test.ts`** (stream egress + agreement OOC player copy).

8. **Downstream** --- positions registers the envelope guard in [`../positions/subscribedEvents.ts`](../positions/subscribedEvents.ts) and routes to [`../positions/manipulation/commitAttempt.ts`](../positions/manipulation/commitAttempt.ts), which dispatches each action by primitive; perception extends object-manipulation fan-in (see [`../perception/AGENT.md`](../perception/AGENT.md)).

### Adding a host-local relational operator

Use when a player command commits an **in-host relational edge** on the actor's current room **`ludicGraph`** via **`mtw.ephemera.positions`** (not membership-host transfer; not nested containment). Shipped operators: **`establishRelation`** (`op: 'add'`), **`dissolveRelation`** (`op: 'remove'`).

Cross-lane hub: [`../../diegeticLogic/AGENT.implementation.md`](../../diegeticLogic/AGENT.implementation.md). Operator fiction: [`../../diegeticLogic/AGENT.operators.concepts.md`](../../diegeticLogic/AGENT.operators.concepts.md). Positions apply: [`../positions/manipulation/relational/`](../positions/manipulation/relational/). Normative ingress: [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md#host-local-relational-patch).

1. **When to use this path** --- subject and target are both objects on the room host graph; relation is a forward-graph peer edge (`Custom` + label). **Not** membership transfer. **Not** containment (`in` / `inside` / `into`, `on` / `onto`) --- Plan's containment template builds a `transferMembership` for it. A peer relation has no deterministic parse; it comes only from the LLM Plan fallback (not yet built).

2. **Classify** --- **`ObjectRelateIntent`** only (no **`verbClass`**, and no `objectSpans` --- classify no longer extracts spans for object-manipulation intents since iteration 3's Step 3; **Parse** owns tokenization). **`movementObjectLabels`** = room + held (same parallel fetch as membership).

3. **Enrich (native Parse-skeleton pipeline, iteration 3)** --- **Parse** ([`parse/runParseStage.ts`](enrich/objectManipulation/parse/runParseStage.ts)) tokenizes the command into a `ParseSkeleton` -> **`planSkeleton`** ([`plan/planSkeleton.ts`](enrich/objectManipulation/plan/planSkeleton.ts)) matches a containment template ([`plan/matchContainmentTemplate.ts`](enrich/objectManipulation/plan/matchContainmentTemplate.ts)) or a membership template; a skeleton that matches neither, including every peer relation, yields zero attempts and `Unimplemented` until the LLM Plan fallback lands -> **`runIdentityStageOverSkeleton`** ([`identifySkeletonSpans.ts`](enrich/objectManipulation/identifySkeletonSpans.ts), room + held catalog pools, `stableRefKey`-keyed) -> Grounding ([`synthesize/groundChange.ts`](enrich/objectManipulation/synthesize/groundChange.ts)) -> Expansion ([`synthesize/expandSameHost.ts`](enrich/objectManipulation/synthesize/expandSameHost.ts); no construction-time Validation) -> **`compileAttemptsFromSkeleton`** ([`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts)). No fallback to the retired frame-extract flow: a template miss abstains or errors.

4. **Terminal parse** --- the same **`ParseCommandCommandAttemptResult`** arm as item 5 (ISS8203 slice 4 collapsed the per-route arms, including the relational `EstablishRelation` arm). The relation is the attempt's `establishRelation`/`dissolveRelation` step; its kernel chain is lowered at commit, not carried on the result.

5. **Egress** --- **`Ludic Network Change Requested`** (2026-10-02) from grounded parse on **`Parse Requested`** only, same as membership's --- `Object Establish Relation`/`Object Dissolve Relation` retired. Payload + guard in [`publishedEvents.ts`](publishedEvents.ts); wire in [`index.ts`](index.ts). The attempt's action carries the grounded edge (`EstablishRelationChange`/`DissolveRelationChange`, subject/target/kind/label) as structural intent, not a pre-built `steps` chain --- positions rebuilds the chain itself at commit time (see [positions' `AGENT.contract.md`](../positions/AGENT.contract.md#ludic-network-change-requested-positions-owned)).

6. **Reference files** --- enrich: [`enrich/objectManipulation/`](enrich/objectManipulation/), [`parse/`](enrich/objectManipulation/parse/), [`plan/matchContainmentTemplate.ts`](enrich/objectManipulation/plan/matchContainmentTemplate.ts), [`identifySkeletonSpans.ts`](enrich/objectManipulation/identifySkeletonSpans.ts), [`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts), [`synthesize/`](enrich/objectManipulation/synthesize/). Tests: **`dataSource/actions/enrich/objectManipulation/`**, **`parseCommand.test.ts`**, **`index.test.ts`**, **`dataSource/positions/manipulation/commitAttempt.test.ts`** (narration units).

7. **Downstream** --- establish and dissolve alike: positions [`commitAttempt.ts`](../positions/manipulation/commitAttempt.ts) -> [`relational/planRelationalEdgeTransfer.ts`](../positions/manipulation/relational/planRelationalEdgeTransfer.ts) (rebuilds the chain fresh against live state) -> the general kernel entrypoint [`commitStepSequence`](../positions/manipulation/kernel/commitStepSequence.ts) directly --- no `applyObjectRelationalChange` layer on this route. Narration comes from the attempt's narration units, delivered by `commitAttempt`'s post-commit sweep; the perception fan-in that once narrated relational changes is retired.

### `CharacterSpoke` steady-state

1. Trusted UI **`SayMessage`** / **`NarrateMessage`** / **`OOCMessage`** ingress via [`routeTrustedUiAction`](../routeTrustedUiAction.ts) -> **`sendActionAssessed`** with **`CharacterSpoke`** and `source: 'uiSpeech'`.
2. [`index.ts`](index.ts) checks **`CharacterMeta.RoomId`**; if absent, silent noop (legacy parity).
3. Else **`streamEvent`** **`Character Spoke`**; [`mtw.ephemera.narration`](../narration/AGENT.md) publishes room **`PublishMessage`**.
4. **`ReturnValue`** only when **`requestId`** is present on **`Action Assessed`** (no bare **`Success`** without **`RequestId`**).

### `Home` steady-state

1. Deterministic bare **`home`** and Bedrock **`HomeIntent`** resolve to terminal **`Home`** in [`parseCommand.ts`](parseCommand.ts) / [`discriminateIntent/index.ts`](discriminateIntent/index.ts).
2. [`resolveHomeTargetForCharacter.ts`](resolveHomeTargetForCharacter.ts) maps **`Home`** to `fromRoomId` (play membership) and `toRoomId` (`CharacterMeta.HomeId`).
3. [`index.ts`](index.ts) **`streamEvent`** **`Character Home`**; positions subscribes and calls **`orchestrateCharacterMove`**.
4. Trusted UI/API home uses **`sendActionAssessed`** with **`Home`** and `source: 'uiHome'` ([`routeTrustedUiAction`](../routeTrustedUiAction.ts)).

---

## Affordance design notes

### Object manipulation classify + enrich steady-state (B2.5 split intents)

**Pipeline design (general):** [`../../llm/AGENT.concepts.md`](../../llm/AGENT.concepts.md), [`../../llm/AGENT.contract.md`](../../llm/AGENT.contract.md). **Hop-purpose narrative (Coyote-style):** [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md). This section documents the **instance** (field ownership table below).

Operator semantics: [`../../diegeticLogic/AGENT.operators.concepts.md`](../../diegeticLogic/AGENT.operators.concepts.md). Playbooks: [Adding an atomic position-manipulation operator](#adding-an-atomic-position-manipulation-operator) (membership), [Adding a host-local relational operator](#adding-a-host-local-relational-operator) (relational). Positions ingress + apply: [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md). Manipulation kernel + adapter: [`../positions/manipulation/AGENT.implementation.md`](../positions/manipulation/AGENT.implementation.md#target-layering). Module inventory: [`enrich/AGENT.md`](enrich/AGENT.md).

**Classify contract, superseded 2026-07-20 (iteration 7, Sub-iteration 1):** classify no longer decides **`ObjectMembershipIntent`** vs. **`ObjectRelateIntent`** --- it emits a generic **`Command`** for any in-world action (see [`AGENT.classifyPlanGeneralization.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.classifyPlanGeneralization.planning.md)). The membership-vs-relational split (still real, still needed by enrich) now happens **after** classify, from the Parse skeleton, via **`planSkeleton`**:

| Family | Topology | How it's decided | Enrich path |
| --- | --- | --- | --- |
| **`ObjectMembershipIntent`** | Membership host transfer | Deterministic pre-classify fast path (**`deterministicChecks.ts`**, `verbClass` `acquire`\|`release`) **or**, for classify-routed `Command`, [`planSkeleton.ts`](enrich/objectManipulation/plan/planSkeleton.ts)'s membership arm (leading skeleton text token `take`/`get` -> acquire, `drop` -> release) | Plan -> **`compileAttemptsFromSkeleton`** (ISS8203 slice 3; the fast path synthesizes its skeleton and enters Plan) |
| **`ObjectRelateIntent`** (not a classify-emitted type anymore) | In-host edge on host graph | [`planSkeleton.ts`](enrich/objectManipulation/plan/planSkeleton.ts)'s relational arm --- tries [`matchContainmentTemplate`](enrich/objectManipulation/plan/matchContainmentTemplate.ts) against the skeleton; no peer-relation template exists | Parse -> **`matchContainmentTemplate`** -> Identify/Grounding/Validation -> **`compileAttemptsFromSkeleton`** |

Both types still exist (**`ParseCommandObjectMembershipIntentResult`**/**`ParseCommandObjectRelateIntentResult`** in [`baseClasses.ts`](baseClasses.ts)) as the shape enrich dispatches on --- only their *source* changed, from classify's LLM judgment to `planSkeleton`'s deterministic skeleton check (membership) or the containment template's structural match (relational). A `Command`-routed skeleton matching **neither** family terminalizes as **`Unimplemented`** --- see the narrowed-classify pipeline sequence below (a deliberate, accepted Sub-iteration 1 regression for non-object-manipulation command families, not yet real dispatch targets).

**Pipeline sequence (current, post-iteration-7-Sub-iteration-2):**

Enrich may be **provisional** until the FT-5 selector auto-resolves; egress is **trusted-output** (grounded stream) or terminal **Consult** / **Abstain** / **Error** (no positions stream).

```text
Parse Requested
  -> parallel: roomExitContext + roomObjectCatalog + heldInventoryCatalog
  -> parallel: internalCache.ObjectEmbedding.get(objectIds) + attachEmbeddingsToCatalogEntries
  -> [optional] deterministic fast path: minimal-verb take/drop/get -> ObjectMembershipIntent (skip Bedrock classify only)
  -> classify (LLM): Command (realness/shape narrowed to 5 outcomes, iteration 7 --- no family decision)
  -> parseCommand's Command branch:
       [no Bedrock] matchNonObjectManipulationTemplate(command) -> Help | Home | AwaitRoadRunner terminal
       [no Bedrock] matchNavigationParaphrase(input) -> Navigation terminal | navigation Error
       -> runParseStage (unconditional Bedrock hop, once neither of the above hit) -> planSkeleton (ISS8203 slice 1: the skeleton's ungrounded attempts)
    -> every Plan attempt goes to one producer, `compileAttemptsFromSkeleton` (`parseCommand.ts`; ISS8203 slice 4). No primary-step dispatch; zero attempts falls through to Acme, then Unimplemented. The producer classifies each attempt by its own content (narration only = look; ends in `transferMembership` = take, drop or containment; else relation):
              transfer (take, drop, containment):
            -> Identify (identifySkeletonSpans) -> proposeAttemptCandidates (Enumerate, Ground, describe)
            -> expandAndAdjudicateCandidates (boundary dissolves + exit-contact challenge, every transfer) -> attemptDryRun (transfer preconditions, then executor)
            -> selectPlanTuple (+ one deferred-tier pass) -> ObjectManipulation | ObjectContainment | Consult | Abstain | Error
       relational (containment): Parse skeleton -> matchContainmentTemplate via planSkeleton (Plan; the attempt is passed in)
            -> identifySkeletonSpans (Identify) -> proposeAttemptCandidates (Enumerate, Ground) -> expandSameHost (Expansion; no construction-time Validation)
                        -> CommandAttempt result arm | Abstain | Error (no frame-extract fallback)
       none: matchAcmeOrderFamily(skeleton, input) -> AcmeOrder | Error (Bedrock via enrichAcmeOrder)
            no match -> Unimplemented (genuine miss, not one of the six reconnected families)
  -> terminal parse / egress (Ludic Network Change Requested, membership or relational) or Consult / Abstain / Error
```

**Bedrock budget (after classify):** membership path adds **+1** Parse hop (LLM route; the deterministic take/drop/get fast path skips it), **0** enrich Bedrock when exact identity succeeds; **+1 Titan embed** per distinct span on exact miss; **1** complexity LLM when pre-gates defer (identity LLM retired FT-2.1). Relational route adds **+1** Parse hop (BD-21; replaced the retired frame-extract hop); **0--2** Titan embeds (per distinct span on exact miss). **`planSkeleton`** (including its containment template) is deterministic --- no Bedrock. Containment **`in`** / **`inside`** / **`into`** builds a **`transferMembership`**, not **`establishRelation`**. Eligible exact-name, single-span, single-host, edge-free **`takeHold`** or **`drop`** on the deterministic fast path may need **zero** post-classify Bedrock calls.

1. **In-room catalog:** [`roomObjectCatalogForCharacter.ts`](roomObjectCatalogForCharacter.ts) --- merged-layer read (`Positions` + character perspective + `ComponentAggregate` with improvisation fallback); labels via [`roomObjectLabelsFromCatalog`](roomObjectCatalogForCharacter.ts). Wired on **`Parse Requested`** as **`roomObjectCatalog`** on **`parseCommand`** input.
2. **Held inventory catalog:** [`heldInventoryCatalogForCharacter.ts`](heldInventoryCatalogForCharacter.ts) --- character `ludicGraph` + character asset-stack perspective merge; parallel fetch on **`Parse Requested`**; threaded as **`heldInventoryCatalog`** on **`parseCommand`**. Identity resolves against [`mergeObjectManipulationCatalogs`](enrich/objectManipulation/catalogMerge.ts) (room entries first; held-only entries appended; dedupe by `objectId` with room winning).
3. **Classify prompt:** narrowed (iteration 7, Sub-iteration 1) to realness/shape only --- no family-specific sections. See [`discriminateIntent/buildIntentClassificationPrompt.ts`](discriminateIntent/buildIntentClassificationPrompt.ts) and [`AGENT.classifyPlanGeneralization.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.classifyPlanGeneralization.planning.md). **Deterministic classify skip (unchanged):** minimal-verb **`take <object>`**, **`drop <object>`**, **`get <object>`** in [`deterministicChecks.ts`](discriminateIntent/deterministicChecks.ts) synthesize **`ObjectMembershipIntent`** (`confidence: 1`); **`get`** is label-gated, so an unrecognized product now reaches classify -> **`Command`** -> `planSkeleton`'s membership arm (no catalog match downstream) rather than the retired **`AcmeOrder`** tie-break. **Leading-article normalization (FT-1.4):** [`peelLeadingArticleWhenTail`](discriminateIntent/peelLeadingArticleWhenTail.ts) strips `a` / `an` / `the` / `some` from deterministic spans **only when** non-empty content remains after peel (article-only spans like `a` pass through unchanged); applied in [`deterministicChecks.ts`](discriminateIntent/deterministicChecks.ts).
4. **Model JSON (classify):** `{ "type": "Command", "confidence": <number> }` or `{ "type": "WorldQuestion", "confidence": <number> }` (plus the three realness/shape outcomes) --- no family fields (`verbClass`, spans, etc.) at classify anymore. Interpreter: [`intentClassification.ts`](discriminateIntent/intentClassification.ts). Family decision (`verbClass` for membership) comes from `planSkeleton` post-Parse, not from classify's JSON.

**Classify vs enrich ownership:**

| Field | Lane | Meaning |
| --- | --- | --- |
| **`verbClass`** | Deterministic pre-classify fast path (**`deterministicChecks.ts`**), or [`planSkeleton.ts`](enrich/objectManipulation/plan/planSkeleton.ts)'s membership arm for classify-routed **`Command`** (iteration 7, Sub-iteration 1 --- classify's LLM no longer decides this) | Membership **language** direction (`acquire` \| `release`) |
| **`operationKind`** (membership) | Enrich / FT-2.2 selector | Membership **ground truth** (`takeHold` \| `drop`) from propose-N + locus dry-run; a deferred take or drop abstains (no complexity LLM, ISS8203 slice 3) |
| **`operationKind`** (relational) | **Plan** stage (BD-12) | Owned by Plan. Containment is the deterministic realization ([`plan/matchContainmentTemplate.ts`](enrich/objectManipulation/plan/matchContainmentTemplate.ts), a `transferMembership` with a `containment` flag, not an edge). Peer `establishRelation`/`dissolveRelation` have no deterministic realization: Plan's **LLM fallback** (BD-19 plan-only/joint, iteration 2) is the only producer, not yet built. Compiler grounds/validates only, never infers. Seam rule + provenance (superseded frame extract): [`../../llm/AGENT.contract.md`](../../llm/AGENT.contract.md) (BD-12 canonical incident). *Forward: `operationKind` may later become implicit in the `Change`'s `primitive` rather than a distinct scalar --- the seam (Plan owns the determination) is unchanged.* |

5. **Enrich:** [`enrich/objectManipulation/`](enrich/objectManipulation/) --- **`parseCommand`** hands every Plan attempt to **`compileAttemptsFromSkeleton`** with **`hostRoomId`** (from **`roomExitContext.fromRoomId`**); the producer ([`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts)) reads the attempt's content. Relational path (native Parse-skeleton pipeline): **`matchContainmentTemplate`** (deterministic Plan match for containment) -> **`identifySkeletonSpans`** -> the shared producer (Enumerate, no self-relations) -> **`expandSameHost`** (Expansion; no construction-time Validation).
6. **Complexity pre-gates: retired (ISS8203 slice 3).** The multi-host check is now a transfer precondition in `attemptDryRun`, and the exit and peer-relation cases are challenges that abstain until the deferred adjudication tier judges them.

7. **`complexityClass` taxonomy** (membership path only; all terminal **`Error`**, no stream, no positions): **`multiObject`** (multiple spans or multiple grounded targets in one command); **`multiPresent`** (one object, multiple membership hosts); **`relationalPlacement`** (exit-edge-implied or LLM-classified relational move on **`ObjectMembershipIntent`** --- not the supported **`ObjectRelateIntent`** path); unsupported atomic membership **`operationKind`**. Relational legality failures use **`complexRelational`** or resolve/enrich errors on the **`ObjectRelateIntent`** path.
8. **Terminal parse outcomes:** **`ObjectManipulation`** (`operationKind: takeHold` | `drop`, grounded **`objectId`**); **`EstablishRelation`** (`operationKind: establishRelation` | `dissolveRelation`, grounded **`subjectId`** / **`targetId`**, **`relationKind`**, optional **`relationLabel`**, **`hostRoomId`** --- BD-1); **`Consult`** (first-class **`ParseCommandConsultResult`** --- FT-3.1/FT-3.3; structured **`alternatives`** / proposed commands; membership + relational thin-margin; not resumable; **not** an enriched Error); **`Abstain`** (first-class **`ParseCommandAbstainResult`** --- FT-3.2/FT-3.3; grey-band / unfit head / no catalog-backed menu; not resumable); or **`Error`** (complex classes, resolve/enrich failure, legality failures, no membership host, locus failures **`notCarryingObject`** / **`alreadyHoldingObject`**, validator defer).
9. **Receive path:** [`index.ts`](index.ts) --- **`Error`** -> **`WorldOOCMessage`** (player-mapped copy); **`Consult`** -> **`WorldOOCMessage`** from structured alternatives (v1 OOC stub; perception owns steady-state copy); **`Abstain`** -> **`WorldOOCMessage`** could-not-understand stub (v1; perception may own copy later); grounded **`ObjectManipulation`** and grounded **`EstablishRelation`** -> silent success (no OOC); transcript from perception fan-in. **`Consult`** and **`Abstain`** emit **no** positions stream.
10. **Egress:** **`streamEvent`** **`Ludic Network Change Requested`** (2026-10-02) for membership (`characterId`, `attempt`, optional `confidence`; the attempt's `transferMembership` action carries the grounded `object`/`from`/`to` referents, derived from `roomExitContext.fromRoomId`; defensive OOC when character has no current room) and for relational (same event shape; the attempt's `establishRelation`/`dissolveRelation` action carries the grounded `subject`/`target`/`relationKind`/`relationLabel`) alike, from grounded parse on **`Parse Requested`** only. Stream contract in [`publishedEvents.ts`](publishedEvents.ts). Positions subscriber: [`commitAttempt.ts`](../positions/manipulation/commitAttempt.ts), which dispatches each action by primitive (`transferMembership` -> [`planObjectMoveTransfer`](../positions/manipulation/membership/planObjectMoveTransfer.ts); `establishRelation`/`dissolveRelation` -> [`planRelationalEdgeTransfer`](../positions/manipulation/relational/planRelationalEdgeTransfer.ts)) and commits every action's steps in one sequence. Narration is the attempt's own narration units (Expansion authors its facilitating dissolves'; an uncovered object move gets a positions-side bridge unit), delivered by `commitAttempt`'s post-commit sweep; none of it reaches perception. Parse must reject **`multiPresent`** and relational complexity before egress so bounded apply never receives ambiguous multi-host targets. **`Consult`** and **`Abstain`** are documented terminal egress variants (OOC only; pre-commit).

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
3. [`handleLookCommandRequestedForRenderOrchestration.ts`](../renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts) registers the appropriate perception thread (`roomDescription`, `featureDescription`, `knowledgeDescription`, or `objectDescription`), then runs `orchestrateRenderRequest` in the same `receiveEvents` invocation

This preserves perception-thread ordering before downstream render behavior (`Render Pertains` to terminal `PerceptionMessage`).

Trusted UI **`look`** and link API Feature/Knowledge ingress use **`sendActionAssessed`** with **`LookComponent`** (`source: uiLook` | `link`) via [`routeTrustedUiAction`](../routeTrustedUiAction.ts) or [`app.ts`](../../app.ts) --- not direct orchestration calls. **Trusted-UI *object* clicks are not wired**: [`routeTrustedUiAction`](../routeTrustedUiAction.ts)'s `look` branch still rejects `EphemeraObjectId` at its own type guard, even though `ParseCommandLookComponentResult`'s widened type would accept one. Text-command object look (below) is the only Object ingress today.

### Object-directed look (native skeleton pipeline)

`look`/`l`/`examine`/`x` **`<object>`** is matched deterministically off the command skeleton --- no Bedrock, no `Action Assessed`, and (unlike every other look) **no `Look Command Requested` publish from [`index.ts`](index.ts)**. Shipped 2026-07-25 (parse + delivery) / 2026-07-31 (client render).

**Plan stage.** [`plan/matchLookTemplate.ts`](enrich/objectManipulation/plan/matchLookTemplate.ts) mirrors [`matchContainmentTemplate.ts`](enrich/objectManipulation/plan/matchContainmentTemplate.ts)'s closed-template shape but is simpler: it matches a 2-token skeleton (`TEXT(verb) OBJECTSPAN`, verb in `{look, l, examine, x}`) and produces a bare ungrounded `Referent` (`objectSpanRef`) --- **not** a `Change`. A describe referent is singular with no relation to another referent, so it skips `Change`/`Assertion` and the general Synthesize executor entirely. Registered as the `'look'` family in [`plan/planSkeleton.ts`](enrich/objectManipulation/plan/planSkeleton.ts), dispatched from [`parseCommand.ts`](parseCommand.ts) alongside the `relational`/`membership` branches.

**Compile.** [`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts): Plan match -> Identify (`runIdentityStageOverSkeleton`, reused verbatim) -> the shared producer (`proposeAttemptCandidates`, `attemptCandidates.ts`) -> `selectPlanTuple` (`selectPlanCandidate.ts`). The producer reads the identity pool directly (not through the now-retired `objectCandidatesForSpan.ts` --- it dropped each candidate's `jointRelevance` down to a bare id, which `enumerateIdentityAssignments` needs), enumerates it through the same route-agnostic `enumerateIdentityAssignments` every other producer uses (one key, so confidence is just that key's own `jointRelevance`), and builds a `CommandAttempt` per candidate whose one action is a `NarrateAttemptAction` (`commandAttempt/action.ts`) --- describing a referent is not a world mutation, so it has no `PlanStep`/`desiredResult`, only a prose `description`. The dry run is a constant `legal` (nothing to validate), and `selectPlanTuple` runs the same floor/margin/Consult machinery every route uses; Consult wording is the shared describer's, "look at the {label}" (`attemptCandidates.ts`). `CompileDescribeFromSkeletonResult` now includes `ParseCommandConsultResult`; on a resolved candidate, `ParseCommandLookComponentResult` carries the new `attempt: CommandAttemptData` (optional on the type --- the other three `LookComponent` producers, below, build no attempt). The pool-read's `EphemeraObjectId`-only filter is **defensive, not structural**: Identify's catalog scan ([`roomObjectCatalogForCharacter.ts`](roomObjectCatalogForCharacter.ts)) only walks `ludicGraph.objectIds`, never `characterIds`, so Feature/Character candidates cannot be produced today. That filter is the one place to revisit if a character-inclusive catalog ever ships.

**Delivery.** [`index.ts`](index.ts)'s `LookComponent` branch calls [`commitAndPresentStepSequence`](../positions/manipulation/kernel/commitAndPresentStepSequence.ts) **in-process** with a single `{ kind: 'describe', referentId, referentKind: 'object' }` step, built directly from `componentId` (not from `attempt` --- this exit stays in-process, not a ludic-network change) --- the mutation kernel's commit leg no-ops (zero mutation steps hits `commitStepSequence`'s `steps.length === 0` fast path, so its `messageBus`/`streamEvent`/`getCurrentHost` deps are structural only), then [`presentStepSequence`](../positions/manipulation/kernel/presentStepSequence.ts) publishes `Look Command Requested` reusing `index.ts`'s own already-`mtw.ephemera.actions`-bound `streamEvent`. **Why in-process and not a bus hop:** see the normative `dataSourceKey` note in [`AGENT.md`](./AGENT.md#look-ingress) --- this is a hard constraint on any future kernel-invoking work, not a stylistic choice. Note `presentStepSequence` publishes a hardcoded `confidence: 1`, not `parseResult.confidence`.

Room/Feature/Knowledge `LookComponent` results are unchanged (still the direct `Look Command Requested` publish). Server-side render/delivery mechanics for the Object branch: [`../perception/AGENT.md`](../perception/AGENT.md#correlated-object-description-policy).

---

## Object-manipulation pipeline: route wiring

Concepts (the three jobs, producers vs. the shared stage, `CommandAttempt`): [`AGENT.concepts.md`](./AGENT.concepts.md). Rules: [`AGENT.contract.md`](./AGENT.contract.md). This section maps them onto modules.

**Stage -> module.**
- **Parse:** [`parse/runParseStage.ts`](enrich/objectManipulation/parse/runParseStage.ts) (LLM hop); tokens in [`parse/parseToken.ts`](enrich/objectManipulation/parse/parseToken.ts); `stableRefKey` stamped by [`parse/stampStableRefKeys.ts`](enrich/objectManipulation/parse/stampStableRefKeys.ts) (in Parse's forbidden-fields set alongside `id`/`objectId`).
- **Identify:** [`resolveObjectSpan.ts`](enrich/objectManipulation/resolveObjectSpan.ts), [`identityPlanCandidate.ts`](enrich/objectManipulation/identityPlanCandidate.ts), [`identifySkeletonSpans.ts`](enrich/objectManipulation/identifySkeletonSpans.ts), [`embeddingMatch/`](enrich/objectManipulation/embeddingMatch/); pool type in [`spanResolution.ts`](enrich/objectManipulation/spanResolution.ts). The catalog scan ([`roomObjectCatalogForCharacter.ts`](roomObjectCatalogForCharacter.ts)) walks only `ludicGraph.objectIds`, though candidates are typed `EphemeraThingId` ([`thing.ts`](enrich/objectManipulation/thing.ts)).
- **Plan:** containment --- [`plan/matchContainmentTemplate.ts`](enrich/objectManipulation/plan/matchContainmentTemplate.ts) (`put`/`place` + in/on prepositions -> `transferMembership`); peer relations have no template; membership --- classify's `verbClass` fixes the operation (`takeHold`/`drop`); look --- [`plan/matchLookTemplate.ts`](enrich/objectManipulation/plan/matchLookTemplate.ts). Step types: [`plan/planStep.ts`](enrich/objectManipulation/plan/planStep.ts).
- **Producers:** transfer (take, drop, containment) [`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts) over the shared producer; relational [`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts); containment `compileObjectContainmentFromSkeleton.ts`; Describe [`compileAttemptsFromSkeleton.ts`](enrich/objectManipulation/compileAttemptsFromSkeleton.ts). All enumerate through `enumerateIdentityAssignments`.
- **Grounding:** [`synthesize/groundChange.ts`](enrich/objectManipulation/synthesize/groundChange.ts).
- **Boundary-edge Expansion:** [`commandAttempt/expandBoundaryChallenges.ts`](commandAttempt/expandBoundaryChallenges.ts), reading [`interactionUnderTransfer.ts`](../positions/ludicGraph/expandValidate/interactionUnderTransfer.ts). Where else that table is read: [`enrich/objectManipulation/AGENT.md`](enrich/objectManipulation/AGENT.md#interaction-under-transfer).
- **Adjudicate:** [`commandAttempt/adjudicate.ts`](commandAttempt/adjudicate.ts).
- **Executor (placement expansion, dry-run Validation):** [`synthesize/`](enrich/objectManipulation/synthesize/AGENT.implementation.md).
- **Selection:** below.

**`CommandAttempt` per route.** [`commandAttempt/`](commandAttempt/) holds `action.ts` (`AttemptActionMember`; `PositionAttemptAction`, `NarrateAttemptAction`), `challenge.ts` (`CustomEdgeChallenge`, `ExitEdgeChallenge`, `WorldKnowledgeChallenge`), `verdict.ts` (`MetVerdict`, `ImpossibleVerdict`), `referent.ts` (`buildCommandAttemptReferent`, used to derive the referents section) and the container in `index.ts` (`recordVerdict(challengeId, verdict)`, `renderProse`, derived `result`).

**Naming debt (deliberate).** `NarrateAttemptAction` is the step-less action a look uses. Its name says narration (consequence prose), but a look is a describe and writes no world state. Renaming it to a describe-only name is deferred: the class is referenced across the attempt pipeline, so the rename is mechanical churn with no behavioural effect, and it is not worth doing alone.
- **Membership:** one attempt per joint assignment, from Plan's membership template; the shared stage expands and adjudicates it, and a take or drop with an exit contact carries an exit-contact challenge.
- **Relational:** one attempt per joint assignment, before its per-candidate dry run. Never runs boundary-edge classification: establishing or dissolving a peer edge is not a membership transfer.
- **Containment:** one attempt per joint assignment; `desiredResult` is a `transferMembership` step with the optional `containment` flag. The subject's current host is resolved only at commit (`commitAttempt`), against a live snapshot. Dry run is a trivial legality check.
- **Describe:** one attempt per candidate, whose one action is a `NarrateAttemptAction`; trivial dry run. Carried as the optional `ParseCommandLookComponentResult.attempt` (the other `LookComponent` producers build none).
- **Bus:** every route publishes its attempt on the payload; `positions/index.ts` reconstructs (`fromJSON`) it for the three routes that cross the actions -> positions bus. Describe's exit stays in-process, so nothing reconstructs its attempt.

---

## Shared selection stage (`selectPlanCandidate.ts`)

- **Producers.** Take, drop, containment, relational and Describe share one producer, `proposeAttemptCandidates` in [`attemptCandidates.ts`](enrich/objectManipulation/attemptCandidates.ts) (ISS8203 slice 2): it runs Enumerate, grounds each action through its per-kind `grounded(names)` method (PI-9), and builds each action's description and Consult wording (the describer, PI-2). The three routes keep only their entry checks and their result arm, which slice 4 collapses. All producers are single-plan today; a multi-plan producer adds its own outer loop. **Referents (ISS8203 slice 1):** a `CommandAttempt` stores no referents list. `referents()`, `toJSON()` and `renderProse` derive it from the actions, in order of first appearance of each `stableRefKey`. A span contributes once it carries an id and a name. Producers stamp each candidate's `groundedId`, `shortName` and `gloss` onto their steps' span referents by key (`stampCandidateReferents.ts`). A narration (look) carries its referent on the action, since it has no steps.
- **Candidate confidence with several referents is the `min` over the referents' `jointRelevance`.** The referents are claims that must all hold, so the joint score must not exceed its weakest one, and `min` keeps the calibrated floors (`T_JOINT_ABS`, `T_JOINT_ABS_UNARY`, `T_JOINT_MARGIN`) valid, since they were calibrated on single-span relevance. The sigmoid/logit combiners are for independent evidence about one claim, not conjunction across referents; combining identity confidence with an LLM plan's confidence is a calibration question for later, not this stage.
- **One dry run per command (PI-3, ISS8203 slice 2).** `attemptDryRun` grounds each position step in full (derived referents resolve through the environment) and seeds the executor with every grounded step. The environment is built once per command by `buildAttemptEnvironment`: the room graph, plus each candidate object's host graph from an eager, depth-capped ancestry walk, plus every shard a relation touching a candidate can cross into (`fetchRelationalReachability`, the walk chain-aware removal uses), so Expansion and the dry run can follow a crossing to its far end. Membership keeps its own sandbox environment until slice 3, where its take/drop gates become transfer preconditions.
- **Selection** is `selectPlanTuple`, which ranks by `getConfidence`. Calibrated ranking swaps in there without changing the stage's shape.
- **No `legal` candidate.** Every route's top `defer` goes once to the deferred adjudication tier ([`adjudicateDeferred`](commandAttempt/adjudicate.ts)), which judges nothing today, so it abstains. There is no complexity LLM on any route (ISS8203 slice 3). Containment's dry run is the shared executor run (`attemptDryRun`, PI-3), which grounds its `from` against the per-command environment and adds no boundary edges until slice 3. A look has no steps, so its dry run is trivially `legal`; Describe's confidence, with one referent, is that referent's own `jointRelevance`.
- **Consult wording** comes from the shared describer (`attemptCandidates.ts`, PI-2): one per desired-result kind, keeping the published strings, and passed to selection as `toConsultAlternative`. A Consult alternative needs only `proposedCommand`; `objectId` is optional and copied onto the wire only where a producer already sets it.

## `DeterministicTemplate` module (bare-word subset wired, 2026-07-20)

Vocabulary and design: [`AGENT.concepts.md`](./AGENT.concepts.md#deterministictemplate). This section is the module map.

- `dataSource/actions/deterministicTemplate/`:
  - `deterministicTemplate.ts` --- `DeterministicTemplate` interface, `PatternElement`, `IntentFieldRole`, `DeterministicTemplateMatch`, `DeterministicTemplateDeferReason` types.
  - `patternTemplate.ts` --- the two generic matching engines (`matchPatternAgainstString`/`matchPatternAgainstTokens`), the `assembleIntent` combinator, `synthesizeSkeletonFromPattern`, and both factories (`makePatternTemplate`, `makeDeferPatternTemplate`).
  - `bareWordTemplates.ts` --- 5 pure-data rows: `look`/`l` (bare only, deliberately no paraphrase lexicon --- see below), `help` (+ paraphrase lexicon), `home` (+ paraphrase lexicon), `predict` (bare only, no Sub-iteration 2 producer needed --- `WorldQuestion` already routes to `PredictHypothesis`), `wait`/`awaitRoadRunnerTemplate` (bare + paraphrase lexicon, new in Sub-iteration 2 --- `wait` had no pre-classify producer before).
  - `index.ts` --- the directory's real entry point (matches this codebase's no-barrel convention, cf. `discriminateIntent/index.ts`): `deterministicTemplateRegistry` (all 5 entries, ordered, first-match-wins, no relational entries) and `matchDeterministicTemplate(command)` (unchanged, still has no live-path caller); plus **`nonObjectManipulationTemplateRegistry`** (3 entries: `help`/`home`/`awaitRoadRunner`, excluding `look` and `predict`) and **`matchNonObjectManipulationTemplate(command)`** --- the live-path entry point, called from `parseCommand.ts`'s `Command` branch before `runParseStage`.
- **Wired (Sub-iteration 2, 2026-07-20):** the `help`/`home`/`awaitRoadRunner` subset only, via `matchNonObjectManipulationTemplate`. **Still not wired, each for its own reason:** `lookTemplate` --- `look`/`l` are always intercepted upstream by `deterministicChecks.ts` before classify ever runs (so a `Command`-routed input can never be bare `look` in the first place), and a review correction during this slice deliberately dropped its paraphrase lexicon (`peruse the room`, etc.) --- open-ended `look` paraphrases are free-form enough that a closed list isn't the right tool; that's LLM-fallback territory, not yet built. `predictTemplate` --- `PredictHypothesis` isn't one of the six families this registry closes the regression for. There is no relational entry: peer relations have no deterministic parse (the relational registry was deleted). And the *context-dependent* implementation kind (Navigation's exit resolution, `get`'s room-object-label gating) named in `deterministicTemplate.ts`'s own doc comment --- Sub-iteration 2 satisfied Navigation's underlying need with its own typed matcher ([`plan/matchNavigationParaphrase.ts`](plan/matchNavigationParaphrase.ts)) instead of widening the shared `DeterministicTemplate.matchString(command: string)` interface, since only one concrete case exists so far to generalize from.
- Relational rows share one minimal `templateIntent` constant, `{ type: 'ObjectRelateIntent', confidence: 1 }` (nothing downstream reads more than `type`/`confidence` off it); `makeDeferPatternTemplate` produces `defer` unconditionally on a structural match.
- Tests: `dataSource/actions/deterministicTemplate/*.test.ts` (extended for the paraphrase lexicons and the new registry/matcher in Sub-iteration 2).

### Navigation and AcmeOrder paraphrase matchers (Sub-iteration 2, iteration 7, 2026-07-20)

Two more command families reconnected alongside the `DeterministicTemplate` bare-word subset, each deliberately **not** a `DeterministicTemplate` entry (see rationale above and in [`AGENT.classifyPlanGeneralization.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.classifyPlanGeneralization.planning.md)):

- **`plan/matchNavigationParaphrase.ts`** --- extends today's `go <exit>`-only deterministic prefix (`discriminateIntent/deterministicChecks.ts`'s `maybeDeterministicNavigationResult`, unchanged) with `head`/`walk`/`move`/`travel`/`enter`, calling the existing `resolveExitLabelToTargetId` (`discriminateIntent/exitResolution.ts`, unchanged). Runs pre-Parse in `parseCommand.ts`'s `Command` branch, right after the `DeterministicTemplate` bare-word check. On a resolved exit, returns the same terminal `ParseCommandNavigationResult` shape the pre-classify fast path already produces. On a failed resolution with an explicit movement verb present, surfaces a specific `Error` via `navigationIntentErrorMessages` (reconnecting `exitResolution.ts`'s previously-orphaned messages and `index.ts`'s `parseErrorMessageForPlayer` `case` branches) --- unlike the bare/verbless fast path, which stays lenient and silent-on-miss.
- **`plan/matchAcmeOrderFamily.ts`** --- runs post-Parse, only when `planSkeleton` yields no attempt. Matches the skeleton's leading `text` token against `order`/`buy`/`purchase`, requires at least one following `objectSpan` token, extracts their span text as `rawOrders`, and calls `enrichAcmeOrder` (`enrich/acmeOrder/index.ts`, unchanged internals) directly --- resolving CPG-4: `enrichAcmeOrder`'s existing LLM call (trope/catalog affinity resolution) is this family's Synthesize step as-is, no new hook needed.

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

## Shelved: compound commands and cooperative actions

Not owned by any plan; deferred 2026-10-06.

- **A compound command is one attempt, not several.** `take the coins and put them in the pouch` is one intent, so one `CommandAttempt` with several Plan-sourced actions, committed all-or-nothing, and narrated by one narration unit covering both. Intent discrimination rejects it today ([`multipleCommandsPlayerMessage.ts`](multipleCommandsPlayerMessage.ts)). **Lifting that rejection needs sequential grounding**: a later action's derived referents (`currentHost(coins)`) must resolve against the state earlier actions leave, but the actions-side dry run builds one environment per command (`buildAttemptEnvironment`) and positions' [`commitAttempt`](../positions/manipulation/commitAttempt.ts) reads live hosts once per attempt, so both would resolve the second action's `from` to the table. A compound that mixes families ("take the coins and go north") spans routes only because navigation is not an attempt; the fix is navigation onto attempts, not a cross-route join.
- **Cooperation (two characters acting together) is the one case that truly spans attempts**: two commands, two commits. Deferred as a UI problem first. Narration units reference actions by minted id, so they do not preclude it, but delivering one line over two commits would need a join that substitutes default lines for whatever did commit; `messageOrchestration` bundles skip unresolved slots instead.

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
