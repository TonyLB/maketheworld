# Object manipulation parse pipeline

This folder owns post-classify enrichment for **`ObjectMembershipIntent`** and **`ObjectRelateIntent`**: grounding player language to trusted ids, deciding atomic membership vs relational complexity, and compiling terminal parse payloads.

Parent docs:

- Actions implementation (field tables, egress, playbooks): [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents)
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

**Runtime (FT-2.2 + FT-3.3, 2026-07-10):** identity stage emits `SpanCandidatePool[]`. **Membership** path: deterministic propose-N + FT-5 tuple selector ([`selectMembershipFromPool`](selectMembershipFromPool.ts)); thin-margin ambiguity egresses terminal **`Consult`** ([`ParseCommandConsultResult`](../../baseClasses.ts)); grey-band / unfit head egresses terminal **`Abstain`** ([`ParseCommandAbstainResult`](../../baseClasses.ts)); policy / legality / validator defer stay **Error**. **Relational** path: pools-only grounding + [`selectRelationalFromPools`](selectRelationalFromPools.ts) (same FT-5 policy + dual existence guard); Consult/Abstain/Error/EstablishRelation from [`compileRelational`](compileRelational.ts). Bridge [`selectSingleSpanFromPool`](selectSingleSpanFromPool.ts) retired from production (harness only). Complexity LLM and frame extract remain live interim hops until Phase C **C4**.

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

Production runs a **branching sequence** after classify: **`enrichRoute: 'membership'`** -> [`compileMembershipAtomic`](compileMembershipAtomic.ts), or **`enrichRoute: 'relational'`** -> frame extract -> [`compileRelational`](compileRelational.ts). Read this section for **what each phase is for**; step names, guards, and parsers live in source.

### Conceptual flow (classify through terminal parse)

**0. Catalog ingress (deterministic context packaging)**  
Before classify or enrich, **`handleParseRequested`** ([`index.ts`](../../index.ts)) parallel-fetches the actor's **room object catalog** and **held inventory catalog**, then batch-loads **`EMBEDDING#IMPROMPTU`** vectors via **`internalCache.ObjectEmbedding.get`** and attaches them to catalog entries ([`attachEmbeddingsToCatalogEntries`](../../attachEmbeddingsToCatalogEntries.ts)) before **`parseCommand`**. This is not a Bedrock hop; it packages authoritative catalog slices (with optional embeddings) for identity and (on the relational path) frame-extract context.

**1. Classify fast path (deterministic @ classify)**  
When the command matches a **closed syntactic template** (`take` / `drop` / `get` + noun, with label gate for `get` vs Acme), code synthesizes **`ObjectMembershipIntent`** with **`verbClass`** and **`objectSpans`** and **skips** Bedrock classify. The owning stage is still classify; the outcome shape matches the LLM path.

**2. Classify LLM (semantic reasoning)**  
When the fast path does not apply, the model chooses **topology**:

- **`ObjectMembershipIntent`** --- membership **host transfer** (which **`positionGraph`** node hosts the object). Emits **`objectSpans`** and membership **language direction** **`verbClass`** (`acquire` | `release`). Does **not** emit **`operationKind`**.
- **`ObjectRelateIntent`** --- **in-host relational edge** between objects on the actor's current room graph. Emits **`objectSpans`** only (no **`verbClass`**). Does **not** emit relational **`operationKind`** or role-tagged frames.

**Handoff:** intent **`type`**, **`rawObjectSpans`**, optional **`verbClass`**, **`confidence`**; catalogs and **`hostRoomId`** from parse ingress. Tie-breakers (e.g. **`ObjectRelateIntent`** beats **`ObjectMembershipIntent`** when the line establishes an in-host relation) live in [`discriminateIntent/buildIntentClassificationPrompt.ts`](../../discriminateIntent/buildIntentClassificationPrompt.ts).

**3. Enrich route (deterministic)**  
[`parseCommand`](../../parseCommand.ts) sets **`enrichRoute`** from classify intent type and calls [`enrichObjectManipulation`](index.ts). Membership path runs a **cardinality gate** (`multiObject` Error when **`rawObjectSpans.length > 1`**). Relational path has no cardinality gate at entry; frame extract re-derives structure from the command.

---

#### Membership branch (`compileMembershipAtomic`)

**4. Identity (pool + FT-2.2 selector)**  
**Purpose:** map classify **`objectSpans`** to a trusted catalog **`objectId`** + membership **`operationKind`** for a unary membership command.

- **Pool emission (FT-2.1):** per-span [`resolveCatalogSpanToPool`](resolveCatalogSpanToPool.ts) --- exact unique match -> single-candidate pool (`sourceTags: ['exact']`, `jointRelevance: 1`); duplicate exact labels -> multi-candidate pool with distinct `locus`; non-exact -> span embed + [`buildSpanCandidatePool`](embeddingMatch/buildSpanCandidatePool.ts).
- **Tuple selector (FT-2.2, 2026-07-10):** [`selectMembershipFromPool`](selectMembershipFromPool.ts) = [`proposeMembershipTuples`](proposeMembershipTuples.ts) (verbClass-intended op on each v1-locus candidate) -> [`validateMembershipPlanDryRun`](validatePlanDryRun.ts) (locus legality) -> [`selectIdentityPlanTuple`](selectIdentityPlanTuple.ts) (`T_JOINT_*` floor + margin) -> [`existencePresenceGuard`](existencePresenceGuard.ts). Illegal-if-wrong (e.g. "drop bag" with room bag + held satchel) drops illegal tuples before confidence ranking. Thin-margin -> selector `consult` -> terminal **`Consult`** with structured `alternatives` (FT-3.1); grey-band -> **`Abstain`** (FT-3.2).
- **Retired from production path:** per-span identity LLM; reject-only [`verbMembershipAgreement`](verbMembershipAgreement.ts) veto after a committed id (legality is now pre-select dry-run); bridge [`selectSingleSpanFromPool`](selectSingleSpanFromPool.ts) (harness only after FT-3.3).

**Handoff:** grounded **`objectId`** + **`operationKind`**, defer to complexity LLM (exit-edge interim until Phase C), terminal **`Consult`** (catalog-backed ambiguity), terminal **`Abstain`** (grey-band / noMatch), or terminal Error.

**5. Post-select observation + complexity pre-gates (deterministic)**  
After selector resolve, read authoritative **membership containers** and host **`positionGraph`**. Exit-edge / non-atomic topology still defers to the complexity LLM (interim until FT-3 sandbox retirement):

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

#### Relational branch (frame extract + `compileRelational`)

**9. Frame extract LLM (semantic reasoning)**  
**Purpose:** from player language, extract a **manipulation frame**: **`subjectSpan`**, **`targetSpan`**, **`relationSpan`**, and relational **`operationKind`** (`establishRelation` | `dissolveRelation`, **BD-12**). Classify **`objectSpans`** are **hints only** in the prompt; frame extract re-derives role-tagged spans. Whether that split is always correct in edge cases is an open review surface --- this doc is the reference for that exploration.

**Handoff:** validated JSON -> [`ManipulationFrame`](manipulationFrame.ts) (raw language spans + **`operationKind`**; no EphemeraIds).

**10. Relation normalizer (deterministic)**  
Map **`relationSpan`** -> **`relationKind`** enum (`On` | `Under` | `Against`) or **`Custom`** + **`relationLabel`**; **`in`** / **`inside`** / **`into`** -> **`nestingRelational`** Error ([`normalizeRelationSpan.ts`](normalizeRelationSpan.ts)).

**11. Relational grounding (pool + FT-3.3 selector)**  
Resolve **`subjectSpan`** and **`targetSpan`** via room-catalog pools (**BD-5**: room catalog only for v1). [`resolveRelationalGrounding`](resolveRelationalGrounding.ts) emits pools only; [`selectRelationalFromPools`](selectRelationalFromPools.ts) = [`proposeRelationalTuples`](proposeRelationalTuples.ts) (cartesian subject x target; confidence = min joint) -> shared FT-5 [`selectPlanTuple`](selectIdentityPlanTuple.ts) with [`validateRelationalPlanDryRun`](validatePlanDryRun.ts) -> dual [`existencePresenceGuard`](existencePresenceGuard.ts). Thin-margin -> **Consult**; grey-band -> **Abstain**. Shared span embed cache across subject + target spans.

**12. Relational legality (inside dry-run)**  
Legality ([`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts)) runs as the selector dry-run: both nodes on graph; **`dissolveRelation`** requires a matching edge; **`establishRelation`** allows idempotent duplicate; **conflicting existing relational topology** on subject/target -> illegal (**`complexRelational`** Error; Phase D plan LLM is the future escalation --- see planning doc).

**13. Terminal compile (deterministic)**  
[`compileRelational`](compileRelational.ts) emits **`EstablishRelation`**, **`Consult`**, **`Abstain`**, or **`Error`**.

---

**In one sentence:** classify **membership vs relational topology** and language direction, **ground** object references via pool + FT-5 selector (membership and relational), **close** simple membership atomics from locus legality or **defer** when exit edges complicate the host, **extract** relational frames and operator choice when the intent is in-host edges, then **auto-resolve** to trusted terminal parse, or emit terminal Consult / Abstain / Error before commit.

### Field ownership (quick reference)

| Field | Owning stage | Lane |
| --- | --- | --- |
| Intent **`type`** (`ObjectMembershipIntent` \| `ObjectRelateIntent`) | Classify | Semantic |
| **`verbClass`** | Classify (**membership only**) | Semantic |
| **`objectSpans`** / **`rawObjectSpans`** | Classify (hints); frame extract re-tags on relational path | Semantic + re-extract |
| Membership **`operationKind`** (`takeHold` \| `drop`) | FT-2.2 selector (locus legality + verb-intended propose-N); complexity LLM when deferred | Deterministic + semantic defer |
| Relational **`operationKind`** (`establishRelation` \| `dissolveRelation`) | Frame extract (**BD-12**) | Semantic |
| **`relationKind`** / **`relationLabel`** | Relation normalizer | Deterministic |
| Grounded **`objectId`** / **`subjectId`** / **`targetId`** | Identity pool + FT-5 tuple selector (FT-2.2 membership / FT-3.3 relational) | Deterministic + embed rank |

Normative rules: [`llm/AGENT.contract.md`](../../../llm/AGENT.contract.md) (**Deterministic enrich boundary**).

### Bedrock budget (after classify)

| Path | Typical hops |
| --- | --- |
| Membership | **0** when exact identity + atomic pre-gates succeed; **+1 Titan embed** per distinct span on exact miss; **1** complexity LLM when pre-gates defer. Identity LLM retired (FT-2.1). |
| Relational | **+1** frame extract; **0--2** Titan embeds (per distinct span on exact miss). Identity LLM retired (FT-2.1). |

Eligible exact-name, single-span, single-host, exit-edge-free **`takeHold`** / **`drop`** may need **zero** post-classify Bedrock calls.

### Phase C sandbox (built, not yet wired into production)

[`interactionUnderTransfer.ts`](interactionUnderTransfer.ts), [`sandboxState.ts`](sandboxState.ts), [`sandboxStep.ts`](sandboxStep.ts), [`sandboxPlan.ts`](sandboxPlan.ts) implement a pure, in-memory dry-run legality simulator for **`transferMembership`** / **`establishRelation`** / **`dissolveRelation`**, built for Phase C (see [`AGENT.planCompilerSandbox.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.planCompilerSandbox.planning.md)) but **not yet wired into the live request path** --- `selectIdentityPlanTuple.ts` and `selectMembershipFromPool.ts` still call `validateMembershipPlanDryRun`/`validateRelationalPlanDryRun` directly, unmodified. [`sandboxSelectorReadiness.test.ts`](sandboxSelectorReadiness.test.ts) proves (via a test-only adapter) that the sandbox's output already fits `selectPlanTuple`'s generic `dryRun` callback shape, so wiring it in later is mechanical once its remaining prerequisite lands (see "Known gap" below).

**Multi-host state.** **`takeHold`** / **`drop`** are already cross-host today (Room's `EphemeraPositionGraph` vs. Character's, joined only by adjacency index, not containment) --- the sandbox models this directly: `SandboxState = Map<EphemeraMembershipHostId, EphemeraPositionGraph>`, mirroring `applyHostEffects.ts`'s own `graphsByHost` pattern. No new mutation machinery --- `EphemeraPositionGraph`'s existing methods (`addObject`, `removeObject`, `addRelationalEdge`, `applyRelationalPatch`) already return a new instance rather than mutating in place.

**Interaction-under-transfer.** Every **`transferMembership`** step --- single-step or the Nth step of a compound plan --- must check relational edges touching the transferred object, not just exit edges (the shipped `validateMembershipPlanDryRun` only ever checked exit edges). The outcome per relation kind depends on **which endpoint plays the load-bearing / constraining role**, not a fixed subject-vs-target split:

| Relation kind | Subject moves | Target moves |
| --- | --- | --- |
| `On` | Clean dissolve | **Carry** (absorb into transfer set) |
| `Under` | **Defer** (interaction assessment) | Clean dissolve |
| `Against` | Clean dissolve | Clean dissolve |
| `Custom` | Defer | Defer |

**`On`**'s target-move case is **`carry`**, not **`defer`**: when a supporting surface moves, the deterministic default is "what's resting on it comes along" (get the tray, the glass on it comes too) rather than leaving the outcome ambiguous. **`Under`**'s subject-move case has no carry partner --- the ambiguity is spatial clearance, not "what happens to some other object" --- so it stays a genuine defer. **`carry`** is **transitive to a fixpoint**: absorbing an object means re-examining *its* edges too (glass on book, book on tray --- picking up the tray absorbs both). An edge where both endpoints end up in the same transfer set is **internal** (never evaluated, preserved as-is on the destination host); only edges crossing the transfer set's **boundary** are checked against this table.

**Construction vs. validation.** The sandbox **validates** that a candidate's transfer set is already complete --- it never **expands** one itself, even though the closure algorithm (`computeCarryClosure`) is available to it. A **`carry`**-classified boundary edge on a candidate means the candidate under-specified its transfer set; the sandbox returns **`illegal`** (`incompleteTransferSet`), not a silent auto-fix. Growing the transfer set to include carried objects is exclusively the job of whatever constructs the candidate (deterministic compiler or LLM-plan proposer) --- keeping the validator a single shared legality authority every proposer must pass, and keeping FT-5 selection confidence meaningful (computed against the same candidate that ends up applied, not one silently mutated afterward).

**Known gap, accepted as interim:** because the sandbox isn't wired in, "take tray" (glass **`On`** it) still silently succeeds in production today and leaves a dangling **`glass On tray`** edge referencing an object that's now held. Wiring the sandbox into `selectIdentityPlanTuple.ts` today would only ever see single-object candidates (nothing yet constructs a correct multi-member **`carry`** candidate), so it would flip this bug from "silently wrong" to "explicitly rejected," not yet "correct" --- worse in the interim. Fixing it for real needs both a compiler that can construct complete multi-member candidates and the actual edit to `selectIdentityPlanTuple.ts:167` / `selectMembershipFromPool.ts`; neither has happened yet.

**Conceptual home (2026-07-12):** this sandbox is the **Synthesize**-stage validation half of a three-job pipeline (Identify / Plan / Synthesize) --- see [`../../AGENT.concepts.md`](../../AGENT.concepts.md) (**Target**, not yet the shipped module shape). `interactionUnderTransfer.ts` / `computeCarryClosure` do Synthesize-stage closure work; no code changes from this yet.

## Key files

| Area | Files |
| --- | --- |
| Entry + route | [`index.ts`](index.ts), [`cardinalityGate.ts`](cardinalityGate.ts) |
| Membership compiler | [`compileMembershipAtomic.ts`](compileMembershipAtomic.ts), [`membershipFrame.ts`](membershipFrame.ts), [`complexityPreGates.ts`](complexityPreGates.ts), [`membershipObservation.ts`](membershipObservation.ts) |
| Identity + selector | [`identityStage.ts`](identityStage.ts), [`resolveCatalogSpanToPool.ts`](resolveCatalogSpanToPool.ts), [`proposeMembershipTuples.ts`](proposeMembershipTuples.ts), [`proposeRelationalTuples.ts`](proposeRelationalTuples.ts), [`validatePlanDryRun.ts`](validatePlanDryRun.ts), [`selectIdentityPlanTuple.ts`](selectIdentityPlanTuple.ts) (`selectPlanTuple` core), [`existencePresenceGuard.ts`](existencePresenceGuard.ts), [`selectMembershipFromPool.ts`](selectMembershipFromPool.ts), [`selectRelationalFromPools.ts`](selectRelationalFromPools.ts), [`selectSingleSpanFromPool.ts`](selectSingleSpanFromPool.ts) (harness only), [`resolveObjectSpan.ts`](resolveObjectSpan.ts), [`embeddingMatch/`](embeddingMatch/) |
| Complexity finalize | [`interpretAndFinalize.ts`](interpretAndFinalize.ts), [`complexityClasses.ts`](complexityClasses.ts) |
| Relational | [`frameExtract/runFrameExtractStage.ts`](frameExtract/runFrameExtractStage.ts), [`frameExtract/buildFrameExtractPrompt.ts`](frameExtract/buildFrameExtractPrompt.ts), [`compileRelational.ts`](compileRelational.ts), [`resolveRelationalGrounding.ts`](resolveRelationalGrounding.ts), [`normalizeRelationSpan.ts`](normalizeRelationSpan.ts), [`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts), [`interactionUnderTransfer.ts`](interactionUnderTransfer.ts), [`sandboxState.ts`](sandboxState.ts), [`sandboxStep.ts`](sandboxStep.ts), [`sandboxPlan.ts`](sandboxPlan.ts) (Phase C sandbox prerequisite --- not yet consumed by production; `sandboxSelectorReadiness.test.ts` proves the sandbox's output is compatible with the shipped `selectPlanTuple` core via a test-only adapter, but `selectIdentityPlanTuple.ts` / `selectMembershipFromPool.ts` are unmodified --- see [`AGENT.planCompilerSandbox.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.planCompilerSandbox.planning.md)) |
| Frames | [`manipulationFrame.ts`](manipulationFrame.ts) |

## Tests

```bash
cd lambda/ephemera && npm run test -- --watchAll=false \
  dataSource/actions/enrich/objectManipulation/ \
  dataSource/actions/parseCommand.test.ts
```

Authority: [`../../../../AGENT.testing.md`](../../../../AGENT.testing.md).

## Navigation

- Full pipeline sequence + egress tables: [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents)
- Identify / Plan / Synthesize decomposition (Target vocabulary): [`../../AGENT.concepts.md`](../../AGENT.concepts.md)
- Phase C--D planning (Plan IR, plan LLM): [`../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md) (Phase C unblocked --- Gateway exit complete; see **Phase C design debt** in that plan)
