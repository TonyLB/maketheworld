# mtw.ephemera.renderOrchestration (Transitional)

## Status

This module is a **transitional ingress adapter**.

It intentionally uses DataSource subscription shape for incoming events, but it is **not**
a full canonical DataSource implementation of render orchestration behavior.

## What it does today

- Subscribes to internal `api.ephemera` streaming envelopes:
  - `Render Requested`
  - `Render Preview Requested`
- Converts those ingress payloads into existing render-orchestration request payloads.
- Delegates to `renderOrchestration/orchestrationHandler.ts` (`orchestrateRenderRequest`).

## Transitional constraints (intentional)

- **Internal-only**: no EventBridge ingress/egress contract is defined here.
- **Non-replayable**: this adapter is created with `replayable: false`.
- **Ingress-focused**: no authoritative outbound event-stream contract is established by this module.
- **Side-effect heavy by design (for now)**: downstream behavior still uses existing conversation and messageBus side-effects in `renderOrchestration`.

## Non-precedent warning

Do not use this module as a template for "normal" DataSource work.

This shape exists to incrementally normalize ingress contracts while render orchestration is
still in migration. A canonical DataSource should define clear publish semantics and stable
domain-level update contracts; this module does not claim that status yet.

## Exit criteria for removing transitional status

Only drop the transitional label once all of the following are true:

1. Render orchestration publishes authoritative lifecycle/update events as first-class outputs.
2. Conversation-specific side effects are no longer the primary contract surface.
3. Event contracts for producers/consumers are stabilized and documented as durable.
4. The module can be cited as precedent without special caveats.

## Related docs

- `lambda/ephemera/renderOrchestration/AGENT.planning.md`
- `lambda/ephemera/renderOrchestration/AGENT.planning.simplification.md`
