# mtw.ephemera.coyoteGame

**Status:** Bus-only, non-replayable `EphemeraDataSource`. Subscribes to **`mtw.ephemera.objects`** **`Objects Changed`** (same envelope as [`../objects/events.ts`](../objects/events.ts)).

**Behavior (v1):** When the event adds at least one object (`add.length > 0`) and the room is a Coyote Game demo room ([`internalCache.CoyoteGame`](../../internalCache/coyoteGame.ts) short names, matched as `ROOM#${name}`), the handler:

1. Queues the placeholder **`WorldMessage`** (`Hypothesis: Generating...`) on a synthesized **`hypothesisLane:${messageId}`** so it can be drained separately from the default lane (see [`messageBus/AGENT.md`](../../messageBus/AGENT.md) **Virtual lanes**).
2. Runs **`Promise.all([messageBus.flush(hypothesisLane), remainder])`**: **`flush`** drives **`publishMessage`** for the placeholder while **`remainder`** runs **`streamEvent`** (`Hypothesis Generation Started`), [`generateHypothesis`](generateHypothesis.ts), **`streamEvent`** (`Hypothesis Generation Result`), and the terminal **`WorldMessage`** (same **`messageId`**, later **`createdTime`** via [`publishMessage`](../../publishMessage/index.ts) overrides). Logical order is **`CreatedTime`**-based on the wire.

Targets are **active** occupants (`RoomCharacterList` entries with non-empty **`SessionIds`**). Stream payload **`characterId`** uses the first such occupant as a correlation anchor until object rows carry an actor.

**Product / demo context:** [`AGENT.CoyoteGame.implementation.md`](../../../../AGENT.CoyoteGame.implementation.md).

**Verification:** `cd lambda/ephemera && npx jest dataSource/coyoteGame/`
