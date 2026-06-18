# `mtw.ephemera.actions` - Implementation Guide

Detailed implementation playbook for parser affordances and related wiring in `mtw.ephemera.actions`.
For architecture and normative contract boundaries, see [`AGENT.md`](./AGENT.md).

---

## Adding a new command affordance

Use this checklist when adding a parse affordance (for example, `help`).

### 1) Extend parse result contracts

1. Add a new discriminant in [`baseClasses.ts`](baseClasses.ts) (`ParseCommandResult` variant + type guard).
2. Include the result in the appropriate unions (`IntentClassificationResult` in [`baseClasses.ts`](baseClasses.ts) and/or terminal `ParseCommandResult`) based on whether it is intent-discrimination-only or terminal parse output.
3. Keep confidence and shape requirements aligned with existing result variants.

### 2) Wire parse pipeline behavior

1. In [`parseCommand.ts`](parseCommand.ts), prefer deterministic short-circuit logic first when possible (no Bedrock call).
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
