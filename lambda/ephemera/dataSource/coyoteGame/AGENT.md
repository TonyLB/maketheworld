# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`.

**Subscribes to**

- **`mtw.ephemera.objects`** **`Objects Changed`** ([`../objects/events.ts`](../objects/events.ts)).
- **`mtw.ephemera.actions`** **`Await RoadRunner`** (same envelope guard as [`../objects/subscribedEvents.ts`](../objects/subscribedEvents.ts) **`isEphemeraActionsAwaitRoadRunnerEnvelope`**).

## Objects Changed (hypothesis path)

When the event adds at least one object (`add.length > 0`) and the room is a Coyote Game demo room ([`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts); ids via [`RoomKey`](../../../../packages/mtw-utilities/ts/types.ts)), the handler:

1. Queues the placeholder **`WorldMessage`** (`Hypothesis: Generating...`) on **`hypothesisLane:${messageId}`** (see [`messageBus/AGENT.md`](../../messageBus/AGENT.md) **Virtual lanes**).
2. Runs **`Promise.all([messageBus.flush(hypothesisLane), remainder])`**: **`remainder`** emits hypothesis **`streamEvent`** payloads ([`publishedEvents.ts`](publishedEvents.ts)), [`generateHypothesis`](generateHypothesis.ts), and the terminal **`WorldMessage`**.

Targets: **active** occupants of that room. Stream **`characterId`**: first active occupant.

## Await RoadRunner (plan outcome path)

On **`Await RoadRunner`** from actions, the handler targets **all active characters across all Coyote demo rooms** ([`collectActiveCharactersInCoyoteRooms`](collectActiveCharactersInCoyoteRooms.ts)), queues **`Outcome: Generating...`** on **`outcomeLane:${messageId}`**, then the same **`flush` + `remainder`** pattern with **`Plan Outcome Generation Started` / `Result`** stream events (**`streamKey`** = triggering **`characterId`** from the actions payload). The **`remainder`** path calls **`internalCache.CoyoteGame.invalidate('outcome')`** then **`internalCache.CoyoteGame.get('outcome')`**: the last outcome is stored durably (same pattern as **`intent`** on [`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts)). The generator is [`generatePlanOutcome`](generatePlanOutcome.ts): a **single Bedrock call** (first draft) using [`buildPlanOutcomePrompt`](buildPlanOutcomePrompt.ts) over staged objects ([`loadCoyoteRoomObjectsByRoom`](coyoteRoomObjectSnapshot.ts)) plus the current hypothesis line from **`get('intent')`**. Prompt rules require the Road Runner to remain safe and the setback to land on the Coyote where possible; multi-stage refinement is future work.

**Product / demo context:** [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

**Verification:** `cd lambda/ephemera && npx jest dataSource/coyoteGame/`
