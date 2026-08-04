# mtw.ephemera.players

**Status:** Shipped 2026-08-04. Bus-only, non-replayable, subscribe-only `EphemeraDataSource` --- no publish side at all (`PlayersPublishedPayload` is a placeholder `{ type: 'Players noop' }` never emitted).

## What it does

Subscribes to `mtw.players` / `Player Connected` EventBridge events (published from [`lambda/authentication/connect.ts`](../../../authentication/connect.ts) via `publishStreamEvent` + `PlayersEventSerializer`, [`packages/mtw-interfaces/ts/eventBridge/players/`](../../../../packages/mtw-interfaces/ts/eventBridge/players/index.ts)) and, per event, calls [`confirmGuestCharacter`](../../guestCharacter/AGENT.md). That is the entire mechanism --- see `guestCharacter/AGENT.md` for what `confirmGuestCharacter` actually does.

`isPlayersPlayerConnectedEnvelope` ([`subscribedEvents.ts`](subscribedEvents.ts)) is a plain header guard (`dataSourceKey === 'mtw.players' && type === 'Player Connected'`), registered in [`app.ts`](../../app.ts)'s `eventDeserializers` map alongside every other EventBridge source this lambda handles.

## Why this exists as its own DataSource

`mtw.players` used to reach the lambda through a legacy `switch` statement below the generic EventBridge intake block, and was effectively unreachable dead code: the intake block returns early (publishing an error) for any `event.source` without an `eventDeserializers` entry, and `mtw.players` had none. Migrating it onto the DataSource framework --- rather than special-casing it in the legacy block --- was the fix, and is the pattern for any future EventBridge source: **register a serializer in `eventDeserializers`**, not a new legacy-block branch. `app.ts` itself documents this at the intake block.

## Noise control

`receiveEvents` fires for every streaming event on the bus (the bus-level structure guard is payload-agnostic), so `events` is often empty --- filtered out by the envelope guard rather than genuinely absent. It returns before logging in that case; logging `eventCount: 0` on every unrelated bus event was pure noise during development.
