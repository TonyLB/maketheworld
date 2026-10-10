# `mtw.ephemera.actions` --- object manipulation pipeline contract

This file records **contracts** only. Mental models: [`AGENT.concepts.md`](./AGENT.concepts.md). Code map: [`AGENT.implementation.md`](./AGENT.implementation.md). The Acme `stableKey` contract still lives in [`AGENT.md`](./AGENT.md#acme-catalog-lines-and-stablekey-normative-contract).

---

## Grounding

- **Grounding is total.** It **must** be handed a complete `ReferentAssignment`. A referent with no `groundedId` and no entry in the namespace it needs **must** throw, as a construction bug; callers **must not** branch on it as a runtime outcome. (A derived referent the world cannot resolve is the assignment builder's to report, before Grounding runs.)
- **Enumerate owns the joint candidate space.** The product across an attempt's referents **must** be formed before Grounding, and a relation joining an object to itself **must** be dropped there. Grounding and Validation never see one.

## Plan

- **Plan's output is a set of ungrounded attempts, and every fallback emits that same type.** Plan never reads world state: its attempts carry no ids. Every fallback (identity-only, plan-only and joint) takes or proposes attempts, not families, so one producer handles them all.

## Validation

- **Validation never grows a candidate.** It checks a complete grounded candidate against what the world forbids, and **must not** re-check what Expansion just built.

## Command attempt

- **The result is derived, never stored.** An attempt's `result` (`pending` / `succeeded` / `impossible`) **must** be computed from its challenges' verdicts, and recording a verdict (`recordVerdict`, pure, addressed by challenge id) **must** be the only way it changes.
- **One impossible challenge refuses the whole attempt**, regardless of any other challenge's state.
- **A challenge propagates nothing.** What a met verdict permits is its own action's desired result; no verdict may widen another action.
- **Adjudicate runs actions-side, per candidate, before the dry run.** Verdicts **must** ride the published attempt. Positions honors them at commit and never judges --- that half of the rule is [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md)'s (the `attempt` paragraph under the `mtw.ephemera.actions` ingress).
- **Every `transferMembership` carries its own preconditions and boundary expansion, whatever template produced it.** A transfer's moved object must sit in exactly one host, its `from` must be that host, and `from` must differ from `to`; a failed precondition is illegal, never a defer. Expansion adds the boundary dissolves and the exit-contact challenge from the object's source host, for take, drop and containment alike (ISS8203 slice 3).
- **Whoever creates an action authors the narration unit over it.** Plan's templates author units over the actions they build, Expansion over each facilitating action it adds; positions **must not** author or synthesize one (its half of the rule is [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md#positions-derives-no-narration-copy)). An action no unit covers narrates nothing.
- **A unit covers actions by minted id, never by position**, and its variants carry **unfilled** parts: the actor and every referent are slots, filled at delivery, since an author upstream of commit cannot know display names.
- **A deterministic template narrates only from closed sets.** It conjugates the verb from its own closed verb map, keyed by the verbs it matches, and writes the closed phrase it matched (`into`, `on top of`), never the raw text of the command. Open verbs and manner belong to the LLM Plan fallback, which writes its own line.
- **Expansion words a facilitating dissolve from the moved end**, not from edge direction ("frees the rope from the post", whichever end the edge names first), with one audience over both ends, *before* the dissolve.
- **Every copy of an attempt carries its narration units.** A stage that rebuilds an attempt (Grounding, Expansion, adjudication) must pass them through, adding its own after Plan's.
- **Defer has one meaning: a challenge left pending.** A route may not add a defer reason of its own (a complexity LLM, an exit-edge flag). The deferred adjudication tier is the only place a pending challenge is judged, and until it has a judge the candidate abstains.

## Persistent command

- **One row per character per session, holding one pending command.** The key is `CHARACTER#<characterId>` / `SESSION#<sessionId>`; a new command either answers the pending one or replaces it. A session's rows are deleted on `Session Disconnect`, found by a query on the session, never from the event's `characterIds`. Every write sets `deleteAt`, and a read **must** treat a row past its `deleteAt` as absent (DynamoDB may keep it for up to about 48 hours).
- **The row stores plain data and no world fact.** It holds the frozen root (Plan's ungrounded attempts, the stamped skeleton, the classify confidence), `selectedAttempt` (the primary action's Plan-minted id), `referentAnswers` (`stableRefKey` to thing id) and `challengeAnswers` (structural challenge id to `{ verdict, source: 'player' | 'process', askedAs? }`). It **must not** store a grounding, a catalog or any pipeline state. A row that fails the payload guard is absent, never an error.
- **A resume restarts at `compileAttemptsFromSkeleton`.** It **must not** rerun classify, Parse or Plan, and it reads the character, room and catalogs fresh. Referent answers narrow the answered span's freshly built pool; a challenge answer is recorded as that challenge's verdict directly; a stored key the rerun does not regenerate is ignored.
- **A stale answer refuses.** A chosen attempt no longer among the frozen attempts, or a chosen thing no longer in its pool, returns `Error` with the reason on every route. A resume **must not** act on a stale id.
- **An open question lives in `pending`.** `pending.options` maps fresh per-question `optionId`s to `referentAnswers`; `pending.answer` is set when one is chosen. The `optionId`s are the nonce (every Select revision shares the bubble's `messageId`, so `messageId` cannot tell questions apart). A typed command's `put` overwrites the row, replacing any open question.
- **An answer is a conditional update in place.** The reducer sets `pending.answer` only when the option exists, the question is unanswered and the row is unexpired, and the write is conditional on `pending` being unchanged, so of two racing answers (or an answer racing a new question) at most one wins. The winner resumes from the pre-answer row with the option's answers merged in. A terminal result leaves the answered row to its TTL.
- **A duplicate answer is a silent no-op.** The first answer's outcome owns the bubble, and an `Error` there would overwrite it.
- **A stale answer refuses on the bubble only for the bubble's own id.** A missing or expired row, an overwritten question or an unknown `optionId` gets the stale-answer `Error` on the row's bubble when the client's `messageId` equals the row's `transcript.messageId`; otherwise it goes out as `WorldOOCMessage`, because the client-supplied id is untrusted.
- **The row is the single place a command waits,** on the player or on another process. Waiting is not a verdict: an unanswered challenge has no verdict yet (`pending`), and an unanswered referent question comes before any attempt exists.
- **Plan stays blind to the world, or its output is frozen whole.** The freeze line is exactly `compileAttemptsFromSkeleton`'s input. A future LLM Plan fallback that proposes identities has read the world: either it proposes attempts only, or its whole output is frozen and its identity half is treated as a hint that is rechecked. Context outside the command text (a reading of "take it") would belong in the frozen root.

## Command outcome

- **An outcome rides the command's own bubble.** `handleParseRequested` mints the echo's `messageId` and `createdTime` when the request carries a `sessionId`, and carries them (with the trimmed command text and the session) on `ResponseContext.transcript`. Every line that answers a parsed command goes through `reportCommandOutcome(context, 'Error' | 'Info', lines)`, which republishes the echo under that id with `Outcome`.
- **A revision resends the whole body.** The client replaces, never merges, so the republish carries `Message` (the command text) and `SessionId` again; the echo's position comes from the first publish's `createdTime`.
- **No echo, no bubble.** With no `transcript` (no `sessionId`, or an `Action Assessed` entry that never had an echo) the helper falls back to a standalone `WorldOOCMessage`. Notices with no originating command stay `WorldOOCMessage`.
- **The test harnesses stay OOC.** `runCoyoteEngineTestHarness` and `runAcmeOrderAffinitiesHarness` publish multi-line, dev-only reports straight through `messageBus`; they are output, not the outcome of a command, so they do not take `reportCommandOutcome`.
- **The row remembers its bubble.** `transcript` (`messageId`, `createdTime`, `command`) sits beside `root`, not inside it: it describes this attempt, not Plan's output. It is optional (no session means no echo; older rows lack it), and the session comes from the row's key. `transcriptContextForResume` turns it into the `ResponseContext.transcript` a resumed command's outcome is reported through, so that outcome lands on the original bubble. A late revision updates the bubble in place wherever it sits in the log.
- **A Select is one more revision of the command's own bubble.** `Outcome` can be `{ Kind: 'Select'; Message; Options: { OptionId; Label }[] }`: a question the player answers by choosing an option. It resends the whole body like any revision, and it is replaced by the resumed command's own outcome (or by the next Select if still ambiguous). Nothing echoes the choice.
- **Ask only when the answer would differ.** A Consult becomes a Select only when its alternatives differ in `referentAnswers` (alternatives that differ only by plan stay an `Error`) and the context has a `transcript`; otherwise the `Error` line stands, as it does when the row write fails.
- **The client never supplies an answer.** It sends `{ messageId, optionId }`; the server looks the option up in the row. Re-parsing the chosen text is not an answer path, because it redoes Parse and Plan and may resolve differently.
