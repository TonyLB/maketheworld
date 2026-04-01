# mtw.ephemera.renderOrchestration (evolving)

## Status

**Transitional** here means **on the path to** a canonical DataSource-shaped home for render orchestration --- not "stay as small as possible until deleted."

This package is the intended **long-term owner** of the `mtw.ephemera.renderOrchestration` data domain: subscription, ingress normalization, and (as contracts mature) orchestration behavior aligned with DataSource patterns. Today it still **delegates** heavy policy to `lambda/ephemera/renderOrchestration/` (`orchestrateRenderRequest`); moving that logic **into** this tree over time is an explicit option, not a violation of the plan.

**What is immature (not what "transitional" means):** replay policy, EventBridge surface, and authoritative outbound streaming contracts are not finished. Those gaps are why the module is not yet **graduated** --- not because domain logic must forever live elsewhere.

## What it does today

- Subscribes to internal `api.ephemera` streaming envelopes:
  - `Render Requested`
  - `Render Preview Requested`
- Converts those ingress payloads into existing render-orchestration request payloads.
- Delegates to `renderOrchestration/orchestrationHandler.ts` (`orchestrateRenderRequest`).

## Current constraints (until graduation)

- **Internal-only**: no EventBridge ingress/egress contract is defined yet.
- **Non-replayable**: `replayable: false` until replay semantics are defined.
- **Contract incomplete**: no authoritative outbound event-stream contract is established yet; conversation and messageBus side effects still flow through `renderOrchestration` for much of the pipeline.

These describe **readiness**, not a rule against growing this package.

## Copying this module elsewhere (warning)

Do **not** copy **today's** snapshot as a template for unrelated DataSource work without reading the **graduation** section below. The unfinished pieces (replay, publish semantics) are exactly what we are iterating on.

Conversely, **this directory is allowed to grow** into the canonical implementation of render orchestration as those pieces land --- the warning is about **blind copy-paste**, not about **choosing** to consolidate orchestration here.

## Graduation (dropping the transitional label)

Declare the module **graduated** when all of the following are true:

1. Render orchestration publishes authoritative lifecycle/update events as first-class outputs.
2. Conversation-specific side effects are no longer the primary contract surface.
3. Event contracts for producers/consumers are stabilized and documented as durable.
4. The module can be cited as precedent for similar DataSource domains without special caveats.

Until then, keep calling the status **transitional** in the sense of **evolving**, not **disposable edge adapter only**.

## Related docs

- `lambda/ephemera/renderOrchestration/AGENT.planning.md`
- `lambda/ephemera/renderOrchestration/AGENT.planning.simplification.md`
