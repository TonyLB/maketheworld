# Object manipulation parse pipeline

This folder owns post-classify enrichment for **`ObjectMembershipIntent`** and **`ObjectRelateIntent`**: grounding player language to trusted ids, deciding atomic membership vs relational complexity, and compiling terminal parse payloads.

Parent docs:

- Actions implementation (field tables, egress, playbooks): [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-b25-split-intents)
- Enrich module inventory: [`../AGENT.md`](../AGENT.md)
- LLM design (two axes): [`../../../llm/AGENT.concepts.md`](../../../llm/AGENT.concepts.md), [`../../../llm/AGENT.contract.md`](../../../llm/AGENT.contract.md)
- Operator semantics: [`../../../diegeticLogic/AGENT.operators.concepts.md`](../../../diegeticLogic/AGENT.operators.concepts.md)

Orchestration lives in [`parseCommand.ts`](../../parseCommand.ts); this folder is the enrich compiler surface ([`index.ts`](index.ts)).

## Pipeline architecture

**Trust posture:** enrich identity/selection is **fault-tolerant** (ranked `SpanCandidatePool` + propose-N + FT-5 selector -> auto-resolve, **Consult**, or **Abstain**). **Terminal parse** and **positions ingress** remain **trusted-output** --- a single grounded winner, or a terminal Consult/Abstain/Error before any stream. Classify family routing is still trusted-output (BD-11 live; FT-7 reunify is Phase C). Vocabulary: [`../../../llm/AGENT.concepts.md`](../../../llm/AGENT.concepts.md) (**Output trust models**). Pool recommender details: [`embeddingMatch/AGENT.md`](embeddingMatch/AGENT.md).

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

Production runs a **branching sequence** after classify: **`enrichRoute: 'membership'`** -> [`compileMembershipAtomic`](compileMembershipAtomic.ts), or **`enrichRoute: 'relational'`** -> Parse (tokenized command skeleton, upstream in [`parseCommand.ts`](../../parseCommand.ts)) -> [`compileRelationalFromSkeleton`](compileRelationalFromSkeleton.ts). Read this section for **what each phase is for**; step names, guards, and parsers live in source.

### Conceptual flow (classify through terminal parse)

**0. Catalog ingress (deterministic context packaging)**  
Before classify or enrich, **`handleParseRequested`** ([`index.ts`](../../index.ts)) parallel-fetches the actor's **room object catalog** and **held inventory catalog**, then batch-loads **`EMBEDDING#IMPROMPTU`** vectors via **`internalCache.ObjectEmbedding.get`** and attaches them to catalog entries ([`attachEmbeddingsToCatalogEntries`](../../attachEmbeddingsToCatalogEntries.ts)) before **`parseCommand`**. This is not a Bedrock hop; it packages authoritative catalog slices (with optional embeddings) for identity and (on the relational path) frame-extract context.

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
- **Tuple selector (FT-2.2, 2026-07-10):** [`selectMembershipFromPool`](selectMembershipFromPool.ts) = [`proposeMembershipTuples`](proposeMembershipTuples.ts) (verbClass-intended op on each v1-locus candidate) -> [`validateMembershipPlanDryRun`](validatePlanDryRun.ts) (locus legality) -> [`selectIdentityPlanTuple`](selectIdentityPlanTuple.ts) (`T_JOINT_*` floor + margin) -> [`existencePresenceGuard`](existencePresenceGuard.ts). Illegal-if-wrong (e.g. "drop bag" with room bag + held satchel) drops illegal tuples before confidence ranking. Thin-margin -> selector `consult` -> terminal **`Consult`** with structured `alternatives` (FT-3.1); grey-band -> **`Abstain`** (FT-3.2).
- **Retired from production path:** per-span identity LLM; reject-only [`verbMembershipAgreement`](verbMembershipAgreement.ts) veto after a committed id (legality is now pre-select dry-run); bridge [`selectSingleSpanFromPool`](selectSingleSpanFromPool.ts) (harness only after FT-3.3).

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
Reject-only [`verbMembershipAgreement`](verbMembershipAgreement.ts) is **no longer** applied after selector resolve --- locus legality in the dry-run already rejects room+drop / held+takeHold. Module retained for unit tests / complexity-path debt.

**8. Complexity LLM (semantic reasoning, conditional)**  
**Purpose:** when post-select pre-gates **defer** (exit-edge), judge whether the player still intends a **simple membership atomic** (`takeHold` / `drop`) despite exit-edge topology on the host, or whether the command is **relationally complex** (`complexityClass: relationalPlacement` terminal stub on the membership path).

The hop receives grounded **`objectId`**, membership containers, and which **exit edges** touch the object --- not a full graph dump.

**Handoff:** atomic **`operationKind`** (`takeHold` / `drop`) or complex **`complexityClass`** (terminal Error via [`finalizeComplexityFromEnrich`](interpretAndFinalize.ts)).

**Known gap (documented debt):** the complexity path **does not** re-run locus dry-run agreement today. Per [`llm/AGENT.contract.md`](../../../llm/AGENT.contract.md), treat missing reconciliation on this path as **fix later** --- FT-3 sandbox retirement is the intended cleanup.

---

#### Relational branch (native Parse-skeleton pipeline, `compileRelationalFromSkeleton`)

**Retired 2026-07-20:** the original frame-extract LLM + `compileRelational.ts` + `selectRelationalFromPools.ts` + `proposeRelationalTuples.ts` chain (steps 9-13 as they read before this date) is deleted outright, not merely superseded (retirement history in git; iteration 3 / BD-21 in the [iteration ladder's BD-N index](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.objectManipulationIterations.planning.md)). The pipeline below is the sole live relational path, per BD-21/BD-22/BD-23's design (Identify/Plan/Synthesize decomposition, [`../../AGENT.concepts.md`](../../AGENT.concepts.md)).

**9. Parse (semantic reasoning, upstream of this folder)**  
**Purpose:** [`parseCommand.ts`](../../parseCommand.ts)'s `ObjectRelateIntent` branch calls [`runParseStage`](parse/runParseStage.ts) unconditionally, turning player language into an ordered **`ParseSkeleton`** --- a sequence of `{ type: 'objectSpan', span, stableRefKey } | { type: 'text', text }` tokens ([`parse/parseToken.ts`](parse/parseToken.ts)). `stableRefKey` (assigned deterministically by [`stampStableRefKeys.ts`](parse/stampStableRefKeys.ts), never by the LLM) lets two identical-text spans ("put bench on bench") stay distinguishable by occurrence, not just array position. No role tagging (subject/target/verb) happens here --- that's Plan's job, step 10. No fallback to the retired frame-extract flow on Parse failure; the branch abstains or errors outright.

**Handoff:** `ParseSkeleton` -> `compileRelationalFromSkeleton`'s `input.skeleton`.

**10. Plan-stage template match (deterministic)**  
[`matchRelationalTemplate`](plan/matchRelationalTemplate.ts) pattern-matches the skeleton against a closed `TEXT<verb> OBJECTSPAN TEXT<prep> OBJECTSPAN` shape (`put`/`place`/`lean` -> `establishRelation`, `take`/`remove` -> `dissolveRelation`), reusing [`normalizeRelationSpan.ts`](normalizeRelationSpan.ts) for the preposition-to-`relationKind` half. Three outcomes: `matched` (an ungrounded `Change` with role-tagged `Referent`s, keyed by `stableRefKey`), `nestingDefer` (**`nestingRelational`** Error --- `in`/`inside`/`into`), or `noMatch` (**`Abstain`**, `relationalNoTemplateMatch`).

**11. Identify (pool resolution)**  
[`runIdentityStageOverSkeleton`](identifySkeletonSpans.ts) resolves the skeleton's `objectSpan` tokens via room **and held-inventory** catalog pools (`mergeObjectManipulationCatalogs` tags entries `'room'`/`'held'`, room taking precedence on an id collision --- unchanged from the retired path's BD-15/16 slice 4b widening), reusing the shared [`identityStage.ts`](identityStage.ts) resolver, then rekeys its positional output onto each token's `stableRefKey` (a `ReadonlyMap<string, SpanCandidatePool>`) rather than array position.

**12. Grounding (joint candidate space)**  
[`resolvedSpansFromPools`](resolvedSpansFromPools.ts) adapts Identify's pools into `groundReferent.ts`/`groundChange.ts`'s [`GroundingContext`](synthesize/groundReferent.ts). `groundChange` takes the Cartesian product across the matched `Change`'s `Referent`s, filtered only on type-correctness --- **same-object combinations are kept, not rejected** (BD-23): identical-text same-position spans can legitimately both resolve to the same real object, and rejecting that a priori would be Grounding overstepping into a legality judgment that isn't its job.

**12b. Expansion (BD-16 sameHost, walk-then-build, PV1-3b-4 2026-09-01, pre-fetch deepened PV1-3b-5 2026-09-02)**  
Between Grounding and Validation, [`expandSameHost`](synthesize/expandSameHost.ts) corrects each grounded candidate's host against the subject/object's *real* current hosts, not the BD-6 room default Grounding assigned. For every peer kind (`Under`/`Against`/`Custom`) it always walks ([`findShardBoundary`](synthesize/findShardBoundary.ts), via `positionsReadDeps.getMembershipContainers`) then builds ([`buildCrossingLegs`](synthesize/buildCrossingLegs.ts)) --- an already-shared host resolves to a zero-hop common ancestor and a single portless leg (an endpoint is its own zero-hop ancestor, PV1-3b-8), a genuine cross-shard pair mints crossing legs plus one `EphemeraCrossingPort`. Hosting kinds (`On`/`In`/`PartOf`) error outright (CD2h): a hosting relation is a membership move, not a relational placement, and has no branch here. `defer` (`Custom`-relation violations, or a peer relation whose boundary is unreachable or an unsupported shape) is dropped, since this route has no Consult/LLM-fallback path yet. There is no repair outcome any more --- PV1-3b-9 (2026-09-01) retired the old `transferMembership`-insertion path entirely, so a violated relation never relocates either endpoint. **Live reach on this route today:** the ingress route ([`compileRelationalFromSkeleton.ts`](compileRelationalFromSkeleton.ts)) eagerly pre-fetches each candidate's full containment ancestry, depth-capped at 5 (`walkAncestryContainers`, `synthesize/findShardBoundary.ts`, PV1-3b-5), so `findShardBoundary` can reach a common ancestor past an intermediate host, not just a directly-shared one --- both the already-shared-host case and a genuine cross-shard boundary now resolve to the right verdict. **PV1-3b-1 (2026-09-02)** carries every step of the outcome (port(s) plus every leg, in production order) into the widened [`ParseCommandEstablishRelationResult`](../baseClasses.ts) instead of taking only the first `establishRelation`/`dissolveRelation` step and dropping any candidate whose leg has a port-address endpoint --- a genuine crossing is no longer discarded at this route. It still doesn't land live end to end, though: the sole consumer ([`actions/index.ts`](../index.ts)) and the commit path only understand one edge on one host until `executeEstablishEdgeChain` exists (PV1-3b-3) and the published payload is widened to carry the full chain (PV1-3b-2) --- a crossing attempt today reaches that consumer and throws a commit-time `Error` (`applyRelationalPatch`'s `bothObjectsOnGraph` check) rather than being silently declined.

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

Normative rules: [`llm/AGENT.contract.md`](../../../llm/AGENT.contract.md) (**Deterministic enrich boundary**).

### Bedrock budget (after classify)

| Path | Typical hops |
| --- | --- |
| Membership | **0** when exact identity + atomic pre-gates succeed; **+1 Titan embed** per distinct span on exact miss; **1** complexity LLM when pre-gates defer. Identity LLM retired (FT-2.1). |
| Relational | **+1** Parse (tokenized skeleton, BD-21); **0--2** Titan embeds (per distinct span on exact miss). Identity LLM retired (FT-2.1); frame extract retired (2026-07-20). |

Eligible exact-name, single-span, single-host, exit-edge-free **`takeHold`** / **`drop`** may need **zero** post-classify Bedrock calls.

### Phase C sandbox (built, wired into both live selectors as of 2026-07-14; retired 2026-07-23)

**Superseded 2026-07-23:** `sandboxState.ts`/`sandboxStep.ts`/`sandboxPlan.ts`/`synthesize/toSandboxPlanStep.ts`, and the Expansion-side `synthesize/expandTransferMembership.ts` this section's own BD-13 paragraph (below) describes, are all **deleted**. `selectIdentityPlanTuple.ts`'s `sandboxMembershipDryRun` now seeds and runs the general Synthesize executor (`synthesize/executor.ts`) instead of `expandTransferMembership` + `evaluateSandboxPlan` --- see [`synthesize/AGENT.implementation.md`](synthesize/AGENT.implementation.md) for the executor's file map and worklist model, `../../AGENT.concepts.md`'s Synthesize sub-roles section for vocabulary, and `positions/manipulation/AGENT.implementation.md` for the kernel that consumes its output. The rest of this section is kept as historical record of the design that section superseded, not current fact. `sandboxSelectorReadiness.test.ts` (referenced below) is also deleted --- its subject matter no longer exists; `selectIdentityPlanTuple.test.ts` now covers the same BD-13/BD-16 ground through the real executor path.

[`interactionUnderTransfer.ts`](../../../positions/ludicGraph/expandValidate/interactionUnderTransfer.ts), [`applyTransferSet.ts`](../../../positions/ludicGraph/expandValidate/applyTransferSet.ts) (moved to a shared `ludicGraph/expandValidate/` location 2026-07-15 --- see "Construction vs. validation" below for why), [`sandboxState.ts`](sandboxState.ts), [`sandboxStep.ts`](sandboxStep.ts), [`sandboxPlan.ts`](sandboxPlan.ts) implement a pure, in-memory dry-run legality simulator for **`transferMembership`** / **`establishRelation`** / **`dissolveRelation`**, built for Phase C (planning doc retired 2026-07-24 once this section graduated its content; see git history). **Wired into the live request path (Slices 4a/4b, 2026-07-13/14):** `selectIdentityPlanTuple.ts` (the shared FT-5 selector, still used by the **membership** route) routes its dry run through `evaluateSandboxPlan` (`sandboxMembershipDryRun`), replacing the direct `validateMembershipPlanDryRun` call the paragraph below originally described. **Relational-route note (2026-07-20):** the native Parse-skeleton pipeline (`compileRelationalFromSkeleton.ts`, see "Relational branch" above) does **not** go through this sandbox --- its own Validation step (`filterLegalRelationalCandidates.ts` + `detectRelationalCycle.ts`) supplements `evaluateRelationalLegality.ts` directly, replacing `selectRelationalFromPools.ts`'s retired `sandboxRelationalDryRun` call. [`sandboxSelectorReadiness.test.ts`](sandboxSelectorReadiness.test.ts) proved (via a test-only adapter, ahead of the real wiring) that the sandbox's output fits `selectPlanTuple`'s generic `dryRun` callback shape.

**Multi-host state.** **`takeHold`** / **`drop`** are already cross-host today (Room's `EphemeraLudicGraph` vs. Character's, joined only by adjacency index, not containment) --- the sandbox models this directly: `SandboxState = Map<EphemeraMembershipHostId, EphemeraLudicGraph>`, mirroring `applyHostEffects.ts`'s own `graphsByHost` pattern. No new mutation machinery --- `EphemeraLudicGraph`'s existing methods (`addObject`, `removeObject`, `addRelationalEdge`, `applyRelationalPatch`) already return a new instance rather than mutating in place.

**Interaction-under-transfer.** Every **`transferMembership`** step --- single-step or the Nth step of a compound plan --- must check relational edges touching the transferred object, not just exit edges (the shipped `validateMembershipPlanDryRun` only ever checked exit edges). The outcome per relation kind depends on **which endpoint plays the load-bearing / constraining role**, not a fixed subject-vs-target split:

| Relation kind | Subject moves | Target moves |
| --- | --- | --- |
| `On` | Clean dissolve | **Carry** (absorb into transfer set) |
| `Under` | **Defer** (interaction assessment) | Clean dissolve |
| `Against` | Clean dissolve | Clean dissolve |
| `Custom` | Defer | Defer |

**`On`**'s target-move case is **`carry`**, not **`defer`**: when a supporting surface moves, the deterministic default is "what's resting on it comes along" (get the tray, the glass on it comes too) rather than leaving the outcome ambiguous. **`Under`**'s subject-move case has no carry partner --- the ambiguity is spatial clearance, not "what happens to some other object" --- so it stays a genuine defer. **`carry`** is **transitive to a fixpoint**: absorbing an object means re-examining *its* edges too (glass on book, book on tray --- picking up the tray absorbs both). An edge where both endpoints end up in the same transfer set is **internal** (never evaluated, preserved as-is on the destination host); only edges crossing the transfer set's **boundary** are checked against this table.

**Construction vs. validation.** The sandbox **validates** that a candidate's transfer set is already complete --- it never **expands** one itself, even though the closure algorithm (`computeCarryClosure`) is available to it. A **`carry`**-classified boundary edge on a candidate means the candidate under-specified its transfer set; the sandbox returns **`illegal`** (`incompleteTransferSet`), not a silent auto-fix. Growing the transfer set to include carried objects is exclusively the job of whatever constructs the candidate (deterministic compiler or LLM-plan proposer) --- keeping the validator a single shared legality authority every proposer must pass, and keeping FT-5 selection confidence meaningful (computed against the same candidate that ends up applied, not one silently mutated afterward). **Since 2026-07-15,** `sandboxStep.ts`'s `applyTransferMembershipStep` delegates this completeness-check-and-mutate logic to [`applyTransferSet`](../../../positions/ludicGraph/expandValidate/applyTransferSet.ts), extracted specifically so the persistence kernel can call the same function to re-verify a transfer atomically at commit time, against freshly-fetched state (not yet wired --- tracked as the follow-on to this extraction in `AGENT.manipulationFrameAndRelational.planning.md`) --- the identical reason this paragraph's "single shared legality authority" already cared about: a check computed once, ahead of a write, is only as good as how recently it was asked.

**Resolved (2026-07-15, BD-13/BD-17):** "take tray" (glass **`On`** it) now correctly carries the glass in production, rather than either the original silent-success bug or BD-17's interim `illegal: incompleteTransferSet` rejection. The Synthesize-stage compiler's Expansion sub-role (`expandTransferMembership.ts`) is invoked from `compileMembershipAtomic.ts` (Pipeline A -> B migration Slice 2), computing the real carry-closed transfer set; the kernel applies it atomically via `applyObjectSetTransfer.ts`'s `MultiKeyUpdate` reducer (migration Slice 3, superseding the originally-sketched `applyObjectSetTakeHold.ts`/`applyObjectSetDrop.ts` kernel primitive from Slice 1). Perception narrates the carried object too (migration Slice 4, conditional `" and everything on it"` suffix). BD-17's rejection behavior no longer applies to any command this compiler can fully carry-close.

**Conceptual home (2026-07-12):** this sandbox is the **Synthesize**-stage validation half of a three-job pipeline (Identify / Plan / Synthesize) --- see [`../../AGENT.concepts.md`](../../AGENT.concepts.md) (**Target**, not yet the shipped module shape). `interactionUnderTransfer.ts` / `computeCarryClosure` do Synthesize-stage closure (Expansion) work; `synthesize/groundReferent.ts`/`groundChange.ts` (built 2026-07-13) do Grounding. Both remain unwired into any real command as of this writing --- only Validation (this sandbox) carries real production traffic today (Slices 4a/4b).

**Why `interactionUnderTransfer.ts` and `evaluateRelationalLegality.ts` stay separate:** they answer different questions --- `evaluateRelationalLegality.ts` decides whether *establishing a new relation* is legal given existing topology; `interactionUnderTransfer.ts` decides what happens to an *existing* relation when one of its endpoints *transfers*. There is no integration point between them by design, not by omission --- `interactionUnderTransfer.ts` only ever governs `transferMembership`-driven changes, while `establishRelation`/`dissolveRelation` create or remove an edge directly and never consult this table.

## Key files

| Area | Files |
| --- | --- |
| Entry + route | [`index.ts`](index.ts) --- **BD-20 (2026-07-17):** [`cardinalityGate.ts`](cardinalityGate.ts) is no longer called here; the membership multi-span arity check now lives in [`compileMembershipAtomic.ts`](compileMembershipAtomic.ts), right after Identify succeeds, since Identify itself resolves any number of independent spans fine --- the actual gap is unbuilt Plan-side composition (BD-8/C2/C3), not Identify. `cardinalityGate.ts`'s pure function and its own unit tests are unchanged, just uncalled from this file. |
| Membership compiler | [`compileMembershipAtomic.ts`](compileMembershipAtomic.ts), [`membershipFrame.ts`](membershipFrame.ts), [`complexityPreGates.ts`](complexityPreGates.ts), [`membershipObservation.ts`](membershipObservation.ts) |
| Identity + selector | [`identityStage.ts`](identityStage.ts), [`resolveCatalogSpanToPool.ts`](resolveCatalogSpanToPool.ts), [`proposeMembershipTuples.ts`](proposeMembershipTuples.ts), [`validatePlanDryRun.ts`](validatePlanDryRun.ts), [`selectIdentityPlanTuple.ts`](selectIdentityPlanTuple.ts) (`selectPlanTuple` core), [`existencePresenceGuard.ts`](existencePresenceGuard.ts), [`selectMembershipFromPool.ts`](selectMembershipFromPool.ts), [`selectSingleSpanFromPool.ts`](selectSingleSpanFromPool.ts) (harness only), [`resolveObjectSpan.ts`](resolveObjectSpan.ts), [`embeddingMatch/`](embeddingMatch/) |
| Complexity finalize | [`interpretAndFinalize.ts`](interpretAndFinalize.ts), [`complexityClasses.ts`](complexityClasses.ts) |
| Relational (native Parse-skeleton pipeline, replaces frame extract + `compileRelational` retired 2026-07-20) | [`parse/runParseStage.ts`](parse/runParseStage.ts), [`parse/parseToken.ts`](parse/parseToken.ts), [`parse/stampStableRefKeys.ts`](parse/stampStableRefKeys.ts), [`plan/matchRelationalTemplate.ts`](plan/matchRelationalTemplate.ts), [`identifySkeletonSpans.ts`](identifySkeletonSpans.ts) (calls [`identityStage.ts`](identityStage.ts) directly, rekeyed onto `stableRefKey`), [`resolvedSpansFromPools.ts`](resolvedSpansFromPools.ts), [`synthesize/groundReferent.ts`](synthesize/groundReferent.ts), [`synthesize/groundChange.ts`](synthesize/groundChange.ts), [`synthesize/filterLegalRelationalCandidates.ts`](synthesize/filterLegalRelationalCandidates.ts), [`synthesize/detectRelationalCycle.ts`](synthesize/detectRelationalCycle.ts), [`compileRelationalFromSkeleton.ts`](compileRelationalFromSkeleton.ts), [`normalizeRelationSpan.ts`](normalizeRelationSpan.ts), [`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts) --- does **not** use the Phase C sandbox (`sandboxState.ts`/`sandboxStep.ts`/`sandboxPlan.ts`, membership-route only), see "Phase C sandbox" above |
| Frames | [`manipulationFrame.ts`](manipulationFrame.ts) (`ManipulationFrame` type retained only for the unwired Phase C sandbox compiler, [`plan/compileUngroundedPlan.ts`](plan/compileUngroundedPlan.ts)) |
| Synthesize executor (shared by both routes above) | [`synthesize/AGENT.implementation.md`](synthesize/AGENT.implementation.md) --- worklist model + full file map (`executor.ts`, `expansionEnvironment.ts`, `executorTypes.ts`, `groundReferent.ts`/`groundChange.ts`/`groundAssertion.ts`, `expandSameHost.ts`, `filterLegalRelationalCandidates.ts`, `detectRelationalCycle.ts`) |

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
