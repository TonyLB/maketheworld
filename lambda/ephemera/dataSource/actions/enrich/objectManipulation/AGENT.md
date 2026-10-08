# Object manipulation parse pipeline

This folder owns post-classify enrichment for **`ObjectMembershipIntent`** and **`ObjectRelateIntent`**: grounding player language to trusted ids, deciding atomic membership vs relational complexity, and compiling terminal parse payloads.

Parent docs:

- Actions implementation (field tables, egress, playbooks): [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-b25-split-intents)
- Enrich module inventory: [`../AGENT.md`](../AGENT.md)
- LLM design (two axes): [`../../../llm/AGENT.concepts.md`](../../../../llm/AGENT.concepts.md), [`../../../llm/AGENT.contract.md`](../../../../llm/AGENT.contract.md)
- Operator semantics: [`../../../diegeticLogic/AGENT.operators.concepts.md`](../../../../diegeticLogic/AGENT.operators.concepts.md)

Orchestration lives in [`parseCommand.ts`](../../parseCommand.ts); this folder is the enrich compiler surface, and its one producer is [`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts).

## Pipeline architecture

**Trust posture:** enrich identity/selection is **fault-tolerant** (ranked `SpanCandidatePool` + propose-N + FT-5 selector -> auto-resolve, **Consult**, or **Abstain**). **Terminal parse** and **positions ingress** remain **trusted-output** --- a single grounded winner, or a terminal Consult/Abstain/Error before any stream. Classify family routing is still trusted-output (BD-11 live; FT-7 reunify is Phase C). Vocabulary: [`../../../llm/AGENT.concepts.md`](../../../../llm/AGENT.concepts.md) (**Output trust models**). Pool recommender details: [`embeddingMatch/AGENT.md`](embeddingMatch/AGENT.md).

### Recovery patterns (per hop)

| Pattern | Where | Shipped behavior |
| --- | --- | --- |
| **Supplement** | Catalog / embed ingress | Room + held catalogs and `EMBEDDING#IMPROMPTU` attached before identity; future `withinObject` pool expand (deferred) |
| **Correct** | Dry-run + existence guard | Locus legality and referential integrity reject illegal tuples; never vacuum-fill a missing id |
| **Backtrack** | Selector decline | Thin-margin -> **Consult**; grey-band / unfit head -> **Abstain** --- not identity-LLM retry |

Orchestration is **single-pass** this iteration (propose-N + pure selector + guard). Re-entrant closed-loop (container-contents supplement) is a future `llm/pipeline/` concern, not Gateway-blocking.

### Target handoff artifacts (FT-0 skeleton)

**Runtime (FT-2.2 + FT-3.3, 2026-07-10; relational route replaced 2026-07-19, see "Relational branch" below):** identity stage emits `SpanCandidatePool[]`. **Membership** path: deterministic propose-N + FT-5 tuple selector (`selectMembershipFromPool`); thin-margin ambiguity egresses terminal **`Consult`** ([`ParseCommandConsultResult`](../../baseClasses.ts)); grey-band / unfit head egresses terminal **`Abstain`** ([`ParseCommandAbstainResult`](../../baseClasses.ts)); policy / legality / validator defer stay **Error**. **Relational** path (native Parse-skeleton pipeline, [`compileAttemptsFromSkeleton`](compileAttemptsFromSkeleton.ts)): a deterministic Plan-stage template match over Parse's tokenized skeleton, then Identify -> Grounding -> Validation over the matched `Referent`s; Consult/Abstain/Error/EstablishRelation from the same function. Bridge [`selectSingleSpanFromPool`](selectSingleSpanFromPool.ts) retired from production (harness only). Complexity LLM remains a live interim hop (membership path only) until Phase C **C4**; the relational path's own interim hop (frame extract) was retired outright 2026-07-20, superseded by Parse.

FT-4 span-resolution types live in [`spanResolution.ts`](spanResolution.ts):

| Type | Role |
| --- | --- |
| `SpanCandidatePool` | Input evidence: ranked `candidates[]` per span (no `status` field) |
| `ObjectSpanCandidate` | One catalog object with relevance fields + deterministic `locus` |
| `SpanResolutionOutcome` | Selector verdict: `resolved` \| `consult` \| `error` (FT-5 selection point; Abstain is terminal-parse only) |

Outcome mapping from legacy identity / embedding types to pool + selector verdicts is documented in [`spanResolution.ts`](spanResolution.ts) guards and the production path above. Terminal **`Consult`** / **`Abstain`**: [`../../baseClasses.ts`](../../baseClasses.ts) (membership + relational egress + actions handlers).

### Abstain vs Consult vs Error (membership + relational)

| Outcome | When | Owner |
| --- | --- | --- |
| **Consult** | Thin margin among legal tuples; catalog-backed `alternatives` | FT-5 selector only |
| **Abstain** | Grey-band below `T_JOINT_*` floor; unfit head; no catalog-backed menu | Deterministic propose-N / selector decline |
| **Error** | Illegal dry-run, existence guard, cardinality, `multiPresent`, complexity defer interim, relational legality | Validator / pre-gates --- never Consult |

Invariant: dry-run `defer` and closed-world fast-path **must not author Consult**. LLM joint proposer + hop retirement deferred to Phase C.

Both branches follow one shape --- plans × identity candidates -> ground -> expand -> adjudicate -> validate -> select ([`../../AGENT.concepts.md`](../../AGENT.concepts.md#pipeline-shape)). Production runs a **branching sequence** after classify: **`enrichRoute: 'membership'`** -> `compileMembershipAtomic`, or **`enrichRoute: 'relational'`** -> Parse (tokenized command skeleton, upstream in [`parseCommand.ts`](../../parseCommand.ts)) -> [`compileAttemptsFromSkeleton`](compileAttemptsFromSkeleton.ts). Read this section for **what each phase is for**; step names, guards, and parsers live in source.

### Conceptual flow (classify through terminal parse)

**0. Catalog ingress (deterministic context packaging)**  
Before classify or enrich, **`handleParseRequested`** ([`index.ts`](../../index.ts)) parallel-fetches the actor's **room object catalog** and **held inventory catalog**, then batch-loads **`EMBEDDING#IMPROMPTU`** vectors via **`internalCache.ObjectEmbedding.get`** and attaches them to catalog entries ([`attachEmbeddingsToCatalogEntries`](../../attachEmbeddingsToCatalogEntries.ts)) before **`parseCommand`**. This is not a Bedrock hop; it packages authoritative catalog slices (with optional embeddings) for identity and (on the relational path) frame-extract context.

**Known gap (documented debt, found 2026-09-11; walk mechanism replaced 2026-09-18, gap itself carried forward unchanged by choice).** Catalog ingress is **exhaustive through nesting and does not filter by presence bucket.** Through `ludicCache` rebuild Slice 3, this walk was `collectNestedObjectIds`, a flat recursion into each object's own `ludicGraph` (`hostGraph.objectIds` wholesale, depth-capped at 5, no port/binding/bucket ever read). **As of rebuild Slice 4, `getRoomObjectCatalogForCharacter` instead builds a `ludicCache` (`buildLudicCache`, via the thin handler [`ludicCache/catalogHandles.ts`](../../../positions/ludicCache/catalogHandles.ts)) and reads its component nodes.** `collectNestedObjectIds` itself survives, relocated to [`objects/collectNestedObjectIds.ts`](../../../objects/collectNestedObjectIds.ts), for the Coyote bulk clear's exhaustive presence-blind world enumeration only --- it is no longer in the candidate-pool path.

**The gap does not close with the mechanism swap --- this was a deliberate choice, not an oversight.** The cache is presence-structured internally (every component node's bucket membership is knowable from `cover`), but Slice 4's handler still returns every object node the walk reaches, unfiltered, matching the old walk's scope exactly. Each handle does carry every bucket it is seen in (`presence`, which Grounding stamps onto referents as `groundedPresence` for narration audiences), but that records where a thing is seen and drops nothing. Two consequences, and only the first is live:

1. **Decomposition adds referents without removing any.** A decomposed flashlight puts battery, casing and bulb in the pool **alongside** the flashlight, and nothing selects a level, so a whole and its parts compete as candidates. This is the read-path half of **AB-9** ([abstraction layers](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)), and it is reachable today for any object that hosts a graph (`put cup on table`, CD2h).
2. **A straddling whole would contribute every part, at every binding.** Presence is a cover indexed by **binding**, not by host ([`AGENT.concepts.md`](../../../positions/AGENT.concepts.md#presence-as-a-cover)), so the nodes present at one host are a bucket --- but the cache walk visits each host once regardless of how many bindings it carries, and the Slice 4 handler reads every one of its object nodes unconditionally. **Still latent** because no shipped writer produces a multi-bucket graph yet ([`presenceSubGraph.ts`](../../../positions/ludicGraph/presenceSubGraph.ts) header) --- but the fix, when built, is now a filter on `ludicCacheObjectHandles`'s own output against a caller's `cover`, not a rewrite of the walk.

**Do not read the pool as covering this.** A pool's candidates come from the ingress catalog, so "in the pool" means "in the ingress catalog," which is unrelated to the presence cover.

**Open question, not decided:** whether level selection belongs at pool construction (filter to a bucket), at ranking ([`buildSpanCandidatePool`](embeddingMatch/buildSpanCandidatePool.ts)), or later. Note that the third is constrained --- attention must not reach [`decideEmbeddingMatch`](embeddingMatch/decideEmbeddingMatch.ts).

**1. Classify fast path (deterministic @ classify)**  
When the command matches a **closed syntactic template** (`take` / `drop` / `get` + noun, with label gate for `get` vs Acme), code synthesizes **`ObjectMembershipIntent`** with **`verbClass`** and **`objectSpans`** and **skips** Bedrock classify. The owning stage is still classify; the outcome shape matches the LLM path.

**2. Classify LLM (semantic reasoning)**  
When the fast path does not apply, the model chooses **topology**:

- **`ObjectMembershipIntent`** --- membership **host transfer** (which **`ludicGraph`** node hosts the object). Emits **`objectSpans`** and membership **language direction** **`verbClass`** (`acquire` | `release`). Does **not** emit **`operationKind`**.
- **`ObjectRelateIntent`** --- **in-host relational edge** between objects on the actor's current room graph. Emits **`objectSpans`** only (no **`verbClass`**). Does **not** emit relational **`operationKind`** or role-tagged frames.

**Handoff:** intent **`type`**, **`rawObjectSpans`**, optional **`verbClass`**, **`confidence`**; catalogs and **`hostRoomId`** from parse ingress. Tie-breakers (e.g. **`ObjectRelateIntent`** beats **`ObjectMembershipIntent`** when the line establishes an in-host relation) live in [`discriminateIntent/buildIntentClassificationPrompt.ts`](../../discriminateIntent/buildIntentClassificationPrompt.ts).

**3. Enrich route (deterministic)**  
[`parseCommand`](../../parseCommand.ts) hands every Plan attempt to [`compileAttemptsFromSkeleton`](compileAttemptsFromSkeleton.ts) in one call (ISS8203 slice 4: no `enrichRoute` tag and no primary-step dispatch). The producer classifies each attempt by its own content. Membership path runs a **cardinality gate** (`multiObject` Error when the skeleton names more than one object span). Relational path has no cardinality gate at entry; Plan derives structure from Parse's skeleton (deterministically for containment; peer relations await the LLM fallback).

---

#### Transfer branch (take, drop, containment: `compileAttemptsFromSkeleton`)

ISS8203 slice 3. Take, drop and containment (`put X on/in Y`) share one route, one producer and one dry run. The route is [`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts). A take or drop is a whole-object transfer with no containment argument, and its result is the membership arm. A containment move carries the argument and returns the containment arm. `parseCommand` reaches the route in two ways: a `take`/`get`/`drop` fast path synthesizes its skeleton (leading verb plus one object span, stamped) and enters Plan like a parsed command, and a parsed `transferMembership` attempt goes straight in.

**4. Identify, Enumerate, Ground, describe (shared).** Identify runs once per `stableRefKey` over the skeleton's spans ([`identifySkeletonSpans.ts`](identifySkeletonSpans.ts)). [`proposeAttemptCandidates`](attemptCandidates.ts) enumerates the joint assignments, drops any that bind one step's two spans to one object, grounds each, and describes it (Consult wording and the prose).

**5. Expansion and Adjudicate (shared, every transfer).** [`expandAndAdjudicateCandidates`](attemptCandidates.ts) reads the object's source host from the per-command environment. A `transferMembership` gets one facilitating dissolve per boundary edge ([`attemptActionsFromTransfer`](../../commandAttempt/expandBoundaryChallenges.ts)), and an exit-contact challenge when the object touches an exit (a graph challenge that stays pending). A boundary edge that crosses a shard boundary (a port-qualified end) is followed through the chain to its true far end (`findRelationalChainFromLeg`, over the environment's graphs), and each end's `groundedPresence` is read from the shard holding that end's own leg; a chain the environment cannot walk gets no dissolve, and commit refuses the move as uncovered. Adjudicate then records *met* on each `Custom`-edge challenge ([`adjudicate.ts`](../../commandAttempt/adjudicate.ts)).

**6. Dry run and transfer preconditions (shared).** [`attemptDryRun`](attemptCandidates.ts) grounds each step and checks the transfer's preconditions before it runs the executor:

| Precondition | Refusal |
| --- | --- |
| The moved object is in exactly one host | `multiPresent` (multi-host) or `noMembershipHost` (none) |
| `from` is the host the object is actually in (a drop's `from` is the actor) | `notCarryingObject` (drop of something not held), else `noMembershipHost` |
| `from` differs from `to` | `alreadyHoldingObject` |

A pending challenge defers and a refused one is illegal, so every doubt about a move is a challenge, and "defer" means only a challenge left pending.

**7. Selection and the deferred tier (shared).** [`selectPlanTuple`](selectPlanCandidate.ts) partitions legal from illegal, then applies floor and margin to the legal survivors. A defer goes once to the deferred adjudication tier ([`adjudicateDeferred`](../../commandAttempt/adjudicate.ts)), which judges nothing today, so the candidate abstains. The complexity LLM is retired: a take or drop with a pending graph or exit challenge abstains until the deferred tier has a real judge.

**Handoff:** a take or drop returns `ObjectManipulation` (`operationKind`, `objectIds`, `attempt`), and containment returns `ObjectContainment`. Terminal **`Consult`** (catalog-backed ambiguity), **`Abstain`** (grey band, a pending challenge, or a containment failure), or **`Error`** (take or drop failures, multi-object arity, no room).

**Known gap (documented debt):** a take or drop with a pending graph or exit challenge abstains instead of reaching a judge. That is the accepted interim until the deferred tier's LLM adjudicator lands.

---

#### Relational branch (native Parse-skeleton pipeline, `compileAttemptsFromSkeleton`)

**Status (2026-10-06):** no deterministic step produces a peer relation. Peer `establishRelation`/`dissolveRelation` attempts reach this branch only from Plan's LLM fallback, which is not built, so a peer relation command answers `Unimplemented` until it lands. Containment never reaches here (it is a transfer, see the transfer producer).

**Retired 2026-07-20:** the original frame-extract LLM + `compileRelational.ts` + `selectRelationalFromPools.ts` + `proposeRelationalTuples.ts` chain (steps 9-13 as they read before this date) is deleted outright, not merely superseded (retirement history in git; iteration 3 / BD-21 in the [iteration ladder's BD-N index](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectManipulationIterations.planning.md)). The pipeline below is the sole live relational path, per BD-21/BD-22/BD-23's design (Identify/Plan/Synthesize decomposition, [`../../AGENT.concepts.md`](../../AGENT.concepts.md)).

**9. Parse (semantic reasoning, upstream of this folder)**  
**Purpose:** [`parseCommand.ts`](../../parseCommand.ts)'s `ObjectRelateIntent` branch calls [`runParseStage`](parse/runParseStage.ts) unconditionally, turning player language into an ordered **`ParseSkeleton`** --- a sequence of `{ type: 'objectSpan', span, stableRefKey } | { type: 'text', text }` tokens ([`parse/parseToken.ts`](parse/parseToken.ts)). `stableRefKey` (assigned deterministically by [`stampStableRefKeys.ts`](parse/stampStableRefKeys.ts), never by the LLM) lets two identical-text spans ("put bench on bench") stay distinguishable by occurrence, not just array position. No role tagging (subject/target/verb) happens here --- that's Plan's job, step 10. No fallback to the retired frame-extract flow on Parse failure; the branch abstains or errors outright.

**Handoff:** `ParseSkeleton` -> `compileAttemptsFromSkeleton`'s `input.skeleton`.

**10. Plan-stage template match (deterministic, containment only)**  
Plan has no peer-relation template. The deterministic match left in this branch is [`plan/matchContainmentTemplate.ts`](plan/matchContainmentTemplate.ts): `put`/`place` + in/inside/into or on/onto/on top of builds the `transferMembership` with its `containment` kind. Each fast-path template (containment, and membership's take/get/drop) also authors the narration unit over the action it creates (AN-3): copy from a closed per-template verb map and, for containment, the matched preposition phrase (never the raw text run), one audience over the actor and every referent, *before*. Parse is unchanged (BD-21). Outcomes: `matched` (an ungrounded attempt) or `noMatch`. A skeleton with no containment match, including every peer relation, yields zero attempts and `Unimplemented`. Peer `establishRelation`/`dissolveRelation` come only from Plan's LLM fallback, which is not built.

**Open question, carried forward (found live 2026-09-02 during the edge-chain vertical's `tie string to cup` run):** a peer relation's `relationLabel` must carry the verb as well as the preposition (`tie` + `to`, not `"to"`), because the retired perception fan-in narrated a `Custom` relation from its label. Narration no longer reads the label: whatever creates a relational action authors its narration unit (`AGENT.attemptNarration.planning.md`), so the label's remaining readers are graph-side (challenge descriptions, `Custom` edge identity). The deterministic template that exposed the gap is deleted; the LLM fallback now owns both the label and, when it lands, the establish's narration unit. Open: how the fallback captures verb+preposition together in the label.

**11. Identify (pool resolution)**  
[`runIdentityStageOverSkeleton`](identifySkeletonSpans.ts) resolves the skeleton's `objectSpan` tokens via room **and held-inventory** catalog pools (`mergeObjectManipulationCatalogs` tags entries `'room'`/`'held'`, room taking precedence on an id collision --- unchanged from the retired path's BD-15/16 slice 4b widening), reusing the shared [`identityStage.ts`](identityStage.ts) resolver, then rekeys its positional output onto each token's `stableRefKey` (a `ReadonlyMap<string, SpanCandidatePool>`) rather than array position.

**12. Grounding (joint candidate space, producer/stage split, 2026-10-01)**  
[`proposeAttemptCandidates`](attemptCandidates.ts) (the shared producer, ISS8203 slice 2) reads Identify's pools directly, keyed by the matched `Change`'s own `subject`/`target` `stableRefKey`s and filtered to Object candidates, forms the joint assignments through [`enumerateIdentityAssignments`](enumerateIdentityAssignments.ts) (`min`-of-`jointRelevance` confidence, same enumerator membership's producer uses), then grounds each assignment in one total pass (`groundChange`, `synthesize/groundChange.ts` --- its assignment is already complete, since a relational `Change` has no derived referents at all) --- keeping Parse's real `stableRefKey`s on the attempt, not a synthesized key --- and builds the attempt per candidate, before Expand and the dry run (mirroring the membership route's own [slice 2.6](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.commandAttemptPhase.planning.md#recommended-order)). **Same-object combinations are kept, not rejected** (BD-23): identical-text same-position spans can legitimately both resolve to the same real object, and rejecting that a priori would be Grounding overstepping into a legality judgment that isn't its job --- the enumerator offers every combination. Each candidate's grounded `Change` is the edge, with no `host` (a host belongs to each leg of its chain), and seeds the executor directly; Expansion (12b, below) finds its chain. See [`synthesize/AGENT.implementation.md`](synthesize/AGENT.implementation.md#relational-edges-edge-chain-legs). **Describe** shares that producer too (`compileAttemptsFromSkeleton.ts`): it reads its one identity pool directly (the now-retired `objectCandidatesForSpan.ts` dropped `jointRelevance`, which `enumerateIdentityAssignments` needs) and reuses the same enumerator with a single key, so confidence is just that key's own `jointRelevance`; it never constructs a derived referent, so there is nothing for a `ReferentAssignment`'s two-namespace shape to add, and its one `CommandAttempt` action is a `NarrateAttemptAction` rather than a `PlanStep`-carrying one, since describing is not a world mutation. **Containment** shares that producer (`compileTransferFromSkeleton.ts`, with take and drop): it reads `spanPools` directly and reuses the same `enumerateIdentityAssignments` and self-relation guard. Unlike relational, its `transferMembership` step *does* have a derived referent (`from: currentHost(subject)`), so grounding is deferred entirely to commit-time (`commitAttempt`'s generic resolution), mirroring membership's own deferred grounding rather than relational's eager one-pass grounding.

**12b. Expansion (BD-16 sameHost, walk-then-build)**  
Between Grounding and Validation, [`expandSameHost`](synthesize/expandSameHost.ts) decides where each grounded candidate's relation lands, from the subject's and object's *real* current hosts rather than the BD-6 room default Grounding assigned. **`establishRelation` and `dissolveRelation` now call genuinely different discovery primitives**, since they ask genuinely different questions of genuinely different state: for `establishRelation`, it walks *containment ancestry* ([`findShardBoundary`](synthesize/findShardBoundary.ts), via `positionsReadDeps.getMembershipContainers`) then builds ([`buildCrossingLegs`](synthesize/buildCrossingLegs.ts)) --- an already-shared host resolves to a zero-hop common ancestor and a single portless leg (an endpoint is its own zero-hop ancestor), a genuine cross-shard pair mints crossing legs plus one `EphemeraCrossingPort`. For `dissolveRelation`, it walks *existing relational edges/ports* outward from the subject (or from the target, when only the target's host is known: Expansion's dissolve of a relation whose moved end is its target) instead ([`findRelationalChain`](synthesize/findRelationalChain.ts), via `ExpansionEnvironment`'s own `getGraph`/`getCurrentHost` --- already constructed on every route that reaches Expansion at all) --- a portless edge resolves to a one-leg chain (via the edge actually being found, not via ancestry coincidence), and a genuine crossing dissolve (a chain including a port hop) is found whole. Either way the result is the chain as a value; [`lowerRelationalChain`](synthesize/buildCrossingLegs.ts) turns the chosen candidate's chain into kernel steps after selection (each edge to `establishRelation`/`dissolveRelation`, each port to `addCrossingPort`/`removeCrossingPort`, in chain order). `findRelationalChain` is rebuilt on top of a new leg-seeded sibling, `findRelationalChainFromLeg` (same file): given a specific edge already in hand, it walks outward from *both* of its terminals to their true endpoints, needed for chain-aware object removal (positions-side, no pre-known subject/target) --- `findRelationalChain` is now "find the candidate first edges at the subject, resolve each via `findRelationalChainFromLeg`, keep the one whose far end is the target." This also fixed a real directional bug: the old single-direction walk could only correctly continue a chain exterior-to-interior, never interior-to-exterior (see `findRelationalChainFromLeg`'s own doc comment), which a take of a crossing's interior end now reaches. An `establishRelation` whose relation already holds (`findRelationalChain` finds it, same-host or crossing) errors with "is already present" before anything is built: a same-host patch would be idempotent but the attempt would still narrate, and a crossing's freshly minted port ids would commit a parallel chain. `findRelationalChain`'s `notFound`/`ambiguous` verdicts (the latter decline rather than pick, when more than one qualifying chain exists) both fall through to the same defer path establish's `notFound`/`ambiguous` does, with dissolve-specific reason wording. Hosting kinds (`On`/`In`/`PartOf`) error outright (CD2h): a hosting relation is a membership move, not a relational placement, and has no branch here. `defer` (`Custom`-relation violations, or a peer relation whose boundary/chain is unreachable, ambiguous, or an unsupported shape) surfaces as a terminal `Abstain` (step 13, below) rather than a candidate the route can hand to a complexity LLM, since this route has no LLM-fallback path yet. There is no repair outcome any more --- the old `transferMembership`-insertion path was retired entirely, 2026-09-01, so a violated relation never relocates either endpoint. **Live reach on this route today:** the ingress route ([`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts)) eagerly pre-fetches each candidate's full containment ancestry, depth-capped at 5 (`walkAncestryContainers`, `synthesize/findShardBoundary.ts`), so `findShardBoundary` can reach a common ancestor past an intermediate host, not just a directly-shared one --- both the already-shared-host case and a genuine cross-shard boundary now resolve to the right verdict on the establish side. This route carries every step of the lowered chain (port(s) plus every leg, in chain order) into the attempt, which the route returns as [`ParseCommandCommandAttemptResult`](../../baseClasses.ts) (ISS8203 slice 4). The lowered chain is no longer on the result: commit lowers the attempt, so a genuine crossing is not discarded at this route. **Both establish and dissolve now land live end to end:** the published payload carries the full step chain for either operation kind, and `executeEstablishEdgeChain` (`operationKind`-agnostic despite its name) is the one commit path for both.

**13. Terminal compile (deterministic, selection via `selectPlanTuple`)**  
There is no construction-time Validation on this route: a candidate whose Expansion found a chain is legal, and the kernel rechecks every leg against locked live state at commit. Endpoint presence would only re-check the chain Expansion just built, and world consistency (cycles, contradicting relations) is a later planner's judgment, not a construction check. The one rule this route enforces sits earlier, in the producer: a relation joins two different objects, so an assignment that grounds subject and target to the same object is never a candidate. `compileAttemptsFromSkeleton` dry-runs every grounded candidate (`attemptDryRun` in `attemptCandidates.ts`, wrapping the Expansion + hosting-kind checks above as a `DryRunOutcome`) and ranks the legal survivors through the same FT-5 `selectPlanTuple` membership uses (`selectPlanCandidate.ts`), confidence already carried by `RelationalGroundedCandidate` (`min`-of-`jointRelevance`) --- replacing the old `candidates[0]` placeholder (BD-25's structural half). It emits **`EstablishRelation`** (resolved), **`Consult`** (thin margin --- `relationalConsultAlternative` builds "put the X {preposition} the Y" / "separate the X from the Y" wording from the candidate's labels), or **`Abstain`** (no template match, an unfit head, or a Grounding/Expansion `defer` --- this route still has no complexity LLM to hand a `defer` to, so it abstains rather than re-grounding, unlike membership), or **`Error`** (policy/legality, upstream of selection).

---

**In one sentence:** classify **membership vs relational topology** and language direction, **ground** object references via pool + FT-5 selector (membership) or Parse-skeleton Identify/Grounding (relational), **close** simple membership atomics from locus legality or **defer** when exit edges complicate the host, **match** containment deterministically over Parse's tokenized skeleton (peer relations have no deterministic match; they come from the LLM Plan fallback), then **auto-resolve** to trusted terminal parse, or emit terminal Consult / Abstain / Error before commit.

### Field ownership (quick reference)

| Field | Owning stage | Lane |
| --- | --- | --- |
| Intent **`type`** (`ObjectMembershipIntent` \| `ObjectRelateIntent`) | Classify | Semantic |
| **`verbClass`** | Classify (**membership only**) | Semantic |
| **`objectSpans`** / **`rawObjectSpans`** | Classify no longer extracts these for object-manipulation intents (retired 2026-07-20); Parse ([`parse/runParseStage.ts`](parse/runParseStage.ts)) tokenizes into a `ParseSkeleton` on both routes | Semantic (Parse) |
| Membership **`operationKind`** (`takeHold` \| `drop`) | Verb-intended propose-N, then the shared selector's legality partition (ISS8203 slice 3); a deferred take or drop abstains (no complexity LLM) | Deterministic |
| Relational **`operationKind`** (`establishRelation` \| `dissolveRelation`) | Plan's LLM fallback (**BD-12**'s verb classification; no deterministic producer, not yet built) | LLM |
| **`relationKind`** / **`relationLabel`** | Plan's LLM fallback (peer `Custom` + label) | LLM |
| Grounded **`objectId`** / **`subjectId`** / **`targetId`** | Identity pool + FT-5 tuple selector (FT-2.2 membership / FT-3.3 relational) | Deterministic + embed rank |

Normative rules: [`llm/AGENT.contract.md`](../../../../llm/AGENT.contract.md) (**Deterministic enrich boundary**).

### Bedrock budget (after classify)

| Path | Typical hops |
| --- | --- |
| Membership | **0** when exact identity succeeds; **+1 Titan embed** per distinct span on exact miss. Identity LLM retired (FT-2.1); complexity LLM retired (ISS8203 slice 3). |
| Relational | **+1** Parse (tokenized skeleton, BD-21); **0--2** Titan embeds (per distinct span on exact miss). Identity LLM retired (FT-2.1); frame extract retired (2026-07-20). |

Eligible exact-name, single-span, single-host, exit-edge-free **`takeHold`** / **`drop`** may need **zero** post-classify Bedrock calls.

### Interaction under transfer

[`interactionUnderTransfer.ts`](../../../positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) classifies every relational edge that crosses a move's boundary (one endpoint moves, the other stays), by relation kind. Every peer edge defers whichever end moves, so the adjudicator decides whether a severed edge matters (clearance under a table, a rope still lashed to a post; the manner rule in [`positions/AGENT.contract.md`](../../../positions/AGENT.contract.md#relation-kind-enum-bd-2)):

| Relation kind | Subject moves | Target moves |
| --- | --- | --- |
| `Custom` | Defer | Defer |
| `On` / `In` / `PartOf` | Throws (AB-54) | Throws (AB-54) |

Hosting kinds never reach the table legitimately: a hosted thing lives in its host's own shard and travels with it, so "take the tray" moves the glass on it without any edge to classify. A hosting-kind edge on the exterior graph means a producer built a graph the constructor does not author, so the classifier throws.

**Construction vs. validation.** Three callers read the table, and none grows the moved set:

- **At Expand**, before scoring, [`attemptCandidates.ts`](attemptCandidates.ts)'s `expandAndAdjudicateCandidates` records the table on each already-grounded transfer's attempt: one facilitating action per boundary edge, with a graph challenge on each `defer`, plus an exit-contact challenge ([`commandAttempt/expandBoundaryChallenges.ts`](../../commandAttempt/expandBoundaryChallenges.ts)). Adjudicate then records *met* on each `Custom`-edge challenge ([`commandAttempt/adjudicate.ts`](../../commandAttempt/adjudicate.ts)), including a subject-move: the adjudicator meets it whether it means clearance or a pinned relation, since the graph cannot tell them apart.
- **At selection**, [`attemptDryRun`](attemptCandidates.ts) reads the attempt's result: `pending` defers, and `succeeded` checks the transfer's preconditions and lowers the attempt through the Synthesize executor, its facilitating dissolves first ([`synthesize/executor.ts`](synthesize/executor.ts)'s `seedFromGroundedSteps`), over the per-command environment. The executor does not read the table.
- **At commit**, positions' `buildObjectMoveOp` classifies again from the departure host's graph, dissolving each `dissolve` cell and each `defer` edge the published attempt recorded as met, and the commit re-validates on the locked graphs, so a change since selection is caught rather than applied.

The table lives in `positions/ludicGraph/expandValidate/`, a location neither the actions compiler nor the kernel owns, so that every caller shares one legality authority.

**Scope of the table:** `interactionUnderTransfer.ts` decides what happens to an *existing* relation when one of its endpoints *transfers*. It only ever governs `transferMembership`-driven changes; `establishRelation`/`dissolveRelation` create or remove an edge directly and never consult it.

## Key files

| Area | Files |
| --- | --- |
| Entry + route | [`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts) --- one entry for every attempt (slice 4); the wrapper `index.ts` is retired. **BD-20 (2026-07-17):** [`cardinalityGate.ts`](cardinalityGate.ts) is no longer called here; the membership multi-span arity check now lives in [`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts), right after Identify succeeds, since Identify itself resolves any number of independent spans fine --- the actual gap is unbuilt Plan-side composition (BD-8/C2/C3), not Identify. `cardinalityGate.ts`'s pure function and its own unit tests are unchanged, just uncalled from this file. |
| Identity + selector | [`identityStage.ts`](identityStage.ts), [`resolveCatalogSpanToPool.ts`](resolveCatalogSpanToPool.ts), [`enumerateIdentityAssignments.ts`](enumerateIdentityAssignments.ts) (route-agnostic joint assignments over pools by `stableRefKey`), [`validatePlanDryRun.ts`](validatePlanDryRun.ts) (the dry-run outcome types), [`selectPlanCandidate.ts`](selectPlanCandidate.ts) (the shared `selectPlanTuple`), [`selectSingleSpanFromPool.ts`](selectSingleSpanFromPool.ts) (harness only), [`resolveObjectSpan.ts`](resolveObjectSpan.ts), [`embeddingMatch/`](embeddingMatch/) |
| Relational (native Parse-skeleton pipeline, replaces frame extract + `compileRelational` retired 2026-07-20) | [`parse/runParseStage.ts`](parse/runParseStage.ts), [`parse/parseToken.ts`](parse/parseToken.ts), [`parse/stampStableRefKeys.ts`](parse/stampStableRefKeys.ts), [`identifySkeletonSpans.ts`](identifySkeletonSpans.ts) (calls [`identityStage.ts`](identityStage.ts) directly, rekeyed onto `stableRefKey`), [`enumerateIdentityAssignments.ts`](enumerateIdentityAssignments.ts) (route-agnostic joint assignments, shared with membership, containment and Describe), [`synthesize/groundChange.ts`](synthesize/groundChange.ts), [`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts) (the route's entry checks and result arm, over the shared producer and dry run in [`attemptCandidates.ts`](attemptCandidates.ts)) --- does **not** use the Phase C sandbox (`sandboxState.ts`/`sandboxStep.ts`/`sandboxPlan.ts`, membership-route only), see "Phase C sandbox" above |
| Transfer (take, drop, containment) | [`compileAttemptsFromSkeleton.ts`](compileAttemptsFromSkeleton.ts) (the route's entry checks and result arms, over the shared producer [`attemptCandidates.ts`](attemptCandidates.ts): Enumerate, Ground, Expansion, Adjudicate, the transfer-precondition dry run; [`enumerateIdentityAssignments.ts`](enumerateIdentityAssignments.ts) and [`commandAttempt/expandBoundaryChallenges.ts`](../../commandAttempt/expandBoundaryChallenges.ts) underneath). Plan's membership template is [`plan/matchMembershipTemplate.ts`](plan/matchMembershipTemplate.ts); Plan's containment template is [`plan/matchContainmentTemplate.ts`](plan/matchContainmentTemplate.ts). |
| Synthesize executor (shared by both routes above) | [`synthesize/AGENT.implementation.md`](synthesize/AGENT.implementation.md) --- worklist model + full file map (`executor.ts`, `executorTypes.ts`, `groundChange.ts`/`groundAssertion.ts`, `expandSameHost.ts`, `findRelationalChain.ts`, `buildCrossingLegs.ts`) |

## Tests

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts
```

Authority: [`../../../../AGENT.testing.md`](../../../../AGENT.testing.md).

## Navigation

- Full pipeline sequence + egress tables: [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-b25-split-intents)
- Identify / Plan / Synthesize decomposition (Target vocabulary): [`../../AGENT.concepts.md`](../../AGENT.concepts.md)
- Phase C--D planning (Plan IR, plan LLM): [`../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md) (Phase C unblocked --- Gateway exit complete; see **Phase C design debt** in that plan)
