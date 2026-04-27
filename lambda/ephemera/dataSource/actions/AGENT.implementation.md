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

1. In [`index.ts`](index.ts), branch on the new affordance guard.
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

---

## Affordance design notes

### `PromptInjectionAttempt` steady-state

Discriminate intent returns JSON `type: 'PromptInjectionAttempt'` when the intent prompt section P (evaluated before sections A-D in [`discriminateIntent/buildIntentClassificationPrompt.ts`](discriminateIntent/buildIntentClassificationPrompt.ts)) labels parser-manipulation tone.
`parseCommand` skips Acme order enrich like `Unknown`, and [`index.ts`](index.ts) emits `WorldOOCMessage` only (no `streamEvent` / `publishedEvents` entry), since this is in-franchise player feedback rather than a security boundary.

### `LookRoom` as reference pattern

`LookRoom` is the preferred cross-DataSource pattern for affordances that need render/perception ordering:

1. actions publishes `Look Command Requested`
2. `mtw.ephemera.renderOrchestration` subscribes
3. orchestration registers `roomDescription` perception thread, flushes the same run-scoped lane, then sends default-lane `Render Requested`

This preserves perception-thread ordering before downstream render behavior (`Render Pertains` to terminal `PerceptionMessage`).

---

## Acme `stableKey` implementation notes

This section complements the normative contract in [`AGENT.md`](./AGENT.md).

### Two phases (required order)

1. **LLM-first (Acme order enrich):** [`buildPrompt.ts`](enrich/acmeOrder/buildPrompt.ts) provides occupied key context and model proposes candidate `stableKey` values per valid line.
2. **Deterministic finalize (contract boundary):** [`finalizeStableKeysDeterministic`](stableKey/finalizeStableKeysDeterministic.ts) validates and repairs collisions/invalid proposals with deterministic allocation rules before publish.

### Where enforcement runs

In [`index.ts`](index.ts), Acme order flow is:

1. [`collectCoyoteOccupiedStableKeys`](stableKey/collectCoyoteOccupiedStableKeys.ts) builds occupancy snapshot from Coyote game rooms and room objects.
2. `parseCommand({ command, occupiedStableKeys })` reuses that snapshot in Acme order enrich.
3. `finalizeStableKeysDeterministic` assigns final `stableKey: string` values per valid line.
4. actions publishes `Acme Order`, then objects persists pass-through keys in current room context.

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
