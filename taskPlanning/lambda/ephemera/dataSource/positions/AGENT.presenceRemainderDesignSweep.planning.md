# Presence remainder: design sweep

**Status: in progress. Next step: [Slice 2](#recommended-order) (amend rows).** Slices 1 and 1b are done; the implementation plan is open as [`AGENT.presenceRemainder.planning.md`](AGENT.presenceRemainder.planning.md). Slice 0's target-list check stays open and gates only Slice 3. Opened 2026-10-11 from conversation, after a review of how `ROOM#` components are special-cased in presence bindings.

**Scope in one sentence: carry a design decision reached in conversation --- rooms as perspective roots, and a remainder binding with an optional `fromHostPresence` parent pointer --- into the design plans and durable docs that it changes, without writing any code.**

This is a standard implementation plan under [`taskPlanning/AGENT.md`](../../../../AGENT.md), whose deliverable is edits to documents, not code. It is deleted when the work lands. Two rules govern it:

- **It records no design of its own.** The design's home is [`AGENT.presence.planning.md`](AGENT.presence.planning.md). Slice 1 wrote it there as PR-20 and PR-21; the [interim record](#interim-record-of-the-decision) below is now only links.
- **Present-tense docs change only where they are false today.** [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md), [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md), [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) and [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) describe shipped behavior. They get their false claims corrected, and the new model only as plainly marked unbuilt. Contract clauses for the new model wait for the code.

---

## Getting Started

1. **The false premise this sweep exists to correct.** Several documents say *rooms are never members of another play graph*, so they carry no presence binding. Since 2026-09-05 that is false: cache-time containment population ([`containmentPopulationSteps.ts`](../../../../../lambda/ephemera/dataSource/positions/manipulation/containment/containmentPopulationSteps.ts)) makes a Room a node of its Area's graph, gives it a `PartOf` edge, and mints a presence binding on the room with `fromHostId: AREA#...`. The adjacency type cited as enforcing the old claim (`EphemeraPositionAdjacencyContainedId` in [`ephemeraPositionAdjacency.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraPositionAdjacency.ts)) was widened the same day, and its comment says so.
2. **Read the decision:** PR-20 and PR-21 in the presence plan, linked from the [interim record](#interim-record-of-the-decision) below.
3. **Read the model it changes:** [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) sections 1 and 4, then [`AGENT.concepts.md` --- Presence as a cover](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#presence-as-a-cover), especially claim 4 and *Why location resolution terminates*. That last paragraph names its own trigger: *"if rooms ever enter the part-of ladder, this argument needs rebuilding."* Room-in-Area `PartOf` population fired it.
4. **Read the rows it amends** in [`AGENT.presence.planning.md`](AGENT.presence.planning.md): the Settled register's PR-1, PR-2, PR-9 and PR-10, and the open PR-3, PR-12, PR-13, PR-14 and PR-18. Grade each by its Status cell, not its prose; bodies keep superseded argument by design. Edit these rows in one pass per row: they are single 5--20 KB lines, and edits made across several turns hide each other.
5. **How to amend a settled row** is in [`AGENT.designVariant.md`](../../../../AGENT.designVariant.md#graduating-a-resolved-row): the verdict cell must stay self-sufficient. So rewrite the verdict to what is now true and move the superseded verdict text into the row's section in [`AGENT.presence.discussion.planning.md`](AGENT.presence.discussion.planning.md), dated, with a pointer to PR-20/PR-21. Do not leave struck-through text in a settled verdict.

**Test orientation.** This plan edits documents and, in Slice 3, code comments only. Command authority for the comment edits: [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md). Baseline, which must pass before and after:

```bash
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/
```

## Interim record of the decision

**Moved by Slice 1, 2026-10-11.** The decision now lives in the presence plan's open table:

- **[PR-20](AGENT.presence.planning.md#open-decisions-design--plan-only)** (requirement: rooms as perspective roots and pinch points; some parts present nowhere). Detail: [discussion section](AGENT.presence.discussion.planning.md#pr-20-requirement-what-must-presence-say-about-rooms-and-about-things-present-nowhere).
- **[PR-21](AGENT.presence.planning.md#open-decisions-design--plan-only)** (representation, Locked: the remainder binding, `fromHostPresence`, pointers govern, the room rule). Detail, including the alternatives considered and the full list of what it supersedes: [discussion section](AGENT.presence.discussion.planning.md#pr-21-representation-the-remainder-binding-and-its-parent-pointer).

## What is deliberately out of scope

- **All code changes** --- the cover type, `fromHostPresence`, the audience walk, the fold's expansion of a remainder, the write path. They go to the implementation plan opened in Slice 1b.
- **Renaming `Full` in shipped docs.** `Full` is what ships. Docs that describe it ([`AGENT.implementation.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.implementation.md), [`packages/mtw-wml/ts/standardize/AGENT.md`](../../../../../packages/mtw-wml/ts/standardize/AGENT.md), [`AGENT.ludicCacheRebuild.planning.md`](AGENT.ludicCacheRebuild.planning.md), [`lambda/ephemera/AGENT.caching.planning.md`](../../../../../lambda/ephemera/AGENT.caching.planning.md), [`AGENT.designVariant.performance.md`](../../../../AGENT.designVariant.performance.md)) are inventory for the implementation plan, not edits here.
- **Fixing behavior.** A room-seeded cache currently gives each room member an extra bucket that resolves to no rooms (verified in Slice 0). It is recorded as a defect for the implementation plan, not fixed here.

## Recommended order

Pending work is `[ ]`, done is `[X]`; mark nested lines `[X]` as each is done.

- [ ] **Slice 0. Verify premises (no edits).** Record each answer inline here.
  - [X] **Rooms carry Area bindings.** Verified 2026-10-11 by reading: `containmentPopulationSteps` emits `addPresenceBinding` with `hostId: <room>`, `fromHostId: <area>` for Room-in-Area, and authored Areas exist (`packages/mtw-wml/ts/dungeon.wml`).
  - [X] **The extra cache bucket.** Verified 2026-10-11 by reading: `applyStepSequenceCore`'s `addPresenceBinding` mints every binding `Full`, Room-in-Area ones included; `presenceCacheNodesFromFold` expands the room's `Full` Area binding into the room's members; `bucketsByMember` gives each member `{ host: <room>, presence: <that binding> }`; and `roomsForPresenceNode` walks to the Area, which has no bindings, so it resolves to no rooms. Recorded as the implementation plan's Slice 2. The original check: read `foldSameHostBuckets` ([`ludicCache/mergeReducer.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/mergeReducer.ts)) and confirm that a room-seeded `buildLudicCache` folds the room's own Area binding with a cover listing the room's members, so `bucketsByMember` ([`catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts)) gives each member `{ host: <room>, presence: <room's Area binding> }`, which `roomsForPresenceNode` resolves to no rooms. Settle it by reading, or with a throwaway test that is not committed. No cache or audience test today has an Area-hosted room.
  - [ ] **The target list is complete.** Re-run the stale-phrase grep in [Verification](#verification) and confirm it matches the Slice 3 list.
- [X] **Slice 1. Record the decision in the presence plan.**
  - [X] Ground PR-21 in the corpus (done 2026-10-11, ahead of the rest of this slice so DS1 could be decided):
    - [X] **PR-C3**, *the alley filled with refuse, in two areas at once*, in [`AGENT.presence.corpus.planning.md`](AGENT.presence.corpus.planning.md#pr-c3-the-alley-filled-with-refuse-in-two-areas-at-once). Grades the pinch, and records the re-open trigger's near-miss.
    - [X] **PR-C4**, *the crate of angry bees, before Acme delivers it*, in the same file ([link](AGENT.presence.corpus.planning.md#pr-c4-the-crate-of-angry-bees-before-acme-delivers-it)). Grades the hostless remainder against PR-1's representation of hostlessness.
    - [X] **C10 annotation**, *an intangible member, the database library*, in [`AGENT.abstractionLayers.corpus.planning.md`](AGENT.abstractionLayers.corpus.planning.md#annotation-2026-10-11-an-intangible-member-the-database-library). Grades intangibility as structure against PR-9's tag route.
    - Their links to PR-20 and PR-21 point at the presence plan's open table, where the rows now are.
  - [X] Add **PR-20** (requirement) and **PR-21** (representation) to the open table of [`AGENT.presence.planning.md`](AGENT.presence.planning.md#open-decisions-design--plan-only), from the interim record. Each row stays a few hundred words; detail beyond that goes in a discussion-file section. PR-21's Status cell records its tier per DS1 (decided Locked; the row was removed when Slice 1b landed, and its grounding lives in PR-21's Status cell and discussion section).
  - [X] Replace this plan's interim record with links to the two rows. (Done 2026-10-11; the full record moved to the two discussion-file sections.)
- [X] **Slice 1b. Open the implementation plan, as soon as PR-21 is Locked in the presence plan.** Opened 2026-10-11 as [`AGENT.presenceRemainder.planning.md`](AGENT.presenceRemainder.planning.md). Do not wait for Slices 2--3: they correct other documents and gate nothing the code needs. **Why now (the user, 2026-10-11):** the `fromHostId` -> `fromHostPresence` migration is the largest part of this change and only grows with each feature added before it; and until a direct-to-presence parent path exists, new code has to walk binding-to-host, which is the debt this design removes.
  - [X] **Its first slice is the seam, not the storage.** Add one accessor (roughly `parentBinding(owner, binding) -> { host, presence } | undefined`), implemented over today's data by derivation: the parent binding whose cover lists `{ owner, binding }`, otherwise the host's single `Full` binding. Move `roomsForHost` and `hasPresenceAncestor` onto it. From then on new code has a direct-to-presence parent path, and the storage migration swaps the accessor's implementation instead of chasing call sites. (The "single `Full` binding" derivation misreads a room in an Area, a parent with no binding, and a parent with several; the implementation plan takes this up as PRm-1.)
  - [X] Seed the rest of the plan with: the cover type change and `Full` inventory above; `fromHostId` becoming `fromHostPresence`, and its readers (`roomsForHost`, `roomsForPresenceNode`, `hasPresenceAncestor`, the fold's `memberBindings` filter, the idempotency check in `containmentPopulationSteps`, the removal match in `presenceBindingStepsForMove`); the room rule in population; re-pointing a stable remainder on a move in place of `presenceBindingStepsForMove`'s remove-then-add; disconnect re-pointing to a hostless remainder; a pointer-versus-cover drift sweep and a cover rebuild heal that reads every member's graph (match the existing diagnostics sweeps); every member carrying a binding; the extra-bucket defect; migration of stored bindings, including room bindings into Areas; and, as a forward candidate, the AcmeOrder spawn's compensating delete in [`spawnImprovisationObjectsBatch.ts`](../../../../../lambda/ephemera/dataSource/objects/spawnImprovisationObjectsBatch.ts), which exists because "created but not placed" is not a legal state today.
  - [X] Note the overlap with [`AGENT.authoredObjectPopulation.planning.md`](AGENT.authoredObjectPopulation.planning.md), which widens the same population emitter to Objects.
- [ ] **Slice 2. Amend the rows it changes** (one pass per row; see Getting Started step 5).
  - [ ] **PR-2** (settled): the verdict rests cardinality on *a room is never a member of any graph*. Restate it on the pinch: a room-hosted character sits under the room's one remainder, so it has one binding however the room is grouped.
  - [ ] **PR-10** (settled): same premise, same restatement. Leave its parked host-arity obligation untouched.
  - [ ] **PR-9** (settled): restate the domain clause (hostless wholes are no longer outside the invariant; a hostless remainder covers them), and retire the tag-scoping clause per DS2. Its guard *"never grounds for deciding its tag does not bear presence"* loses its tag clause; the other guards stand. The same sentence is in [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md#presence-as-a-cover) (Slice 3).
  - [ ] **PR-1** (settled): restate how hostlessness is read --- a remainder with no host and no hosted carve-out, not *no presence nodes*.
  - [ ] **PR-3** (open): correct its "rooms are never members" statement.
  - [ ] **PR-13** (open): note that the character cardinality validator in `applyStepSequenceCore` counts presence nodes; under the remainder model an offline character keeps one hostless remainder, which still satisfies "at most one".
  - [ ] **PR-C1 Finding 4** (corpus): add a dated annotation after its 2026-09-17 amendment. The parent-side alignment and the "location, not assertion" ground are superseded: the pairing's authority moves to the child's `fromHostPresence`, which still costs one read, and the cover becomes its index.
  - [ ] **PR-12** (open): obligation B (*binding-to-binding, never binding-to-host*) now has a stored field to follow. Note it, and that today's `roomsForHost` fans out binding-to-host.
  - [ ] **PR-12 and PR-14** (open): add, as a forward note and not a decision, that placement becomes moving nodes from one bucket to another, the remainder included, so first placement and bucket splitting share one primitive.
  - [ ] **PR-18** (open): note that a carve-out with an empty member list has the room's root as its whole bucket, which relies on the root being in every bucket. Both of PR-18's dispositions agree on this, so it stays non-blocking.
- [ ] **Slice 3. Correct present-tense docs and comments** (false claims only).
  - [ ] [`AGENT.concepts.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.concepts.md): rewrite *Why location resolution terminates* around the perspective root, and mark the remainder model, claim 4's change, and the cover's change from authority to index (*"authoritative rather than derived"*) as Target. Vocabulary only: no dates, slices or file names.
  - [ ] [`AGENT.contract.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.contract.md) (the character-host restriction, near "a room is never a graph member"): correct the stated reason; the validator itself is unchanged.
  - [ ] [`AGENT.ludicNetwork.md`](../../../../../lambda/ephemera/dataSource/positions/AGENT.ludicNetwork.md) section 1 ("rooms are never members of another play graph"): correct it, and say plainly in section 4 that the remainder model is unbuilt.
  - [ ] [`ludicGraph/AGENT.md`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/AGENT.md) (`toWireLudicGraphFull`): the projection is still right, for a different reason --- a room's contents fall in one bucket, today its single `Full` binding.
  - [ ] Code comments, comment-only edits: [`ludicGraph/wireProjection.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/wireProjection.ts) (`toWireLudicGraphFull`'s header), [`ludicGraph/presenceRooms.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceRooms.ts) (`roomsForHost`'s header), [`ludicGraph/presenceAncestry.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicGraph/presenceAncestry.ts) (`hasPresenceAncestor`'s header), [`ludicCache/catalogHandles.ts`](../../../../../lambda/ephemera/dataSource/positions/ludicCache/catalogHandles.ts) (file header) and [`plan/planStep.ts`](../../../../../lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/planStep.ts) (`GroundedPresence`'s comment).
  - [ ] Discussion-file derivations ([`AGENT.presence.discussion.planning.md`](AGENT.presence.discussion.planning.md) PR-2 and PR-10 sections) keep their argument as written; they only gain the dated pointer from Slice 2.
- [ ] **Slice 4. Close.**
  - [ ] Graduation sweep: grep for inbound links to this file (including from the implementation plan opened in Slice 1b), then delete it.

## Open decisions (implementation --- plan only)

Plan-only: decisions made in order to carry out the next slices. Each row is removed when its slice lands.

| ID | Decision | Blocks | Status |
| --- | --- | --- | --- |
| **DS2** | **Does PR-9's tag-scoping clause survive?** It says presence-capability is a property of a node's tag, and anticipates a future tag declared not to bear presence. **Retire it, decided by the user 2026-10-11:** intangibility is structural (a hostless remainder), so presence is not a property of a tag. Graded by the C10 annotation, where the tag route is the reading that makes intangibility a kind. PR-9's anti-reclassification guards stay; the one that refers to a tag is restated without it. | Slice 2 (PR-9) | Decided (retire) |

## Verification

```bash
# Stale-phrase grep. Expected after Slice 3: hits only in AGENT.presence.discussion.planning.md (preserved derivations).
grep -rn -iE "rooms? (are|is) never (a )?(graph )?members?|never (a )?members? of (any|another)|rooms? (carry|carries|have|has) no (presence )?binding|a room has no binding|base case is the room" --include='*.md' --include='*.ts' lambda packages taskPlanning
# Two claims wrap across comment lines and need their own check:
grep -n -A1 "Rooms carry no$" lambda/ephemera/dataSource/positions/ludicGraph/presenceAncestry.ts
grep -n -A1 "a room has no$" lambda/ephemera/dataSource/actions/enrich/objectManipulation/plan/planStep.ts

# Relative links resolve in every touched file (pass the files as arguments).
node -e 'const fs=require("fs"),path=require("path");let bad=0;for(const f of process.argv.slice(1)){const t=fs.readFileSync(f,"utf8");for(const m of t.matchAll(/\]\(([^)#\s]+)(#[^)\s]*)?\)/g)){const p=m[1];if(/^[a-z]+:/.test(p))continue;if(!fs.existsSync(path.resolve(path.dirname(f),p))){bad++;console.log(f+": "+p)}}}console.log(bad?bad+" broken":"links ok")' <files>

# Comment-only code edits (Slice 3):
cd lambda/ephemera && npm run test -- --watchAll=false dataSource/positions/ludicGraph/ dataSource/positions/ludicCache/
```

The link check tests paths only, not anchors. Check by hand any anchor link into a heading this plan renames.

**Payoff check (the user's):** a cold read of `AGENT.ludicNetwork.md` sections 1 and 4 and `AGENT.concepts.md`'s *Presence as a cover* gives the right picture: rooms are grouped in Areas, a room is where perspective stops, and the remainder model is named as unbuilt.

## Progress

| Slice | Status |
| --- | --- |
| 0. Verify premises | In progress (two of three premises verified) |
| 1. Record the decision | Done 2026-10-11 |
| 1b. Open the implementation plan | Done 2026-10-11 (plan opened) |
| 2. Amend rows | Not started |
| 3. Correct docs and comments | Not started |
| 4. Close | Not started |
