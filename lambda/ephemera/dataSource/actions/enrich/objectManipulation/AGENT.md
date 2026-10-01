# Object manipulation parse pipeline

This folder owns post-classify enrichment for **`ObjectMembershipIntent`** and **`ObjectRelateIntent`**: grounding player language to trusted ids, deciding atomic membership vs relational complexity, and compiling terminal parse payloads.

Parent docs:

- Actions implementation (field tables, egress, playbooks): [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-b25-split-intents)
- Enrich module inventory: [`../AGENT.md`](../AGENT.md)
- LLM design (two axes): [`../../../llm/AGENT.concepts.md`](../../../../llm/AGENT.concepts.md), [`../../../llm/AGENT.contract.md`](../../../../llm/AGENT.contract.md)
- Operator semantics: [`../../../diegeticLogic/AGENT.operators.concepts.md`](../../../../diegeticLogic/AGENT.operators.concepts.md)

Orchestration lives in [`parseCommand.ts`](../../parseCommand.ts); this folder is the enrich compiler surface ([`index.ts`](index.ts)).

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

**Runtime (FT-2.2 + FT-3.3, 2026-07-10; relational route replaced 2026-07-19, see "Relational branch" below):** identity stage emits `SpanCandidatePool[]`. **Membership** path: deterministic propose-N + FT-5 tuple selector ([`selectMembershipFromPool`](selectMembershipFromPool.ts)); thin-margin ambiguity egresses terminal **`Consult`** ([`ParseCommandConsultResult`](../../baseClasses.ts)); grey-band / unfit head egresses terminal **`Abstain`** ([`ParseCommandAbstainResult`](../../baseClasses.ts)); policy / legality / validator defer stay **Error**. **Relational** path (native Parse-skeleton pipeline, [`compileRelationalFromSkeleton`](compileRelationalFromSkeleton.ts)): a deterministic Plan-stage template match over Parse's tokenized skeleton, then Identify -> Grounding -> Validation over the matched `Referent`s; Consult/Abstain/Error/EstablishRelation from the same function. Bridge [`selectSingleSpanFromPool`](selectSingleSpanFromPool.ts) retired from production (harness only). Complexity LLM remains a live interim hop (membership path only) until Phase C **C4**; the relational path's own interim hop (frame extract) was retired outright 2026-07-20, superseded by Parse.

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

Both branches follow one shape --- plans × identity candidates -> ground -> expand -> adjudicate -> validate -> select ([`../../AGENT.concepts.md`](../../AGENT.concepts.md#pipeline-shape)). Production runs a **branching sequence** after classify: **`enrichRoute: 'membership'`** -> [`compileMembershipAtomic`](compileMembershipAtomic.ts), or **`enrichRoute: 'relational'`** -> Parse (tokenized command skeleton, upstream in [`parseCommand.ts`](../../parseCommand.ts)) -> [`compileRelationalFromSkeleton`](compileRelationalFromSkeleton.ts). Read this section for **what each phase is for**; step names, guards, and parsers live in source.

### Conceptual flow (classify through terminal parse)

**0. Catalog ingress (deterministic context packaging)**  
Before classify or enrich, **`handleParseRequested`** ([`index.ts`](../../index.ts)) parallel-fetches the actor's **room object catalog** and **held inventory catalog**, then batch-loads **`EMBEDDING#IMPROMPTU`** vectors via **`internalCache.ObjectEmbedding.get`** and attaches them to catalog entries ([`attachEmbeddingsToCatalogEntries`](../../attachEmbeddingsToCatalogEntries.ts)) before **`parseCommand`**. This is not a Bedrock hop; it packages authoritative catalog slices (with optional embeddings) for identity and (on the relational path) frame-extract context.

**Known gap (documented debt, found 2026-09-11; walk mechanism replaced 2026-09-18, gap itself carried forward unchanged by choice).** Catalog ingress is **exhaustive through nesting and does not filter by presence bucket.** Through `ludicCache` rebuild Slice 3, this walk was `collectNestedObjectIds`, a flat recursion into each object's own `ludicGraph` (`hostGraph.objectIds` wholesale, depth-capped at 5, no port/binding/bucket ever read). **As of rebuild Slice 4, `getRoomObjectCatalogForCharacter` instead builds a `ludicCache` (`buildLudicCache`, via the thin handler [`ludicCache/catalogHandles.ts`](../../../positions/ludicCache/catalogHandles.ts)) and reads its component nodes.** `collectNestedObjectIds` itself survives, relocated to [`objects/collectNestedObjectIds.ts`](../../../objects/collectNestedObjectIds.ts), for the Coyote bulk clear's exhaustive presence-blind world enumeration only --- it is no longer in the candidate-pool path.

**The gap does not close with the mechanism swap --- this was a deliberate choice, not an oversight.** The cache is presence-structured internally (every component node's bucket membership is knowable from `cover`), but Slice 4's handler still returns every object node the walk reaches, unfiltered, matching the old walk's scope exactly. Two consequences, and only the first is live:

1. **Decomposition adds referents without removing any.** A decomposed flashlight puts battery, casing and bulb in the pool **alongside** the flashlight, and nothing selects a level, so a whole and its parts compete as candidates. This is the read-path half of **AB-9** ([abstraction layers](../../../../../../taskPlanning/lambda/ephemera/dataSource/positions/AGENT.abstractionLayers.planning.md#open-decisions-design--plan-only)), and it is reachable today for any object that hosts a graph (`put cup on table`, CD2h).
2. **A straddling whole would contribute every part, at every binding.** Presence is a cover indexed by **binding**, not by host ([`AGENT.concepts.md`](../../../positions/AGENT.concepts.md#presence-as-a-cover)), so the nodes present at one host are a bucket --- but the cache walk visits each host once regardless of how many bindings it carries, and the Slice 4 handler reads every one of its object nodes unconditionally. **Still latent** because no shipped writer produces a multi-bucket graph yet ([`presenceSubGraph.ts`](../../../positions/ludicGraph/presenceSubGraph.ts) header) --- but the fix, when built, is now a filter on `ludicCacheObjectHandles`'s own output against a caller's `cover`, not a rewrite of the walk.

**Do not read [`existencePresenceGuard`](existencePresenceGuard.ts) as covering this.** Its *presence* means "the chosen id is in the ingress catalog," plus a `locus` scope check (room vs held) --- unrelated to the presence cover, and the name invites exactly this misreading.

**Open question, not decided:** whether level selection belongs at pool construction (filter to a bucket), at ranking ([`buildSpanCandidatePool`](embeddingMatch/buildSpanCandidatePool.ts)), or later. Note that the third is constrained --- attention must not reach [`decideEmbeddingMatch`](embeddingMatch/decideEmbeddingMatch.ts).

**1. Classify fast path (deterministic @ classify)**  
When the command matches a **closed syntactic template** (`take` / `drop` / `get` + noun, with label gate for `get` vs Acme), code synthesizes **`ObjectMembershipIntent`** with **`verbClass`** and **`objectSpans`** and **skips** Bedrock classify. The owning stage is still classify; the outcome shape matches the LLM path.

**2. Classify LLM (semantic reasoning)**  
When the fast path does not apply, the model chooses **topology**:

- **`ObjectMembershipIntent`** --- membership **host transfer** (which **`ludicGraph`** node hosts the object). Emits **`objectSpans`** and membership **language direction** **`verbClass`** (`acquire` | `release`). Does **not** emit **`operationKind`**.
- **`ObjectRelateIntent`** --- **in-host relational edge** between objects on the actor's current room graph. Emits **`objectSpans`** only (no **`verbClass`**). Does **not** emit relational **`operationKind`** or role-tagged frames.

**Handoff:** intent **`type`**, **`rawObjectSpans`**, optional **`verbClass`**, **`confidence`**; catalogs and **`hostRoomId`** from parse ingress. Tie-breakers (e.g. **`ObjectRelateIntent`** beats **`ObjectMembershipIntent`** when the line establishes an in-host relation) live in [`discriminateIntent/buildIntentClassificationPrompt.ts`](../../discriminateIntent/buildIntentClassificationPrompt.ts).

**3. Enrich route (deterministic)**  
[`parseCommand`](../../parseCommand.ts) sets **`enrichRoute`** from classify intent type and calls [`enrichObjectManipulation`](index.ts). Membership path runs a **cardinality gate** (`multiObject` Error when **`rawObjectSpans.length > 1`**). Relational path has no cardinality gate at entry; the deterministic Plan matcher (`matchRelationalTemplate`) derives structure from Parse's skeleton.

---

#### Membership branch (`compileMembershipAtomic`)

**4. Identity (pool + FT-2.2 selector)**  
**Purpose:** map classify **`objectSpans`** to a trusted catalog **`objectId`** + membership **`operationKind`** for a unary membership command.

- **Pool emission (FT-2.1):** per-span [`resolveCatalogSpanToPool`](resolveCatalogSpanToPool.ts) --- exact unique match -> single-candidate pool (`sourceTags: ['exact']`, `jointRelevance: 1`); duplicate exact labels -> multi-candidate pool with distinct `locus`; non-exact -> span embed + [`buildSpanCandidatePool`](embeddingMatch/buildSpanCandidatePool.ts).
- **Tuple selector (FT-2.2, 2026-07-10):** [`selectMembershipFromPool`](selectMembershipFromPool.ts) = [`proposeMembershipTuples`](proposeMembershipTuples.ts) (verbClass-intended op on each v1-locus candidate) -> [`groundMembershipCandidates`](groundMembershipCandidates.ts) (ground + expand: one `CommandAttempt` per tuple, with boundary-edge actions from the locus's graph) -> per grounded tuple, `sandboxMembershipDryRun` ([`validateMembershipPlanDryRun`](validatePlanDryRun.ts) locus legality, then the adjudicated attempt's result, then the Synthesize executor lowering it: Grounding, Validation; boundary-edge Expansion and Adjudicate already ran in `groundMembershipCandidates`) -> [`selectIdentityPlanTuple`](selectPlanCandidate.ts) (`T_JOINT_*` floor + margin) -> [`existencePresenceGuard`](existencePresenceGuard.ts). Illegal-if-wrong (e.g. "drop bag" with room bag + held satchel) drops illegal tuples before confidence ranking. Thin-margin -> selector `consult` -> terminal **`Consult`** with structured `alternatives` (FT-3.1); grey-band -> **`Abstain`** (FT-3.2).
- **Retired from production path:** per-span identity LLM; reject-only `verbMembershipAgreement` veto after a committed id (legality is now pre-select dry-run); bridge [`selectSingleSpanFromPool`](selectSingleSpanFromPool.ts) (harness only after FT-3.3).

**Handoff:** grounded **`objectId`** + **`operationKind`**, defer to complexity LLM (exit-edge interim until Phase C), terminal **`Consult`** (catalog-backed ambiguity), terminal **`Abstain`** (grey-band / noMatch), or terminal Error.

**5. Post-select observation + complexity pre-gates (deterministic)**  
After selector resolve, read authoritative **membership containers** and host **`ludicGraph`**. Exit-edge / non-atomic topology still defers to the complexity LLM (interim until FT-3 sandbox retirement):

| Outcome | Meaning |
| --- | --- |
| **Error** (`noMembershipHost`) | No membership host for the object |
| **complex** (`multiPresent`) | Object on multiple membership hosts |
| **atomic** | Selector-chosen op applies (no verbClass veto) |
| **deferToComplexityLlm** | Object touches an **exit edge** on its sole membership host, or host pattern is not closed by rules above |

**Steady-state intent:** anything whose membership-host graph includes an **exit edge** that references the object needs **added processing** beyond the simple room/character-host heuristic --- hence defer to the complexity hop. In-host **relational** edges alone do **not** trigger this defer; they are handled on the **`ObjectRelateIntent`** path or by future composition (Phase C).

**7. Agreement gate (retired on FT-2.2 atomic path)**  
Reject-only `verbMembershipAgreement` is **no longer** applied after selector resolve --- locus legality in the dry-run already rejects room+drop / held+takeHold. Module retained for unit tests / complexity-path debt.

**8. Complexity LLM (semantic reasoning, conditional)**  
**Purpose:** when post-select pre-gates **defer** (exit-edge), judge whether the player still intends a **simple membership atomic** (`takeHold` / `drop`) despite exit-edge topology on the host, or whether the command is **relationally complex** (`complexityClass: relationalPlacement` terminal stub on the membership path).

The hop receives grounded **`objectId`**, membership containers, and which **exit edges** touch the object --- not a full graph dump.

**Handoff:** atomic **`operationKind`** (`takeHold` / `drop`) or complex **`complexityClass`** (terminal Error via [`finalizeComplexityFromEnrich`](interpretAndFinalize.ts)).

**Known gap (documented debt):** the complexity path **does not** re-run locus dry-run agreement today. Per [`llm/AGENT.contract.md`](../../../../llm/AGENT.contract.md), treat missing reconciliation on this path as **fix later** --- FT-3 sandbox retirement is the intended cleanup.

---

#### Relational branch (native Parse-skeleton pipeline, `compileRelationalFromSkeleton`)

**Retired 2026-07-20:** the original frame-extract LLM + `compileRelational.ts` + `selectRelationalFromPools.ts` + `proposeRelationalTuples.ts` chain (steps 9-13 as they read before this date) is deleted outright, not merely superseded (retirement history in git; iteration 3 / BD-21 in the [iteration ladder's BD-N index](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectManipulationIterations.planning.md)). The pipeline below is the sole live relational path, per BD-21/BD-22/BD-23's design (Identify/Plan/Synthesize decomposition, [`../../AGENT.concepts.md`](../../AGENT.concepts.md)).

**9. Parse (semantic reasoning, upstream of this folder)**  
**Purpose:** [`parseCommand.ts`](../../parseCommand.ts)'s `ObjectRelateIntent` branch calls [`runParseStage`](parse/runParseStage.ts) unconditionally, turning player language into an ordered **`ParseSkeleton`** --- a sequence of `{ type: 'objectSpan', span, stableRefKey } | { type: 'text', text }` tokens ([`parse/parseToken.ts`](parse/parseToken.ts)). `stableRefKey` (assigned deterministically by [`stampStableRefKeys.ts`](parse/stampStableRefKeys.ts), never by the LLM) lets two identical-text spans ("put bench on bench") stay distinguishable by occurrence, not just array position. No role tagging (subject/target/verb) happens here --- that's Plan's job, step 10. No fallback to the retired frame-extract flow on Parse failure; the branch abstains or errors outright.

**Handoff:** `ParseSkeleton` -> `compileRelationalFromSkeleton`'s `input.skeleton`.

**10. Plan-stage template match (deterministic)**  
[`matchRelationalTemplate`](plan/matchRelationalTemplate.ts) pattern-matches the skeleton against a closed `TEXT<verb> OBJECTSPAN TEXT<prep> OBJECTSPAN` shape (`put`/`place`/`lean` -> `establishRelation`, `take`/`remove` -> `dissolveRelation`), reusing [`normalizeRelationSpan.ts`](normalizeRelationSpan.ts) for the preposition-to-`relationKind` half. Three outcomes: `matched` (an ungrounded `Change` with role-tagged `Referent`s, keyed by `stableRefKey`), `nestingDefer` (**`nestingRelational`** Error --- `in`/`inside`/`into`), or `noMatch` (**`Abstain`**, `relationalNoTemplateMatch`).

**Known gap (documented debt, found live 2026-09-02 during the edge-chain vertical's `tie string to cup` run):** `relationLabel` is fed only the preposition token (`prepToken.text`, e.g. `"to"`), never the verb (`tie`, `put`, ...), which is used solely to classify `establishRelation`/`dissolveRelation` and then discarded. `publishObjectManipulationPresentation.ts` narrates a `Custom` relation's verb straight from `relationLabel`, so the sentence reads on the bare preposition ("George to the cup") rather than a verb phrase ("George ties the string to the cup"). Predates this pipeline's own relational rewrite --- every fixture across the codebase hand-wrote a plausible `relationLabel` like `'tied to'` without round-tripping it through this matcher, so it had no live path to surface through until that run. Open question, not yet decided: hardcode a verb->label mapping for known verbs (`tie` -> `'tied to'`), or capture verb+preposition together generally at match time.

**11. Identify (pool resolution)**  
[`runIdentityStageOverSkeleton`](identifySkeletonSpans.ts) resolves the skeleton's `objectSpan` tokens via room **and held-inventory** catalog pools (`mergeObjectManipulationCatalogs` tags entries `'room'`/`'held'`, room taking precedence on an id collision --- unchanged from the retired path's BD-15/16 slice 4b widening), reusing the shared [`identityStage.ts`](identityStage.ts) resolver, then rekeys its positional output onto each token's `stableRefKey` (a `ReadonlyMap<string, SpanCandidatePool>`) rather than array position.

**12. Grounding (joint candidate space)**  
[`resolvedSpansFromPools`](resolvedSpansFromPools.ts) adapts Identify's pools into `groundReferent.ts`/`groundChange.ts`'s [`GroundingContext`](synthesize/groundReferent.ts). `groundChange` takes the Cartesian product across the matched `Change`'s `Referent`s, filtered only on type-correctness --- **same-object combinations are kept, not rejected** (BD-23): identical-text same-position spans can legitimately both resolve to the same real object, and rejecting that a priori would be Grounding overstepping into a legality judgment that isn't its job.

**12b. Expansion (BD-16 sameHost, walk-then-build)**  
Between Grounding and Validation, [`expandSameHost`](synthesize/expandSameHost.ts) decides where each grounded candidate's relation lands, from the subject's and object's *real* current hosts rather than the BD-6 room default Grounding assigned. **`establishRelation` and `dissolveRelation` now call genuinely different discovery primitives**, since they ask genuinely different questions of genuinely different state: for `establishRelation`, it walks *containment ancestry* ([`findShardBoundary`](synthesize/findShardBoundary.ts), via `positionsReadDeps.getMembershipContainers`) then builds ([`buildCrossingLegs`](synthesize/buildCrossingLegs.ts)) --- an already-shared host resolves to a zero-hop common ancestor and a single portless leg (an endpoint is its own zero-hop ancestor), a genuine cross-shard pair mints crossing legs plus one `EphemeraCrossingPort`. For `dissolveRelation`, it walks *existing relational edges/ports* outward from the subject instead ([`findRelationalChain`](synthesize/findRelationalChain.ts), via `ExpansionEnvironment`'s own `getGraph`/`getCurrentHost` --- already constructed on every route that reaches Expansion at all) then builds removal steps ([`buildCrossingDissolveLegs`](synthesize/buildCrossingLegs.ts)) --- a portless edge resolves the same single-step shape as before (now via the edge actually being found, not via ancestry coincidence), and a genuine crossing dissolve (a chain including a port hop) is buildable for the first time, mapping each discovered edge to `dissolveRelation` and each discovered port to `removeCrossingPort`, in discovery order. `findRelationalChain` is rebuilt on top of a new leg-seeded sibling, `findRelationalChainFromLeg` (same file): given a specific edge already in hand, it walks outward from *both* of its terminals to their true endpoints, needed for chain-aware object removal (positions-side, no pre-known subject/target) --- `findRelationalChain` is now "find the candidate first edges at the subject, resolve each via `findRelationalChainFromLeg`, keep the one whose far end is the target." This also fixed a real, previously-latent directional bug: the old single-direction walk could only correctly continue a chain exterior-to-interior, never interior-to-exterior (see `findRelationalChainFromLeg`'s own doc comment) --- not reachable from this route today (`subjectId` is always the exterior side here), but a genuine correctness fix regardless. `findRelationalChain`'s `notFound`/`ambiguous` verdicts (the latter decline rather than pick, when more than one qualifying chain exists) both fall through to the same defer path establish's `notFound`/`ambiguous` does, with dissolve-specific reason wording. Hosting kinds (`On`/`In`/`PartOf`) error outright (CD2h): a hosting relation is a membership move, not a relational placement, and has no branch here. `defer` (`Custom`-relation violations, or a peer relation whose boundary/chain is unreachable, ambiguous, or an unsupported shape) is dropped, since this route has no Consult/LLM-fallback path yet. There is no repair outcome any more --- the old `transferMembership`-insertion path was retired entirely, 2026-09-01, so a violated relation never relocates either endpoint. **Live reach on this route today:** the ingress route ([`compileRelationalFromSkeleton.ts`](compileRelationalFromSkeleton.ts)) eagerly pre-fetches each candidate's full containment ancestry, depth-capped at 5 (`walkAncestryContainers`, `synthesize/findShardBoundary.ts`), so `findShardBoundary` can reach a common ancestor past an intermediate host, not just a directly-shared one --- both the already-shared-host case and a genuine cross-shard boundary now resolve to the right verdict on the establish side. This route carries every step of the outcome (port(s) plus every leg, in production order) into the widened [`ParseCommandEstablishRelationResult`](../../baseClasses.ts) instead of taking only the first `establishRelation`/`dissolveRelation` step and dropping any candidate whose leg has a port-address endpoint --- a genuine crossing is no longer discarded at this route. **Both establish and dissolve now land live end to end:** the published payload carries the full step chain for either operation kind, and `executeEstablishEdgeChain` (`operationKind`-agnostic despite its name) is the one commit path for both.

**13. Validation + terminal compile (deterministic)**  
[`filterLegalRelationalCandidates`](synthesize/filterLegalRelationalCandidates.ts) runs [`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts)'s existing checks first (both nodes on the corrected host's graph via `bothObjectsOnGraph`; **`dissolveRelation`** requires a matching edge; **`establishRelation`** allows idempotent duplicate), then supplements it: each `On`/`Under` candidate's edge is simulated (`applyRelationalPatch`) and the resulting graph checked for an illegal cycle via [`detectRelationalCycle`](synthesize/detectRelationalCycle.ts) --- a self-relation is simply a one-node cycle, caught by the same general mechanism rather than a bespoke `subjectId === targetId` rule. One illegal candidate never invalidates the rest of the pool. `compileRelationalFromSkeleton` then picks `candidates[0]` (a **deliberately naive placeholder** --- real rank/confidence-based selection among multiple legal candidates is open design debt, BD-25 in the planning doc) and emits **`EstablishRelation`**, **`Abstain`** (no template match, or Grounding/Expansion/Validation decline --- no `Consult` path exists on this route today, unlike membership), or **`Error`**.

---

**In one sentence:** classify **membership vs relational topology** and language direction, **ground** object references via pool + FT-5 selector (membership) or Parse-skeleton Identify/Grounding (relational), **close** simple membership atomics from locus legality or **defer** when exit edges complicate the host, **match** a closed relational template deterministically over Parse's tokenized skeleton when the intent is in-host edges, then **auto-resolve** to trusted terminal parse, or emit terminal Consult / Abstain / Error before commit.

### Field ownership (quick reference)

| Field | Owning stage | Lane |
| --- | --- | --- |
| Intent **`type`** (`ObjectMembershipIntent` \| `ObjectRelateIntent`) | Classify | Semantic |
| **`verbClass`** | Classify (**membership only**) | Semantic |
| **`objectSpans`** / **`rawObjectSpans`** | Classify no longer extracts these for object-manipulation intents (retired 2026-07-20); Parse ([`parse/runParseStage.ts`](parse/runParseStage.ts)) tokenizes into a `ParseSkeleton` on both routes | Semantic (Parse) |
| Membership **`operationKind`** (`takeHold` \| `drop`) | FT-2.2 selector (locus legality + verb-intended propose-N); complexity LLM when deferred | Deterministic + semantic defer |
| Relational **`operationKind`** (`establishRelation` \| `dissolveRelation`) | Plan-stage template match ([`matchRelationalTemplate.ts`](plan/matchRelationalTemplate.ts), **BD-12**'s verb classification, now deterministic rather than LLM-derived) | Deterministic |
| **`relationKind`** / **`relationLabel`** | Relation normalizer | Deterministic |
| Grounded **`objectId`** / **`subjectId`** / **`targetId`** | Identity pool + FT-5 tuple selector (FT-2.2 membership / FT-3.3 relational) | Deterministic + embed rank |

Normative rules: [`llm/AGENT.contract.md`](../../../../llm/AGENT.contract.md) (**Deterministic enrich boundary**).

### Bedrock budget (after classify)

| Path | Typical hops |
| --- | --- |
| Membership | **0** when exact identity + atomic pre-gates succeed; **+1 Titan embed** per distinct span on exact miss; **1** complexity LLM when pre-gates defer. Identity LLM retired (FT-2.1). |
| Relational | **+1** Parse (tokenized skeleton, BD-21); **0--2** Titan embeds (per distinct span on exact miss). Identity LLM retired (FT-2.1); frame extract retired (2026-07-20). |

Eligible exact-name, single-span, single-host, exit-edge-free **`takeHold`** / **`drop`** may need **zero** post-classify Bedrock calls.

### Interaction under transfer

[`interactionUnderTransfer.ts`](../../../positions/ludicGraph/expandValidate/interactionUnderTransfer.ts) classifies every relational edge that crosses a move's boundary (one endpoint moves, the other stays), by relation kind and by which end moves. The answer depends on which endpoint plays the constraining role, not on a fixed subject-versus-target split:

| Relation kind | Subject moves | Target moves |
| --- | --- | --- |
| `Under` | **Defer** (interaction assessment) | Clean dissolve |
| `Against` | Clean dissolve | Clean dissolve |
| `Custom` | Defer | Defer |
| `On` / `In` / `PartOf` | Throws (AB-54) | Throws (AB-54) |

`Under`'s subject-move case defers because the ambiguity is spatial clearance. Hosting kinds never reach the table legitimately: a hosted thing lives in its host's own shard and travels with it, so "take the tray" moves the glass on it without any edge to classify. A hosting-kind edge on the exterior graph means a producer built a graph the constructor does not author, so the classifier throws.

**Construction vs. validation.** Three callers read the table, and none grows the moved set:

- **At grounding**, before scoring, [`groundMembershipCandidates.ts`](groundMembershipCandidates.ts) records the table on each candidate's attempt: one facilitating action per boundary edge, with a graph challenge on each `defer` ([`commandAttempt/expandBoundaryChallenges.ts`](../../commandAttempt/expandBoundaryChallenges.ts)). Adjudicate then records *met* on each `Custom`-edge challenge ([`commandAttempt/adjudicate.ts`](../../commandAttempt/adjudicate.ts)); an `Under` subject-move challenge stays pending.
- **At selection**, [`selectIdentityPlanTuple.ts`](selectPlanCandidate.ts)'s `sandboxMembershipDryRun` reads the attempt's result: `pending` defers, and `succeeded` lowers the attempt through the Synthesize executor, its facilitating dissolves first ([`synthesize/executor.ts`](synthesize/executor.ts)'s `seedFromGroundedSteps`), over an in-memory [`sandboxState.ts`](sandboxState.ts) of the room's and character's graphs. The executor does not read the table.
- **At commit**, positions' `buildObjectMoveOp` classifies again from the departure host's graph, dissolving each `dissolve` cell and each `defer` edge the published attempt recorded as met, and the commit re-validates on the locked graphs, so a change since selection is caught rather than applied.

The table lives in `positions/ludicGraph/expandValidate/`, a location neither the actions compiler nor the kernel owns, so that every caller shares one legality authority.

**Why `interactionUnderTransfer.ts` and `evaluateRelationalLegality.ts` stay separate:** they answer different questions --- `evaluateRelationalLegality.ts` decides whether *establishing a new relation* is legal given existing topology; `interactionUnderTransfer.ts` decides what happens to an *existing* relation when one of its endpoints *transfers*. There is no integration point between them by design, not by omission --- `interactionUnderTransfer.ts` only ever governs `transferMembership`-driven changes, while `establishRelation`/`dissolveRelation` create or remove an edge directly and never consult this table.

## Key files

| Area | Files |
| --- | --- |
| Entry + route | [`index.ts`](index.ts) --- **BD-20 (2026-07-17):** [`cardinalityGate.ts`](cardinalityGate.ts) is no longer called here; the membership multi-span arity check now lives in [`compileMembershipAtomic.ts`](compileMembershipAtomic.ts), right after Identify succeeds, since Identify itself resolves any number of independent spans fine --- the actual gap is unbuilt Plan-side composition (BD-8/C2/C3), not Identify. `cardinalityGate.ts`'s pure function and its own unit tests are unchanged, just uncalled from this file. |
| Membership compiler | [`compileMembershipAtomic.ts`](compileMembershipAtomic.ts), [`membershipFrame.ts`](membershipFrame.ts), [`complexityPreGates.ts`](complexityPreGates.ts), [`membershipObservation.ts`](membershipObservation.ts) |
| Identity + selector | [`identityStage.ts`](identityStage.ts), [`resolveCatalogSpanToPool.ts`](resolveCatalogSpanToPool.ts), [`proposeMembershipTuples.ts`](proposeMembershipTuples.ts), [`validatePlanDryRun.ts`](validatePlanDryRun.ts), [`selectIdentityPlanTuple.ts`](selectPlanCandidate.ts) (`selectPlanTuple` core), [`existencePresenceGuard.ts`](existencePresenceGuard.ts), [`selectMembershipFromPool.ts`](selectMembershipFromPool.ts), [`selectSingleSpanFromPool.ts`](selectSingleSpanFromPool.ts) (harness only), [`resolveObjectSpan.ts`](resolveObjectSpan.ts), [`embeddingMatch/`](embeddingMatch/) |
| Complexity finalize | [`interpretAndFinalize.ts`](interpretAndFinalize.ts), [`complexityClasses.ts`](complexityClasses.ts) |
| Relational (native Parse-skeleton pipeline, replaces frame extract + `compileRelational` retired 2026-07-20) | [`parse/runParseStage.ts`](parse/runParseStage.ts), [`parse/parseToken.ts`](parse/parseToken.ts), [`parse/stampStableRefKeys.ts`](parse/stampStableRefKeys.ts), [`plan/matchRelationalTemplate.ts`](plan/matchRelationalTemplate.ts), [`identifySkeletonSpans.ts`](identifySkeletonSpans.ts) (calls [`identityStage.ts`](identityStage.ts) directly, rekeyed onto `stableRefKey`), [`resolvedSpansFromPools.ts`](resolvedSpansFromPools.ts), [`synthesize/groundReferent.ts`](synthesize/groundReferent.ts), [`synthesize/groundChange.ts`](synthesize/groundChange.ts), [`synthesize/filterLegalRelationalCandidates.ts`](synthesize/filterLegalRelationalCandidates.ts), [`synthesize/detectRelationalCycle.ts`](synthesize/detectRelationalCycle.ts), [`compileRelationalFromSkeleton.ts`](compileRelationalFromSkeleton.ts), [`normalizeRelationSpan.ts`](normalizeRelationSpan.ts), [`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts) --- does **not** use the Phase C sandbox (`sandboxState.ts`/`sandboxStep.ts`/`sandboxPlan.ts`, membership-route only), see "Phase C sandbox" above |
| Frames | [`manipulationFrame.ts`](manipulationFrame.ts) (`ManipulationFrame` type retained only for the unwired Phase C sandbox compiler, [`plan/compileUngroundedPlan.ts`](plan/compileUngroundedPlan.ts)) |
| Synthesize executor (shared by both routes above) | [`synthesize/AGENT.implementation.md`](synthesize/AGENT.implementation.md) --- worklist model + full file map (`executor.ts`, `executorTypes.ts`, `groundReferent.ts`/`groundChange.ts`/`groundAssertion.ts`, `expandSameHost.ts`, `filterLegalRelationalCandidates.ts`, `detectRelationalCycle.ts`) |

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
