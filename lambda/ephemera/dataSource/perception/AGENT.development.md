# Developing `mtw.ephemera.perception` (notes and follow-on direction)

Use this file for **how to work in this tree** and for **durable design intent** that outlives episodic task plans. It does **not** replace [`AGENT.md`](AGENT.md) (steady-state behavior, **delivery paths**, **plan assumptions**, **policy**, **normative decisions**, **obligations**, **verification**).

**Operational routing** (who uses fan-in vs **`perceptionMessage`**) lives **only** in [`AGENT.md`](AGENT.md#delivery-paths-correlated-vs-imperative). This file records **rationale** and **possible next models** (default publish, particularizing registration), not a second copy of that map.

## Canonical documentation

- **[`AGENT.md`](AGENT.md)** --- Data domain, **[Delivery paths (correlated vs imperative)](AGENT.md#delivery-paths-correlated-vs-imperative)**, wiring, **plan assumptions**, **implementation stance**, **imperative `perceptionMessage` baseline (v1)**, **correlated room description** policy, **routing identity**, **terminal dedupe**, **obligations** table, **related links**, **verification** commands.
- **[`taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md)** --- Pass-through semantics perception consumes (draft; refine alongside implementation).
- **[`lambda/ephemera/internalCache/AGENT.md`](../../internalCache/AGENT.md)** --- `PerceptionThreads` placement and lifecycle (`clear()` only).

## Commands (run from `lambda/ephemera/`)

See also the **Verification** table in [`AGENT.md`](AGENT.md#verification) (patterns package, full suite expectations).

```bash
cd lambda/ephemera

# Full ephemera suite (preferred before merge when touching shared behavior)
npm test

# This DataSource and nearby unit tests
npx jest dataSource/perception/
npx jest internalCache/perceptionThreads.test.ts

# Imperative handler bridge (Character path, legacy `perceptionMessage`)
npx jest perception/index.test.ts

# Feature / Knowledge correlated pipeline (orchestration + perception + ingress)
npx jest dataSource/perception/orchestrate.featureKnowledgeStreams.test.ts
npx jest dataSource/renderOrchestration/handleLookCommandRequestedForRenderOrchestration.test.ts
npx jest dataSource/renderOrchestration/prepareFeatureKnowledgeRenderForCharacter.test.ts
npx jest dataSource/passThroughOrchestrationToCache.integration.test.ts
npx jest dataSource/actions/index.test.ts
npx jest parse/executeAction.test.ts
npx jest app.test.ts
```

## First pass vs follow-on design (why this section exists)

The **first-pass** migration deliberately uses **explicit** [`Perception Thread Registered`](subscribedEvents.ts) rows so stream events (`Render Pertains`, `Generation Started`, etc.) can be **correlated** to **pre-declared** audience intent. That is a workable stepping stone off legacy [`perceptionMessage`](../../perception/index.ts), but it can feel like **imperative registration before every kick** rather than a fully **reactive** interpretation of the bubbling render/cache layer.

This document records a **second-iteration direction** we may move toward **after** the first pass stabilizes. Nothing below is a commitment to implement immediately; it exists so we do not lose the product and architecture rationale as perception evolves beyond explicit registration.

---

## Product premise (header sync)

The **room header** in the client is meant to track, for the **current room**, the **freshest current summary** of that room from each viewer's perspective. That is a **near-real-time sync surface**, not a one-shot notification. Much legacy behavior grew as **ad hoc** reactions to that requirement.

Making that premise **explicit** helps justify a **default delivery path** tied to **stream truth** (when the cache/orchestration stack says a render **pertains** to a room and perspective), rather than requiring every producer to **opt in** via registration.

## Follow-on concept: default publish + particularizing registration

### Default publish (no registration)

**Idea:** When a relevant perception-facing signal arrives (for example **`Render Pertains`** for a room) and **no** particularizing pattern has been registered for that signal's routing identity, perception still applies a **documented default**: deliver the **header** update implied by that render to **all characters currently present in the room who share that `perspectiveKey`** (or an equivalent rule we nail down in implementation).

- Cascades that only need **passive** header freshness could **omit** thread registration entirely.
- The system stays **responsive** to a chaotic underlayer of cache and orchestration events without every path closing a bespoke registration loop first.

### Particularizing registration (overlay or specialization)

**Idea:** Registering a thread becomes **not** "turn on handling for this event," but **"for these targets, handle inputs in a specific way instead of or in addition to the default."**

Example (illustrative): A **room description** registration before kicking a render means: when **`Render Pertains`** fires, perception performs the **default** header refresh for the perspective group **and** sends a **full room description** `PublishMessage` to the **registered** character (including placeholder / terminal correlation rules already explored in the first pass).

### Relationship to today's code

Today, [`orchestrate.ts`](orchestrate.ts) largely **lists** `PerceptionThreads` for `(componentId, perspectiveKey)` and **skips** work when the bucket is empty. A default-publish iteration would **invert** part of that: **always** consider default header behavior on agreed signals, and **add** registered overlays where rows exist.

## Design questions to resolve before or during implementation

These are intentional gaps, not bugs in this doc.

- **Placeholders:** Does the default path include **Generating** semantics and `messageId` overwrite, or is default **terminal-only** while placeholders remain **registration-gated**?
- **Dedupe and ordering:** Default handling multiplies subscriber-side responsibility for **uncertainty 6**-style collapse (no duplicate terminal header finals, sane behavior under retries). See the **Obligations** table in [`AGENT.md`](AGENT.md#obligations-accruing-to-future-perception-working-list).
- **Single implementation of audience:** Default header delivery must **reuse** the same "who is in the room with this perspective" logic as [`kickRoomHeaderBroadcast.ts`](kickRoomHeaderBroadcast.ts) / passive fan-out helpers --- avoid forking audience resolution.
- **Which signals drive default:** Starting with **terminal `Render Pertains` only** is a plausible narrow MVP; expanding to **`Generation Started`** changes placeholder and lane stories.
- **Pass-through contract:** Default publish must stay aligned with [`AGENT.passThrough.contract.planning.md`](../../../../taskPlanning/lambda/ephemera/dataSource/AGENT.passThrough.contract.planning.md) as it hardens (`Render Pertains` vs `Cache Updated` audiences, etc.).

## When to edit this file

- After **agreed** changes to the follow-on model (keep [`AGENT.md`](AGENT.md) as the steady-state anchor for **current** behavior and delivery paths).
- When correlated vs imperative **routing** in code changes, update [`AGENT.md`](AGENT.md#delivery-paths-correlated-vs-imperative) first; update this file only if the change affects **design direction** or questions listed here.
