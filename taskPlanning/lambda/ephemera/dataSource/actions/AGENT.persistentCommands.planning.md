# Persistent in-progress commands

**Status:** In progress. Slices 1 (the row module, `persistentCommand/`), 2 (delete on `Session Disconnect`), 3 (the payload) and 4 (resume) are done 2026-10-09. All decisions (SC-1 to SC-5) are made; only the close-out remains.

Task-planning conventions: [`taskPlanning/AGENT.md`](../../../../AGENT.md).

## Purpose

When the ephemera Lambda parses a command, the in-progress command is lost as soon as that invocation returns. Any exchange that runs over more than one player message needs the command to survive into a later invocation, which may run on a different instance. "Do you mean the red cup or the blue cup?" in reply to `get cup` is the first such exchange.

This plan **persists** that state: a row per character per session, its lifetime, and a stored shape that a later invocation can resume. It also builds the **resume**: rerunning a command from a stored row with its answers applied, because only that proves an answer stored in one run lands on the right question in another. It does **not** yet **use** either in play. Nothing asks the player a question, nothing writes the row from the live command path, and nothing starts a resume from player input. The first plan that does will wire those.

It takes on the persistence half of the open thread in [`AGENT.objectManipulationIterations.planning.md`](AGENT.objectManipulationIterations.planning.md) ("Referent clarification (row 11) has no settled shape yet"), whose third question ends: *an attempt held awaiting the player has to be saved and resumed from that point.* That thread's first question, challenge or candidate pool, is now [SC-4](#open-decisions-implementation--plan-only) here. Its second, a verdict that neither proceeds nor refuses, was answered there on 2026-10-09: no such verdict exists.

## Scope

**In:**
- The ephemera-table row: its key, its TTL, and read-side expiry.
- Deleting a session's rows when the session ends.
- The stored payload type, its plain-data round trip, and whatever key stability SC-3's answer needs from the pipeline.
- Resuming a command from a stored row: rerunning from the frozen root with `selectedAttempt`, `referentAnswers` and `challengeAnswers` applied, and refusing on a stale answer.

**Out:**
- Deciding to ask the player, and asking: when a command asks rather than abstains, counting deferred pairs as possibly valid, asking one referent at a time (the ladder note's "Resolution order"), and reading the reply.
- Writing the row from the live command path, and starting a resume from player input.
- Client changes.
- The ladder note's remaining open questions (everything except what SC-3 and SC-4 decide).

## Getting started

1. Skim [`taskPlanning/AGENT.md`](../../../../AGENT.md).
2. Read [`actions/AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.concepts.md), sections *Pipeline shape* and *`CommandAttempt`*. They cover the candidate space, the shared stage, and the action, challenge and verdict families.
3. Read the challenge family and how it is minted:
   - [`commandAttempt/challenge.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/challenge.ts)
   - [`commandAttempt/expandBoundaryChallenges.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/expandBoundaryChallenges.ts), for `mintChallengeId`
   - [`commandAttempt/action.ts`](../../../../../lambda/ephemera/dataSource/actions/commandAttempt/action.ts), for `mintActionId`
4. Precedents to copy:
   - **TTL on ephemera rows:** the `thinking` data source's `deleteAt` writes, for example [`maybeCompleteThinkingJob.ts`](../../../../../lambda/ephemera/dataSource/thinking/scheduling/maybeCompleteThinkingJob.ts).
   - **A data source subscribing to a `mtw.connections*` event:** [`positions/subscribedEvents.ts`](../../../../../lambda/ephemera/dataSource/positions/subscribedEvents.ts) and its branch in [`positions/index.ts`](../../../../../lambda/ephemera/dataSource/positions/index.ts).
5. Testing authority: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). If commands conflict, follow that file.
6. Baseline, which should pass before you edit:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/actions/commandAttempt/
```

## Open decisions (implementation --- plan only)

Plan-only: decisions we are making in order to implement the next slice(s).
Do not copy into package `AGENT.concepts.md`. When a decision ships, record it
in `AGENT.contract.md` / `AGENT.implementation.md` and remove the row here.

| ID | Decision | Blocks slice | Status |
| --- | --- | --- | --- |
| SC-1 | **Row key.** `EphemeraId: CHARACTER#<characterId>`, `DataCategory: SESSION#<sessionId>`, with one singular `currentAction` per row. A new command either answers the pending one or replaces it, so stale questions never pile up. Keying by session matches the command-echo behaviour (ISS8242): window B can't answer window A's question, and a reload drops the pending command. Lookups by session use the existing `DataCategoryIndex`. No current reader would pick these rows up: the diagnostics sweeps query that index on fixed values such as `Meta::Room`, and the `Meta::Character` reads name their keys exactly. | 1 | Decided 2026-10-09; key helpers shipped in Slice 1 |
| SC-2 | **Lifetime.** Each write sets `deleteAt`, the table's existing TTL attribute. Reads treat a row past its `deleteAt` as absent, because DynamoDB can take up to about 48 hours to remove expired rows. A session's rows are deleted when ephemera receives `Session Disconnect`. Ephemera's event rule in `template.yaml` does not list that event today, so this plan adds it. The TTL length is a single named constant; start at one hour and tune it when the exchange plan uses it. | 1, 2 | Decided 2026-10-09; TTL constant, `deleteAt` and expiry helpers shipped in Slice 1 disconnect delete shipped in Slice 2 |
| SC-3 | **What we store.** Plain, persistable data, never pipeline state (which would only make sense to one pipeline instance). The row holds four fields: the frozen root (SC-5), `selectedAttempt` (an attempt's action id), `referentAnswers` (`stableRefKey` to thing id) and `challengeAnswers` (structural challenge key to answer). Challenges are only asked once one attempt and one identity are fixed, so a challenge key need only be stable when that same pair is rerun against a fresh world, and challenge answers are dropped when the selection they were given under goes stale. `challengeAnswers` is built now, not deferred. See [SC-3 notes](#sc-3-notes-what-we-store) and [the verdict](#sc-3-verdict-2026-10-09). | 3 | Decided 2026-10-09; payload type, guard, `get`/`put` and structural challenge ids shipped in Slice 3 |
| SC-4 | **Is referent ambiguity a challenge?** Decided in two halves. **(1) No fold for keys or application:** referent answers stay keyed by `stableRefKey` and narrow Enumerate's pools, while challenge answers stay keyed by graph structure and become verdicts after Expansion (this follows from SC-5). **(2) One place to wait:** the persistent command row is *the* single place where a command waiting on the player, or on another process, is kept. Referent questions and pending challenges both live there. Moved here from the ladder note's "Challenge or candidate pool?" bullet. See [SC-4 notes](#sc-4-notes-is-referent-ambiguity-a-challenge) and [the verdict](#sc-4-verdict-2026-10-09). | 3 (feeds SC-3 (c), (d)) | Decided 2026-10-09 |
| SC-5 | **Freeze the ungrounded plan as the replay root.** Store Plan's output (the stamped skeleton, its ungrounded `CommandAttempt[]` and the classify confidence) once, and on every rerun resume from `compileAttemptsFromSkeleton` with world inputs read fresh. Traced 2026-10-09: on the object-manipulation route, everything up to and including Plan reads only the command text, so world changes and later player actions can't invalidate it. Two LLM calls do sit in that stretch, so it isn't deterministic, which is why it should be frozen rather than rerun. This answers SC-3 (b). See [SC-5 notes](#sc-5-notes-freezing-the-ungrounded-plan), and [what it implies for SC-4 and SC-3](#what-sc-5-implies-for-sc-4-and-sc-3). | 3 (answers SC-3 (b)) | Decided 2026-10-09 |

### SC-3 notes: what we store

**The candidate under consideration (the author's proposal): accumulate answers to challenges under stable keys.** The row holds a **replay root** and `answers: { [questionKey]: answer }`. A later invocation reruns the pipeline from the root. Each challenge the run regenerates looks up its key, and a recorded answer becomes its verdict. An answer whose key no longer comes up is simply ignored. That gives graceful handling of a world that changed between question and answer: if someone took the red cup, the question about it doesn't arise again. The stored data is also exactly the progress made (what the player has answered), not a snapshot of what a pipeline had worked out at one moment.

**The baseline it is weighed against: snapshot the attempt.** `CommandAttempt` already round-trips through `toJSON`/`fromJSON` (`CommandAttemptData`). Storing the candidate attempts is the simplest thing that persists. But the snapshot freezes groundings and challenge verdicts against the world as it was when the question was asked, so resuming would have to rerun the shared stage anyway to stay sound (the same reasoning as the dry-run/commit recheck). Once resume reruns everything, the snapshot's only remaining job is to carry the answers.

**What the candidate has to settle:**

- **(a) A key per challenge member.** Neither id is stable today:
  - Challenge ids come from a module-level counter, `boundaryChallenge-N` (`expandBoundaryChallenges.ts`, `mintChallengeId`). They differ between instances, and between two runs on the same instance.
  - Action ids are `uuidv4()` (`action.ts`, `mintActionId`).

  The graph members can be keyed by structure:
  - A `CustomEdgeChallenge` can use its edge: `edgeId` where present (it is optional on `HostRelationalEdge`), otherwise `from`/`to`/`kind`/`relationLabel`.
  - An `ExitEdgeChallenge` can use the object being moved.

  **`WorldKnowledgeChallenge` is the hard case.** It is LLM-written free text with no structure underneath, so its key has to come from somewhere else, or the decision must say that such challenges can't hold answers.

  If [SC-5](#sc-5-notes-freezing-the-ungrounded-plan) freezes Plan's attempts, the ids Plan's templates mint (`matchMembershipTemplate`, `matchContainmentTemplate`, `matchLookTemplate`) are stored with the attempts, so they are stable on rerun at no cost. Only ids minted after the freeze point need structural keys: Expansion's facilitating actions and every challenge.

  Separately: should the key be the challenge's `id` itself, by making minting deterministic, or a separate field next to `id`?

- **(b) The replay root.** *Proposed answer in [SC-5](#sc-5-notes-freezing-the-ungrounded-plan): freeze Plan's output.* Keys can only be as stable as whatever produces them. Parse is an LLM stage, so parsing `get cup` a second time could segment the spans differently and change their `stableRefKey`s. The root is therefore probably the parse result (`words` plus the command skeleton, whose `stableRefKey`s are deterministic given the skeleton), not the raw words. Every other LLM stage that runs before challenges are made (the Plan fallback, Identify's embedding ranking) either gets frozen into the root or has to be shown stable.

- **(c) One family of keys or two.** This follows from [SC-4](#sc-4-notes-is-referent-ambiguity-a-challenge):
  - If SC-4 keeps referents separate, the accumulator holds **answers to questions** under two kinds of key: challenge keys, and referent keys taken from the span's `stableRefKey`. That key is already stable, given (b)'s replay root.
  - If SC-4 folds referents into challenges, there is one kind of key, and a referent challenge's key still most likely comes from `stableRefKey`.

- **(d) What an answer looks like.** An answer to a referent question (or a referent challenge, under SC-4's fold) is a chosen thing id, checked against the current candidate pool when the command resumes. An answer to a challenge is nearer to a verdict. It could be a `Verdict`, or a statement from the player that an adjudicator then judges. Whichever it is decides whether resume calls `recordVerdict` directly or goes back through Adjudicate.

### SC-4 notes: is referent ambiguity a challenge?

**Today's split.** Referent ambiguity is a property of the **candidate space**. Each candidate pairs one attempt with one identity per referent, and each is judged on its own. Only Selection, comparing candidates, can see that two of them are close (a thin margin) and fall back to `Consult`. Challenges are a property of **one candidate's actions**: they attach after grounding, and `CommandAttempt.result` is derived from their verdicts.

**What folding would buy.**
- One way to accumulate answers (answers to challenges) and one rule for a command's result.
- `Consult` would stop being a dead end and become a pending challenge. That is what the ladder's row 11 asks for when it calls for a "resumable exchange".

**What folding would have to change.** Where would the challenge sit? On each candidate, every action is grounded and makes sense on its own; the ambiguity only shows when you compare candidates. So a referent challenge would have to live somewhere challenges don't live today, either:
- on the attempt **before** it is grounded, carrying the candidate pool; or
- at **Selection**, across candidates.

Either way, folding moves where the challenge family is anchored, not just which members it has. Two existing rules are also under strain:
- "A challenge propagates nothing; what a met verdict permits is its own action's desired result." A referent answer narrows the candidate space rather than permitting one action.
- The verdict family has no member meaning "this id was chosen".

**Evidence that would settle it.** Is referent ambiguity the only way the pipeline "can't reduce to a single compilable plan"? Plan can be ambiguous as well:
- a verb or frame that admits several attempts;
- sibling attempts, such as taking part of the rope versus taking it all.

If those also end up asking the player, the thing to fold is "Selection can't choose" in general, not referent ambiguity in particular. That would argue for one question family at Selection covering both, whether or not it is called a challenge. If referents are the only case, keeping them separate (with `stableRefKey`-keyed answers) costs little.

### SC-5 notes: freezing the ungrounded plan

**What the ungrounded plan is built from** (object-manipulation route, [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts)):

| Step | Reads | Deterministic? |
| --- | --- | --- |
| `discriminateIntent`: the deterministic checks, then the LLM classify | The command. `buildIntentClassificationPrompt(command)` takes nothing else. | Checks yes; classify no (LLM) |
| `runParseStage` | `{ command }` only | No (LLM) |
| `stampStableRefKeys` | The skeleton | Yes |
| `planSkeleton(skeleton, command)` | The skeleton and the command | Yes (pure) |
| `compileAttemptsFromSkeleton`, and everything after it | `roomObjectCatalog`, `heldInventoryCatalog`, `hostRoomId`, graphs | World-dependent |

So the line between the parts that depend on the language and the parts that depend on the world is exactly `compileAttemptsFromSkeleton`'s input. Before it, nothing reads the world. After it, everything should be reread, for the same reason as the dry-run/commit recheck. Plan returns `CommandAttempt[]`, which already round-trips through `toJSON`/`fromJSON`, so the frozen root needs no new serialization.

(`AGENT.implementation.md`'s membership step 2 says classify threads `movementObjectLabels` into its prompt. No code does that any more, so that line is stale.)

**Why freeze rather than rerun.** Even though nothing in it depends on the world, rerunning Plan would call the LLM twice more, and either call could come back different: Parse could segment the spans differently, which changes the `stableRefKey`s, and classify could route the command differently. Freezing also saves those two calls, and protects a pending command from a deploy that changes a template between the question and the answer.

**Limits of the claim.**
- **Other routes freeze at different points, or not at all.** Navigation resolves against the room's exits before any plan exists (`matchNavigationParaphrase`, and the deterministic exit checks), so "which door?" would need its own freeze point. The Acme order route reads world counts inside an LLM call. Neither is in scope here. Any future clarification on those routes needs its own answer.
- **A constraint on future work.** The planned LLM Plan fallback (for peer relations, not yet built) may propose `(identity, attempt)` pairs directly, according to `actions/AGENT.concepts.md`. A proposal that names identities has read the world, which would move the freeze line. When that fallback is built, it should either stay blind to the world (proposing attempts only) or its whole output should be frozen and its identity half treated as a hint that gets checked again. This is worth recording as a contract rule when this plan closes.
- **Contextual readings.** References such as "take it" or "the other one" would make Plan depend on conversation context. That isn't world state, but it is something outside the command text. None exist today. If they arrive, their context belongs in the frozen root.

### What SC-5 implies for SC-4 and SC-3

**The freeze line sorts every question by where its key comes from.** Anything defined before the line is in the frozen root and is stable for as long as the row exists. Anything made after it is rebuilt from the world on every rerun, so a key for it has to be derived from world structure.

- **Referent questions are keyed before the line.** "Which cup?" is about a span, and the span's `stableRefKey` is in the frozen skeleton and attempts. The candidates are found after the line (Identify reads the catalogs), but the *question* is not.
- **Challenges are made and keyed after the line.** Expansion makes them from the graph on every rerun, so their keys must come from that structure (SC-3 (a)).

**Where a referent answer plugs in already exists.** Enumerate (`enumerateIdentityAssignments`) takes candidate pools keyed by `stableRefKey`. An answer `{ stableRefKey -> thingId }` can be applied as a filter on that key's freshly built pool, leaving only the chosen candidate, between Identify and Enumerate. The check against the current world comes for free. If the chosen object is no longer in the pool (someone took the red cup), the answer is out of date and the rerun says so, rather than acting on a stale id. Nothing passes a known `groundedId` through Identify or Enumerate today, so the pool filter needs less new plumbing than writing `groundedId` onto the frozen attempts, and it keeps the frozen root free of world facts.

**For SC-4.** The main thing folding would have bought, one way to accumulate answers, no longer depends on folding. Referent answers accumulate under `stableRefKey` using machinery that already exists, while challenge answers need structural keys whatever we call them. The two kinds of key differ by where they sit relative to the freeze line, not by name. **Lean: keep the two separate for accumulation.** What remains of SC-4 is narrower: whether a pending referent question and a pending challenge share one *pending/result* representation, which is whether `Consult` becomes a pending challenge. That is the ladder's second question (a verdict that neither proceeds nor refuses) seen from this side. *(Both halves decided; see the [SC-4 verdict](#sc-4-verdict-2026-10-09).)*

#### SC-4 verdict (2026-10-09)

The plan's author settled the remaining half: **the persistent command row exists to be the single place a command waits, whether on the player or on another process.** Both referent disambiguation and pending challenges are kept there. Combined with the half that follows from SC-5, the row holds two kinds of answer and one waiting state:
- Referent answers are keyed by `stableRefKey` and narrow the candidate pools.
- Challenge answers are keyed by graph structure and become verdicts after Expansion.
- Both are kept in, and resumed from, the same row.

**What "or another process" adds.** An answer can come from something other than the player: the deferred adjudication tier, or a future slow LLM judge or other asynchronous job. Such an answer is still a challenge answer under a structural key. Only where it comes from differs. So the row's answers are not tied to the player, and a stored answer should record its source, so a resumed command can tell the player's word from a process's judgement.

**Consequence for the ladder note's second question (confirmed 2026-10-09; recorded there).** No verdict "neither proceeds nor refuses": waiting is something the row records. An unanswered challenge has no verdict yet (`pending`); an unanswered referent question comes before any attempt exists. When adjudication wants the player to answer, it records `met` and adds a new challenge carrying the question.

**For SC-3.** The snapshot baseline and the answers-only candidate become one design. The row stores:
- a snapshot of the part that doesn't depend on the world (SC-5's frozen root); and
- answers for the part that does.

The baseline's objection, frozen groundings, doesn't apply, because no grounding is frozen. The likely shape is `{ root, referentAnswers: { [stableRefKey]: thingId }, challengeAnswers: { [challengeKey]: answer } }`. Of SC-3's sub-questions:
- (b) is answered by SC-5.
- (c) leans to two key families, per SC-4 above.
- (d) is answered for referents: an id, applied as a pool filter.
- What is left is (a) and (d) for **challenges** only.

**One choice is still open in SC-3: challenge answers have no producer yet.** No challenge member asks the player anything today:
- the Coyote evaluator judges `CustomEdgeChallenge`;
- `ExitEdgeChallenge` stays pending and the command abstains;
- nothing produces `WorldKnowledgeChallenge` yet.

So either Slice 3 builds the `challengeAnswers` half now, with structural keys for `CustomEdge` and `ExitEdge`, or it ships `root` plus `referentAnswers` and leaves challenge keys to the first challenge that asks the player. That is the author's call. **Since SC-4's verdict this leans toward building it now:** pending challenges are now explicitly meant to be kept in the row, and `ExitEdgeChallenge` is a pending challenge the pipeline produces today, whose command is currently dropped rather than kept. *(Decided: build it now; see the [SC-3 verdict](#sc-3-verdict-2026-10-09).)*

#### SC-3 verdict (2026-10-09)

The plan's author settled the row's contents, together with the order in which a resumed command narrows. That order is recorded in the ladder note's row 11 bullet ("Resolution order") because it belongs to *using* the row. The row holds:
- **The frozen root:** SC-5's replay point, Plan's ungrounded attempts.
- **`selectedAttempt`:** the chosen plan, stored as the attempt's action id. Its position in the array would also be stable because the root is frozen, but the id says what it is.
- **`referentAnswers`:** `{ [stableRefKey]: thingId }`, applied as the pool filter described above.
- **`challengeAnswers`:** `{ [challengeKey]: answer }`, built in Slice 3 rather than deferred.

**The order narrows SC-3 (a).** Challenges are only asked once a single attempt and a single identity are fixed. So a challenge key no longer has to pick out "the same challenge" across different identity pools; it only has to be stable when the same pair is rerun against a fresh world. That is the case where a structural key is easy, since it can include the selected attempt and the grounded ids.

**Answers depend on the selection they were given under.** If a referent answer goes stale (the red cup is gone), the challenge answers given under it are dropped with it.

**Settled in Slice 3 (2026-10-09):**
- The challenge key's form: the challenge's `id` itself, made deterministic (the module counter is gone). `exitEdge:<primaryActionId>` and `customEdge:<primaryActionId>:<edgeId, or from|to|kind|relationLabel>`, scoped by the primary action's Plan-minted id. One exit challenge exists per primary action by construction. `WorldKnowledgeChallenge` has no producer yet, so its key waits for one.
- The answer's shape: `{ verdict, source: 'player' | 'process', askedAs? }`. Resume calls `recordVerdict` directly. A player statement that goes back through Adjudicate would be a new arm, added when something produces one.
- How a decision to ask survives a rerun: the row records it. The original challenge's entry carries `askedAs` (by convention `ask:<challengeKey>`), so resume re-adds the question whether or not a nondeterministic judge asks again. Nothing produces `askedAs` yet. The problem: adjudication that asks the player records `met` and adds a question challenge, so the stored answer's key exists only if the rerun asks again. A nondeterministic judge may not, and the stale check would then refuse. Either the decision to ask is structural (the same challenge always asks), or the row records it, for example as the original challenge's entry in `challengeAnswers` ("met, asked as ⟨key⟩").

**Payoff test for whatever is chosen (Slice 3).** The proof must reach the outcome this plan exists for: state that survives into a different instance. It has two parts:
1. **Keys are stable.** Two runs of the stage that produces keys, each in its own module registry (`jest.isolateModules`, so no counter or other module-level state is shared), give the same keys for the same root.
2. **The row round-trips.** A row written by one module instance and read back by another gives an equal payload.

Today's counter-based `boundaryChallenge-N` ids fail part 1, which is what makes it a real test.

## Recommended order

Pending work is `[ ]`, completed is `[X]`. Mark each nested line `[X]` as it is done.

- [X] **Slice 0. Decide SC-3** with the plan's author, in discussion.
  - [X] SC-3 decided 2026-10-09: the four-field row; challenge keys only need stability within a fixed pair.
  - [X] SC-4 decided 2026-10-09: no fold for keys or application; the row is the one place a command waits.
  - [X] SC-5 decided 2026-10-09: freeze Plan's output as the replay root. Record each verdict in its row and state the payload type in prose. A long comparison of options goes in a linked temporary analysis document, not in this plan.
- [X] **Slice 1. The row module.** Put it in a new folder under `lambda/ephemera/dataSource/actions/`, because the actions data source owns the command pipeline. (The folder name is the implementer's choice.)
  - [X] Key helpers for SC-1's `EphemeraId` and `DataCategory`.
  - [X] `clear(characterId, sessionId)` and `clearSession(sessionId)`. `clearSession` queries `DataCategoryIndex` on `SESSION#<sessionId>` with `EphemeraId` beginning `CHARACTER#`, and deletes every row it finds. It doesn't take the `characterIds` list from `Session Disconnect`, because that list (`characterIds`, optional in `packages/mtw-interfaces/ts/eventBridge/connections/index.ts`) comes from the connections table's current adjacency, and a character the session already left could still have a row.
  - [X] The TTL constant, and a `deleteAt` helper (plus `isPersistentCommandExpired`, the read-side expiry predicate Slice 3's `get` will call).
  - [X] Tests, with `ephemeraDB` mocked as the `thinking` tests do.
- [X] **Slice 2. Delete on `Session Disconnect`.**
  - [X] Add `Session Disconnect` (source `mtw.connections`) to ephemera's event rule in `template.yaml`, next to `Character Registered`.
  - [X] Add a subscribed-event guard and a branch in the actions data source that calls `clearSession` (from `persistentCommand/`), following the positions pattern.
  - [X] Tests for the guard and the handler.
- [X] **Slice 3. The payload.**
  - [X] Settle the three items the [SC-3 verdict](#sc-3-verdict-2026-10-09) leaves to this slice: the challenge key's form, the answer's shape, and how a decision to ask survives a rerun.
  - [X] The payload type (`root`, `selectedAttempt`, `referentAnswers`, `challengeAnswers`) and its runtime guard. A read whose payload fails the guard is treated as absent rather than throwing, so a later shape change can't break a session.
  - [X] `get` (with read-side expiry) and `put` (sets `deleteAt`).
  - [X] Structural keys for `CustomEdgeChallenge` and `ExitEdgeChallenge`, stable when the same (attempt, identity) pair is rerun.
  - [X] The two-part payoff test from the SC-3 notes.
- [X] **Slice 4. Resume from a stored row (after Slice 3).** A resume entry point that takes a row instead of a command. It skips classify, Parse and Plan, and calls `compileAttemptsFromSkeleton` with the frozen root, as [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts) does with Plan's output.
  - [X] Apply `selectedAttempt` by filtering the frozen attempts before they are compiled.
  - [X] Apply `referentAnswers` by filtering each answered `stableRefKey`'s pool just before `enumerateIdentityAssignments`, in `proposeAttemptCandidates` ([`attemptCandidates.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/attemptCandidates.ts)).
  - [X] Apply `challengeAnswers` around `expandAndAdjudicateCandidates`: a direct `recordVerdict`, or an input to adjudication, as decided in Slice 3: a direct `recordVerdict` from the stored `{ verdict, source }`, and an `askedAs` entry re-adds its question challenge.
  - [X] Stale answers refuse with the reason: a referent answer whose thing is no longer in its pool, or a chosen attempt with no valid identity left. Challenge answers given under a stale selection are dropped.
  - [X] Tests from hand-written rows: the selections narrow the candidates to one pair; a stored challenge answer becomes that challenge's verdict on a fresh run in a separate module instance (`jest.isolateModules`), which is the plan's end-to-end payoff; a stale referent answer refuses.
- [ ] **Close-out.**
  - [ ] Move the row shape and lifetime rules to `actions/AGENT.contract.md`, and the paths to `actions/AGENT.implementation.md`.
  - [ ] Update the ladder note's row 11 bullet.
  - [ ] Delete this plan, after checking for links that point to it.

## Progress

| Slice | State | Notes |
| --- | --- | --- |
| 0 | Done 2026-10-09 | SC-3, SC-4, SC-5 decided |
| 1 | Done 2026-10-09 | `persistentCommand/`: `rowKey.ts`, `lifetime.ts`, `clear.ts` (+ tests) |
| 2 | Done 2026-10-09 | `ConnectionsSessionDisconnect` rule; `isActionsSessionDisconnectEnvelope`; `receiveEvents` branch calls `clearSession`. Dev-instance check waits for Slice 3 (no rows are written yet) |
| 3 | Done 2026-10-09 | `persistentCommand/`: `payload.ts`, `rowStore.ts` (+ tests, `payoff.test.ts`). Challenge ids in `expandBoundaryChallenges.ts` are now structural. `parseCommand.test.ts`'s snapshot serializer masks UUIDs embedded in ids |
| 4 | Done 2026-10-09 | `persistentCommand/resume.ts` (`resumePersistentCommand`); `compileAttemptsFromSkeleton` takes optional `answers` (`ResumeAnswers`, in `enrich/objectManipulation/resumeAnswers.ts` with `applyChallengeAnswers`, `primaryActionIdOf`, `resumeErrorMessages`). Stale answers (chosen attempt gone, chosen thing out of its pool) return `Error` on every route, via `proposeAttemptCandidates`'s `stale` flag. `selectedAttempt` is the primary (last) action's id, matching the challenge keys. An `askedAs` question is re-added as a pending `WorldKnowledgeChallenge` on the answered challenge's action. A stored challenge answer applies to every surviving candidate carrying that key, which is sound while answers are only stored under a fixed (attempt, identity) pair. Payoff: `resume.payoff.test.ts` |

## Verification

From `lambda/ephemera`:

```bash
npm run test -- --watchAll=false dataSource/actions/
npx tsc --noEmit
npm run test -- --watchAll=false
```

The last command, the full suite, is required because `*.integration.test.ts` files sit outside the tsconfig, so `tsc` does not check them.

For Slice 2, after deploying to the dev instance, confirm that dropping a session (closing a tab and waiting for stale-session teardown) removes that session's rows.
