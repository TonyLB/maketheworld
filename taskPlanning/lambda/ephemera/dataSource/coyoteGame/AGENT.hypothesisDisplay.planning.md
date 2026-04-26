# Coyote compact hypothesis: dedicated `DisplayProtocol`

**Status:** In progress. Compact hypothesis terminal payload filtering is now shipped (Scene Analysis excluded from terminal publish) with focused tests/comments; next step: durable **`coyoteGame/AGENT.md`** note, then final closeout.

Skim [`taskPlanning/AGENT.md`](../../../../../AGENT.md) once for durability expectations, what belongs in task plans vs durable package docs, and recommended-order checkbox conventions.

## Purpose

Route **compact** Coyote hypothesis rows (the **`Hypothesis: Generating...`** placeholder and the **terminal** `[walkthrough?, line break, intent]` publish) through a **new** `DisplayProtocol` so the **charcoal-client** can render them distinctly from generic **`WorldMessage`** narration.

**Out of scope for this task (unless explicitly pulled in):** The Coyote **engine test harness** (`runCoyoteEngineTestHarness`) continues to use **`WorldOOCMessage`** with verbose diagnostics; no change required there unless product asks for it.

## DisplayProtocol naming (aligned with existing literals)

Existing Coyote-specific protocol: **`CoyoteGameHelpMessage`** ([`packages/mtw-interfaces/ts/messages.ts`](../../../../../packages/mtw-interfaces/ts/messages.ts)).

**Chosen literal:** **`CoyoteGameHypothesisMessage`** --- same **PascalCase, no spaces, `Message` suffix** pattern as other `DisplayProtocol` values (`WorldMessage`, `WorldOOCMessage`, `PerceptionMessage`).

**Wire shape:** Same practical shape as **`WorldMessage`** / **`WorldOOCMessage`**: `Message` is a **`RenderTree`**, with optional **`messageId`** / **`createdTime`** on the bus so **`publishMessage`** can overwrite the same client row for placeholder then terminal ([`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.ts)). **`CoyoteGameHelpMessage`** intentionally omits `Message`; hypothesis rows **do** carry body content, so the new type mirrors **world-line** publishes, not the help shape.

## Relationship to existing code

| Area | Role |
| --- | --- |
| [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.ts) | Both **`PublishMessage`** sends today use **`displayProtocol: 'WorldMessage'`**; switch to **`CoyoteGameHypothesisMessage`**. |
| [`lambda/ephemera/messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts) | **`PublishCoyoteGameHypothesisMessage`** and **`isPublishCoyoteGameHypothesisMessage`** added; next slice: **`publishMessage`** ORs this guard with the world-line branch (or a dedicated branch). |
| [`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) | Queue path for world-line messages; extend so **`CoyoteGameHypothesisMessage`** maps to the same **`pushToQueues`** fields as **`WorldMessage`** (**`Message`**, **`MessageId`**, **`CreatedTime`**, **`DisplayProtocol`**). |
| [`packages/mtw-interfaces/ts/messages.ts`](../../../../../packages/mtw-interfaces/ts/messages.ts) | **`CoyoteGameHypothesisMessage`**, extended **`Message`** / **`isMessage`**. |
| [`charcoal-client/src/components/Message/index.tsx`](../../../../../charcoal-client/src/components/Message/index.tsx) | **`switch (DisplayProtocol)`** branch to a dedicated **`CoyoteGameHypothesisMessage`** component (see Recommended order). |
| [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) | After behavior ships, one-line note that compact hypothesis uses **`CoyoteGameHypothesisMessage`** (link from this plan until the task plan is retired). |

## Getting started

1. **Task planning framework** --- [`taskPlanning/AGENT.md`](../../../../../AGENT.md)
2. **Current publishes** --- [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.ts)
3. **Bus publish types and guards** --- [`lambda/ephemera/messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts) (see **`PublishWorldMessage`**, **`isPublishWorldLineMessage`**)
4. **Dynamo / queue serialization** --- [`lambda/ephemera/publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) (`isPublishWorldLineMessage` branch)
5. **Client routing** --- [`charcoal-client/src/components/Message/index.tsx`](../../../../../charcoal-client/src/components/Message/index.tsx) and [`WorldMessage.tsx`](../../../../../charcoal-client/src/components/Message/WorldMessage.tsx) (or thin wrapper component colocated under `Message/`)
6. **Ephemera tests touching DisplayProtocol** --- [`handleObjectsChangedForHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.test.ts), [`publishMessage/index.test.ts`](../../../../../lambda/ephemera/publishMessage/index.test.ts), [`packages/mtw-interfaces/ts/messages.test.ts`](../../../../../packages/mtw-interfaces/ts/messages.test.ts), [`packages/mtw-interfaces/ts/ephemera.test.ts`](../../../../../packages/mtw-interfaces/ts/ephemera.test.ts) if message validation is extended there

## Progress

| Area | State |
| --- | --- |
| `mtw-interfaces`: type + `Message` union + `isMessage` | Done |
| Ephemera `messageBus`: publish payload type + guards | Done |
| `publishMessage`: queue branch for new protocol | Done |
| `handleObjectsChangedForHypothesis` + unit tests | Done |
| `publishMessage` tests (if new branch) | Done |
| Charcoal `Message` switch (+ optional dedicated component) | Done |
| Compact hypothesis output excludes non-user-facing Scene Analysis details | Done |
| Durable `coyoteGame/AGENT.md` one-liner | |
| This task plan checkboxes + status | In progress |

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Mark nested lines `[X]` as you complete them.

- [X] **`@tonylb/mtw-interfaces`**: Add **`CoyoteGameHypothesisMessage`** type (**`DisplayProtocol: 'CoyoteGameHypothesisMessage'`**, **`Message: RenderTree`**, same addressing fields as **`WorldMessage`**), extend **`Message`** union, extend **`isMessage`** **`switch`** with **`RenderTree`** validation for **`Message`**.
  - [X] Add or extend **unit tests** in [`messages.test.ts`](../../../../../packages/mtw-interfaces/ts/messages.test.ts) (and **`ephemera.test.ts`** if full message envelopes are asserted there).
- [X] **`lambda/ephemera/messageBus`**: Add **`PublishCoyoteGameHypothesisMessage`** (mirror **`PublishWorldMessage`** fields: **`message`**, **`messageId?`**, **`createdTime?`**), add to **`PublishMessage`** union, add **`isPublishCoyoteGameHypothesisMessage`** (and update **`isPublishWorldLineMessage`** or **`publishMessage`** consumer explicitly --- pick one approach and keep guards readable).
- [X] **`lambda/ephemera/publishMessage`**: Handle the new payload in [`index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) with the same **`pushToQueues`** shape as world-line messages (**`Message`**, **`MessageId`**, **`CreatedTime`**, **`DisplayProtocol`**).
  - [X] Update [`publishMessage/index.test.ts`](../../../../../lambda/ephemera/publishMessage/index.test.ts) if fixtures assert **`DisplayProtocol`** lists.
- [X] **`charcoal-client`**: Add **`case 'CoyoteGameHypothesisMessage':`** in [`Message/index.tsx`](../../../../../charcoal-client/src/components/Message/index.tsx) that renders a **dedicated** component (for example colocated **`CoyoteGameHypothesisMessage.tsx`** under **`Message/`**), **not** a thin wrapper around **`WorldMessage`**. The component should reuse the same body pipeline as world-line rows where it makes sense (**`MessageComponent`**, **`RenderTreeContent`** on **`message.Message`**, similar typography) but with **distinct chrome**: **rounded corners** and a **middling dark grey** **`linear-gradient`** background so hypothesis rows read separately from generic narration.
  - [X] Add or adjust a **client test** in **`Message.test.tsx`** (or equivalent): route **`DisplayProtocol: 'CoyoteGameHypothesisMessage'`** through **`Message`** and assert the dedicated surface (for example presence of hypothesis copy and/or a stable **`data-testid`** on the new component root).
- [X] **`handleObjectsChangedForHypothesis`**: Set **`displayProtocol: 'CoyoteGameHypothesisMessage'`** for both the generating and terminal **`PublishMessage`** rows.
  - [X] Update [`handleObjectsChangedForHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.test.ts) expectations.
- [X] **Compact hypothesis payload filtering**: Ensure final compact hypothesis publish omits non-user-facing `Scene Analysis` content from prompt output.
  - [X] Update [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.ts) so terminal `renderTree` only includes user-facing intent/walkthrough content.
  - [X] Add/update focused assertions in [`handleObjectsChangedForHypothesis.test.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.test.ts) that `Scene Analysis` details are not delivered in the terminal publish.
  - [X] Add inline comments in [`handleObjectsChangedForHypothesis.ts`](../../../../../lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.ts) and [`internalCache/coyoteGame.ts`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) documenting that `walkthrough` currently maps prompt `Scene Analysis` prose and has drifted from its original "golden-path walkthrough" intent; semantic realignment is explicitly deferred to a later prompt + handling optimization pass.
- [ ] **Durable doc**: Short note in [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) under stream / bus or WorldMessage section.
- [ ] **Closeout**: Update **Progress** table and **Status** line in this file; run **Verification** commands.

## Verification

After implementation:

```bash
cd lambda/ephemera && npm test -- dataSource/coyoteGame/handleObjectsChangedForHypothesis.test.ts publishMessage/index.test.ts
```

```bash
cd packages/mtw-interfaces && npm test -- ts/messages.test.ts
```

If **`charcoal-client`** routing or a new component is added, run the **Vitest** (or package-default) suite for [`charcoal-client/src/components/Message/Message.test.tsx`](../../../../../charcoal-client/src/components/Message/Message.test.tsx) per [`charcoal-client/package.json`](../../../../../charcoal-client/package.json).

**Grep sanity (no stray old protocol on hypothesis path):**

```bash
rg "displayProtocol: 'WorldMessage'" lambda/ephemera/dataSource/coyoteGame/handleObjectsChangedForHypothesis.ts
# Expect: no matches after migration (file should use CoyoteGameHypothesisMessage only for these two publishes)
```

```bash
rg "CoyoteGameHypothesisMessage" --glob '*.{ts,tsx}'
# Expect: interfaces, ephemera bus, publishMessage, client Message switch, tests
```

## When this task finishes

Per [`taskPlanning/AGENT.md`](../../../../../AGENT.md): move lasting protocol documentation into [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md), then **delete or archive** this planning file so `taskPlanning/` stays current.
