# Parse command feedback (transcript + correlation)

**Status:** In progress  
**Next step:** **Ephemera actions** -- publish the command transcript row on parse request (see **Recommended order**). Transcript wire: **`CommandTranscriptMessage`** in [`packages/mtw-interfaces/ts/messages.ts`](../packages/mtw-interfaces/ts/messages.ts).

This document follows [`taskPlanning/AGENT.md`](AGENT.md) (durability, what belongs here vs in package docs, checkbox conventions, retire when done).

## Goals

1. **Transcript feedback:** The player sees their submitted command in the message list in a visually distinct way (e.g. monospace / bordered treatment) so the log reads as "here is what I entered."
2. **Optional promise correlation:** Support sending **`RequestId`** on command WebSocket messages so the client *can* use **`socketDispatchPromise`** (or similar) to know when the back-end round-trip finished---for example gating the command input until accept or timeout.

Non-goals for this task plan: changing the LLM parse pipeline itself; full product spec for input disabling (only enable the wire and hooks).

## Design decisions (record outcomes here as you go)

| Topic | Decision | Notes |
| --- | --- | --- |
| Where command text is sourced for the row | **Server `PublishMessage`** | Same stream spectators see; persists with the message log for later review. **`DisplayProtocol: 'CommandTranscriptMessage'`** ( **`CommandTranscriptMessage`** type): same wire as **`WorldMessage`** (`Message: RenderTree` + **`MessageAddressing`**). |
| Promise correlation | **`ReturnValue`** with **`messageType: 'Success'`** and top-level **`RequestId`** | Use once the client sends **`RequestId`** on the command. No separate **`messageType: 'Messages'`** envelope required for the promise; `socketDispatchPromise` matches **top-level** **`RequestId`** on the parsed lambda body. See [`charcoal-client/src/slices/lifeLine/index.api.ts`](../charcoal-client/src/slices/lifeLine/index.api.ts). |
| Success payload copy | **Machine-oriented only** | Human-readable command echo lives **only** on the published transcript row (not duplicated on **`Success.message`**). |

## Progress

| Area | Doc / owner | Notes |
| --- | --- | --- |
| Interfaces | `packages/mtw-interfaces` | **`CommandTranscriptMessage`** + `isMessage` / tests added. |
| Ephemera lambda | `lambda/ephemera` | `app.ts` already forwards **`RequestId`** into parse-request when present; actions DS sends Success when **`requestId`** set. |
| Client lifeLine | `charcoal-client` | Today command mode uses **`socketDispatch`** without **`RequestId`**; switch or parallel path for **`socketDispatchPromise`** as needed. |
| Client Message UI | `charcoal-client/src/components/Message` | New component + **`index.tsx`** router case. |

## Getting Started

Skim [`taskPlanning/AGENT.md`](AGENT.md) once for what belongs in this file versus durable `AGENT.md` next to code.

1. **Project foundations**
   - **[`AGENT.md`](../AGENT.md)** (root): repo navigation and the **Getting Started pattern** for complex tasks.
   - **[`charcoal-client/src/slices/lifeLine/AGENT.md`](../charcoal-client/src/slices/lifeLine/AGENT.md)**: WebSocket correlation, **`socketDispatchPromise`**, **`LifeLinePubSub`**.

2. **Current wire behavior (integration points)**
   - Client dispatch: [`parseCommand` in `charcoal-client/src/slices/lifeLine/index.api.ts`](../charcoal-client/src/slices/lifeLine/index.api.ts) (command mode uses **`socketDispatch`**).
   - Lambda entry: [`lambda/ephemera/app.ts`](../lambda/ephemera/app.ts) **`isCommandAPIMessage`** and **`sendParseRequested`**.
   - Parse handling + Success **`ReturnValue`**: [`lambda/ephemera/dataSource/actions/index.ts`](../lambda/ephemera/dataSource/actions/index.ts) **`ephemeraActionsDataSource.receiveEvents`**.
   - Message routing: [`charcoal-client/src/components/Message/index.tsx`](../charcoal-client/src/components/Message/index.tsx).

3. **Patterns to copy**
   - World line styling reference: [`WorldOOCMessage.tsx`](../charcoal-client/src/components/Message/WorldOOCMessage.tsx) (adjust for command echo---distinct protocol or variant).
   - Actions tests: [`lambda/ephemera/dataSource/actions/index.test.ts`](../lambda/ephemera/dataSource/actions/index.test.ts) (Parse Requested, Success **`ReturnValue`** expectations).

4. **Testing commands (authority: package docs)**
   - Client: [`charcoal-client/AGENT.testing.md`](../charcoal-client/AGENT.testing.md) --- Vitest; from **`charcoal-client/`**, `npm run test:single` for scoped runs.
   - Ephemera lambda: Jest; from **`lambda/ephemera/`**, `npm test` (see that package's `package.json`).

5. **Identify next task**
   - Use **Recommended order** below; pending lines use `[ ]`, completed use `[X]`. Update this document when a slice merges.

6. **Baseline before edits**
   - Run at least one verification command from **Verification** in the package you will touch first; confirm green.

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. If a step has nested bullets, mark each nested line `[X]` as it is done so partial progress is visible.

- [X] **Echo strategy:** server **`PublishMessage`** (spectators + persisted log); documented in **Design decisions** above.
- [X] **`mtw-interfaces`:** Add transcript wire shape (new **`DisplayProtocol`** and **`Message`** variant, or documented reuse of an existing protocol if acceptable). Update **`isMessage`** / [`messages.ts`](../packages/mtw-interfaces/ts/messages.ts) tests.
- [ ] **Ephemera actions:** Publish the transcript echo line when a parse is requested; keep **`ReturnValue`** **`Success`** correlated when **`requestId`** is present; keep **`Success.message`** machine-oriented (human copy only on the published row). Update [`index.test.ts`](../lambda/ephemera/dataSource/actions/index.test.ts).
- [ ] **Publish / perception path:** Confirm whatever **`publishMessage`** / queue path is required for the new row reaches the client **`messageType: 'Messages'`** pipeline (no orphan types).
- [ ] **Client lifeLine:** Send **`RequestId`** on outbound command when using promise-based dispatch; keep fire-and-forget option clear if both modes exist. Add or extend tests (e.g. [`socketDispatchConversation.test.ts`](../charcoal-client/src/slices/lifeLine/socketDispatchConversation.test.ts) patterns / lifeLine tests).
- [ ] **Client UI:** New message component (monospace / border per design), register in [`Message/index.tsx`](../charcoal-client/src/components/Message/index.tsx); component tests under **`charcoal-client`** Vitest rules.
- [ ] **Optional UX:** Wire **`socketDispatchPromise`** (or timeout) from **`MessagePanel`** / **`LineEntry`** to disable or throttle command input---only after correlation is proven stable.
- [ ] **Verification:** Run **Verification** commands; update **Progress** and **Recommended order** checkboxes.
- [ ] **Closure:** Move any lasting protocol notes into the relevant **`AGENT.md`** or interface package docs; delete or archive this file per [`taskPlanning/AGENT.md`](AGENT.md).

## Verification

Run from repo root or the listed working directory.

**Interfaces (before/after type changes):**

```bash
cd packages/mtw-interfaces && npm test
```

**Ephemera lambda (actions + app integration via existing suites):**

```bash
cd lambda/ephemera && npm test -- --testPathPattern=dataSource/actions
```

**Charcoal client (Message + lifeLine when touched):**

```bash
cd charcoal-client && npm run test:single -- src/components/Message src/slices/lifeLine
```

If commands conflict with a package **`AGENT.testing.md`**, follow that package doc.

## When this task finishes

Per [`taskPlanning/AGENT.md`](AGENT.md): migrate durable content out of this file, then remove or archive **`taskPlanning/AGENT.parseCommandFeedback.planning.md`**.
