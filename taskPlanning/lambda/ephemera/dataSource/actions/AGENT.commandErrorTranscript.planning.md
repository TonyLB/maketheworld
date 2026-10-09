# Command errors on the transcript bubble

**Status:** Drafted 2026-10-09, CE-1..CE-5 decided, not started. Follows the shipped persistent-command row (rules in [`actions/AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.contract.md) "Persistent command"; leftovers in [`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.implementation.md) "Shelved: asking the player").

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

When a command fails, Abstains, or needs a question, the player gets a separate grey `WorldOOCMessage` line, detached from the command that caused it. Instead, the outcome should appear **on the command's own `CommandTranscriptMessage` bubble**, by republishing that bubble under its original `MessageId` with the outcome added. The client already supports this: `history` keeps every revision per `MessageId`, and `presentation` shows one bubble per id at its earliest `CreatedTime` with the latest revision's body. The publish payload already accepts `messageId` and `createdTime`. What is missing is (a) the id being known to the handler, (b) a wire field for the outcome, (c) client rendering, (d) moving the ~17 OOC call sites onto one helper, and (e) the id surviving across handler calls, which only matters once something resumes a stored row.

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Wire types: `CommandTranscriptMessage` in [`packages/mtw-interfaces/ts/messages.ts`](../../../../../packages/mtw-interfaces/ts/messages.ts) and its guard (~line 386); `PublishCommandTranscriptMessage` in [`lambda/ephemera/messageBus/baseClasses.ts`](../../../../../lambda/ephemera/messageBus/baseClasses.ts).
3. Publisher: the `isPublishCommandTranscriptMessage` branch of [`publishMessage/index.ts`](../../../../../lambda/ephemera/publishMessage/index.ts) (`messageId ?? uuid`; delta row keyed `${CreatedTime}::${MessageId}`).
4. Emit sites: `handleParseRequested`, `respondImperativelyForIntent` and `publishStreamEventsForIntent` in [`actions/index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts); `ResponseContext` is the type threaded through them.
5. Client: revision handling in [`charcoal-client/src/slices/messages/index.ts`](../../../../../charcoal-client/src/slices/messages/index.ts) (`mergeMessageIdAggregate`, `toPresentationRow`); the latest-echo-per-session filter in `getMessagesByRoom` ([`selectors.ts`](../../../../../charcoal-client/src/slices/messages/selectors.ts)); [`CommandTranscriptMessage.tsx`](../../../../../charcoal-client/src/components/Message/CommandTranscriptMessage.tsx) and [`components/Message/AGENT.md`](../../../../../charcoal-client/src/components/Message/AGENT.md).
6. Row payload: [`persistentCommand/payload.ts`](../../../../../lambda/ephemera/dataSource/actions/persistentCommand/payload.ts).
7. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md), [`charcoal-client/AGENT.testing.md`](../../../../../charcoal-client/AGENT.testing.md). Remember ts-jest/vitest are transpile-only and `*.integration.test.ts` sits outside tsconfig: run full suites after the type change.
8. Baseline:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/actions/index publishMessage/
cd ../../charcoal-client && npx vitest run src/slices/messages src/components/Message
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s). When a decision ships, record it in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| CE-1 | **Wire field shape.** Recommend an optional `Outcome?: { Kind: 'Error' \| 'Info'; Message: RenderTree }` on `CommandTranscriptMessage` (not `ErrorMessage`), so Consult/Abstain and later questions reuse it. The latest revision replaces the whole body, so a revision resends `Message` (the echo) too. | 1 | Decided 2026-10-09 (as recommended) |
| CE-2 | **Which OOC lines move.** Recommend: every line that answers *a parsed command* (error, consult, abstain, unknown, unimplemented, injection, multiple-commands, not-in-room, impossible, harness-disabled, stream-event failures). Stay `WorldOOCMessage`: anything with no originating command (system notices). | 2 | Decided 2026-10-09 (as recommended) |
| CE-3 | **Where the id lives.** Now: minted in `handleParseRequested`, carried on `ResponseContext` (`transcript: { messageId, createdTime, command }`). Later: `transcriptMessageId`, `createdTime` and the command text beside `root` in the row payload, not inside it (they describe this attempt, not Plan's output). | 2 (context), 4 (row) | Decided 2026-10-09 (as recommended) |
| CE-4 | **No echo case.** `handleParseRequested` returns early for non-character ids, and the client shows only the latest echo per `SessionId`. When there is no `sessionId`, or no echo to attach to, the helper falls back to the old `WorldOOCMessage`. Confirm. | 2 | Decided 2026-10-09: fallback confirmed; expected to be rare |
| CE-5 | **Resume after the echo scrolled away.** A late revision updates a bubble far up the log. Late revisions update the bubble in place. | 4 | Decided 2026-10-09: accepted, and intended: a late revision updates the bubble wherever it sits in the log |

## Recommended order

Use `[ ]` for pending and `[X]` for complete.

- [ ] **Slice 1: wire type and client rendering.** Add `Outcome` (CE-1) to `CommandTranscriptMessage`, its guard in `messages.ts`, and the publish payload type. Plumb it through `publishMessage` (`Outcome` onto the pushed row). Render it inside the bubble (error styling, below the monospace echo). Tests: `messages.test.ts` guard cases, `publishMessage/index.test.ts`, `Message.test.tsx`, plus a `slices/messages` test that a second revision of one `MessageId` replaces the body and keeps the earliest position.
- [ ] **Slice 2: mint, carry, one helper.** In `handleParseRequested`, mint `messageId` and `createdTime` and publish the echo with them. Add `transcript` to `ResponseContext` (CE-3). Add one `reportCommandOutcome(context, kind, lines)` helper that republishes the echo with `Outcome` (resending `Message`), falling back to `WorldOOCMessage` per CE-4. Convert the 17 `WorldOOCMessage` sites (CE-2) in one pass; grep afterwards that the only remaining `WorldOOCMessage` publishes are the fallback and non-command notices. Update `actions/index.test.ts` expectations.
- [ ] **Slice 3: harnesses.** `runCoyoteEngineTestHarness` and `runAcmeOrderAffinitiesHarness` publish through `messageBus` directly; decide whether they take the helper or stay OOC (they are test harnesses, so likely stay, with the reason recorded).
- [ ] **Slice 4: id in the stored row.** Add optional `transcript` (`messageId`, `createdTime`, `command`) to `PersistentCommandPayload` and its guard (absent in old rows = still valid). Resume reads it and passes it into the helper, so a resumed command's `Error` lands on the original bubble. Extend `resume.test.ts` and the cross-registry `payoff` tests. Defer if nothing starts a resume yet; the field is cheap to reserve (pre-rollout, no migration cost).
- [ ] **Close-out.** Contract rules to `lambda/ephemera/dataSource/actions/AGENT.contract.md` (outcomes ride the command's own bubble; a revision resends the whole body; fallback rule), `charcoal-client/src/components/Message/AGENT.md`, `packages/mtw-interfaces/AGENT.md`; update the "stale-error copy" and "OOC publish" lines in `AGENT.implementation.md` "Shelved"; graduation sweep (grep inbound links), then delete this plan.

## Risks

- **Whole-body revisions.** A revision does not merge; every republish must resend the echo text. Hence `command` in the context and, later, the row.
- **Type change fan-out.** `Message` is a union used across client and lambdas; run the full suites, not just touched files.
- **Ordering.** Publish batches assign `CreatedTime` by index; the revision must reuse the minted `createdTime` or it will sort as a new bubble in the aggregate's `latestCreatedTime` only, which is fine, but the *echo's* position must come from the first publish.

## Verification

- Per slice: the two baseline commands above, then full `lambda/ephemera` and `charcoal-client` suites at the end of Slice 1 and Slice 2.
- Slice 2 sweep: `grep -n "WorldOOCMessage" lambda/ephemera/dataSource/actions/index.ts` lists only the helper's fallback.
- Manual: submit a nonsense command and a stale-referent command in dev; one bubble, outcome inside it, no grey line.
