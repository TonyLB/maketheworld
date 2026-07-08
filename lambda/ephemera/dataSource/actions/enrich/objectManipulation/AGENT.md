# Object manipulation parse pipeline

This folder owns post-classify enrichment for **`ObjectMembershipIntent`** and **`ObjectRelateIntent`**: grounding player language to trusted ids, deciding atomic membership vs relational complexity, and compiling terminal parse payloads.

Parent docs:

- Actions implementation (field tables, egress, playbooks): [`../../AGENT.implementation.md`](../../AGENT.implementation.md#object-manipulation-classify--enrich-steady-state-shipped---b25-split-intents)
- Enrich module inventory: [`../AGENT.md`](../AGENT.md)
- LLM design (two axes): [`../../../llm/AGENT.concepts.md`](../../../llm/AGENT.concepts.md), [`../../../llm/AGENT.contract.md`](../../../llm/AGENT.contract.md)
- Operator semantics: [`../../../diegeticLogic/AGENT.operators.concepts.md`](../../../diegeticLogic/AGENT.operators.concepts.md)

Orchestration lives in [`parseCommand.ts`](../../parseCommand.ts); this folder is the enrich compiler surface ([`index.ts`](index.ts)).

## Pipeline architecture

**Trust posture (v1):** **trusted-output** through terminal parse and positions ingress --- each hop's semantic fields are treated as settled until Error; identity embedding v1 is a partial exception migrating toward fault-tolerant closed-loop ([`embeddingMatch/AGENT.md`](embeddingMatch/AGENT.md)). General vocabulary: [`../../../llm/AGENT.concepts.md`](../../../llm/AGENT.concepts.md) (**Output trust models**).

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

**4. Identity (hybrid)**  
**Purpose:** map classify **`objectSpans`** to exactly one catalog **`objectId`** for a unary membership command.

- **Deterministic slice:** exact **`shortName`** match against merged room + held catalog ([`resolveObjectSpan.ts`](resolveObjectSpan.ts), [`catalogMerge.ts`](catalogMerge.ts)).
- **Embedding tier (shipped):** cosine-similarity fast path between exact match and identity LLM when conjunctive gates pass on pre-attached **`EMBEDDING#IMPROMPTU`** vectors --- [`resolveObjectSpanByEmbedding`](embeddingMatch/resolveObjectSpanByEmbedding.ts), [`decideEmbeddingMatch`](embeddingMatch/decideEmbeddingMatch.ts), [`rankCatalogByCosineSimilarity`](embeddingMatch/rankCatalogByCosineSimilarity.ts); locked thresholds in [`embeddingMatch/thresholds.ts`](embeddingMatch/thresholds.ts) (`T_ABS=0.14`, `T_ABS_UNARY=0.18`, `T_MARGIN=0.008`); span embed via [`../../objects/embedding/embedObjectSpan.ts`](../../objects/embedding/embedObjectSpan.ts) with per-invocation dedupe ([`spanEmbedCache`](embeddingMatch/spanEmbedCache.ts)); catalog vectors attached at parse ingress ([`attachEmbeddingsToCatalogEntries`](../../attachEmbeddingsToCatalogEntries.ts)). **Calibration findings, asymmetric index experiments, and deferred closed-loop recommender architecture:** [`embeddingMatch/AGENT.md`](embeddingMatch/AGENT.md).
- **Semantic hop (conditional):** when embedding abstains, deterministic resolve returns **AmbiguousMatch**, or span embed invoke fails, the **identity LLM** picks the best single **`objectId`** from the allowed catalog (**optimistic best-effort** referential resolution using command + catalog context). Parser rejects ids outside the catalog.

**Handoff:** one grounded **`objectId`** or terminal resolve Error.

**5. Unary collapse (deterministic)**  
Require exactly one resolved target; fail on zero or multiple grounded ids ([`unaryCollapse.ts`](unaryCollapse.ts)).

**6. Membership observation + complexity pre-gates (deterministic)**  
Read authoritative **membership containers** and, when there is a sole host, that host's **`positionGraph`**. Pre-gates close simple atomics when topology is unambiguous:

| Outcome | Meaning |
| --- | --- |
| **Error** (`noMembershipHost`) | No membership host for the object |
| **complex** (`multiPresent`) | Object on multiple membership hosts |
| **atomic** (`takeHold` / `drop`) | Sole host is room (take) or actor character inventory (drop), and object does **not** touch an **exit edge** on that host graph |
| **deferToComplexityLlm** | Object touches an **exit edge** on its sole membership host, or host pattern is not closed by rules above |

**Steady-state intent:** anything whose membership-host graph includes an **exit edge** that references the object needs **added processing** beyond the simple room/character-host heuristic --- hence defer to the complexity hop. In-host **relational** edges alone do **not** trigger this defer; they are handled on the **`ObjectRelateIntent`** path or by future composition (Phase C).

**7. Agreement gate (deterministic, atomic path only)**  
When pre-gates return **atomic**, reconcile classify **`verbClass`** with graph-derived **`operationKind`** ([`verbMembershipAgreement.ts`](verbMembershipAgreement.ts)): e.g. **`release`** + room-hosted object -> **`notCarryingObject`** Error.

**8. Complexity LLM (semantic reasoning, conditional)**  
**Purpose:** when pre-gates **defer**, judge whether the player still intends a **simple membership atomic** (`takeHold` / `drop`) despite exit-edge topology on the host, or whether the command is **relationally complex** (`complexityClass: relationalPlacement` terminal stub on the membership path).

The hop receives grounded **`objectId`**, membership containers, and which **exit edges** touch the object --- not a full graph dump.

**Handoff:** atomic **`operationKind`** (`takeHold` | `drop`) or complex **`complexityClass`** (terminal Error via [`finalizeComplexityFromEnrich`](interpretAndFinalize.ts)).

**Known gap (documented debt):** the complexity path **does not** run the **`verbClass`** agreement gate today. A complexity atomic **`operationKind`** can disagree with classify language. Per [`llm/AGENT.contract.md`](../../../llm/AGENT.contract.md), graph-shaped judgment in an LLM hop should **not** override classify-owned membership language without an explicit reconciliation stage --- treat missing agreement on this path as **fix later**, not steady-state design.

---

#### Relational branch (frame extract + `compileRelational`)

**9. Frame extract LLM (semantic reasoning)**  
**Purpose:** from player language, extract a **manipulation frame**: **`subjectSpan`**, **`targetSpan`**, **`relationSpan`**, and relational **`operationKind`** (`establishRelation` | `dissolveRelation`, **BD-12**). Classify **`objectSpans`** are **hints only** in the prompt; frame extract re-derives role-tagged spans. Whether that split is always correct in edge cases is an open review surface --- this doc is the reference for that exploration.

**Handoff:** validated JSON -> [`ManipulationFrame`](manipulationFrame.ts) (raw language spans + **`operationKind`**; no EphemeraIds).

**10. Relation normalizer (deterministic)**  
Map **`relationSpan`** -> **`relationKind`** enum (`On` | `Under` | `Against`) or **`Custom`** + **`relationLabel`**; **`in`** / **`inside`** / **`into`** -> **`nestingRelational`** Error ([`normalizeRelationSpan.ts`](normalizeRelationSpan.ts)).

**11. Relational grounding (hybrid)**  
Resolve **`subjectSpan`** and **`targetSpan`** to room-catalog **`objectId`**s (**BD-5**: room catalog only for v1). Same three-tier identity pattern as membership: exact resolve, embedding fast path on **NoMatch** (skip on **AmbiguousMatch**), identity LLM on abstain / ambiguous / embed failure.

**12. Relational legality (deterministic)**  
Observe the host **`positionGraph`** ([`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts)): both nodes on graph; **`dissolveRelation`** requires a matching edge; **`establishRelation`** allows idempotent duplicate; **conflicting existing relational topology** on subject/target -> **`complexRelational`** Error stub (Phase D plan LLM is the future escalation --- see planning doc).

**13. Terminal compile (deterministic)**  
[`compileRelational`](compileRelational.ts) emits **`EstablishRelation`** or **`Error`**.

---

**In one sentence:** classify **membership vs relational topology** and language direction, **ground** object references, **close** simple membership atomics from graph truth or **defer** when exit edges complicate the host, **extract** relational frames and operator choice when the intent is in-host edges, then **compile** to trusted terminal parse or player-facing Error.

### Field ownership (quick reference)

| Field | Owning stage | Lane |
| --- | --- | --- |
| Intent **`type`** (`ObjectMembershipIntent` \| `ObjectRelateIntent`) | Classify | Semantic |
| **`verbClass`** | Classify (**membership only**) | Semantic |
| **`objectSpans`** / **`rawObjectSpans`** | Classify (hints); frame extract re-tags on relational path | Semantic + re-extract |
| Membership **`operationKind`** (`takeHold` \| `drop`) | Enrich pre-gates + agreement (atomic path); complexity LLM when deferred | Deterministic + semantic defer |
| Relational **`operationKind`** (`establishRelation` \| `dissolveRelation`) | Frame extract (**BD-12**) | Semantic |
| **`relationKind`** / **`relationLabel`** | Relation normalizer | Deterministic |
| Grounded **`objectId`** / **`subjectId`** / **`targetId`** | Identity + grounding stages | Deterministic + embedding tier + conditional identity LLM |

Normative rules: [`llm/AGENT.contract.md`](../../../llm/AGENT.contract.md) (**Deterministic enrich boundary**).

### Bedrock budget (after classify)

| Path | Typical hops |
| --- | --- |
| Membership | **0** when exact identity + atomic pre-gates succeed; **+1 Titan embed** per distinct span on exact miss (skipped when embedding resolves); **1** identity LLM and/or **1** complexity LLM when those stages defer |
| Relational | **+1** frame extract; **0--2** Titan embeds (per distinct span on exact miss); **0--2** identity LLM calls (per span) when embedding abstains or resolve is ambiguous |

Eligible exact-name, single-span, single-host, exit-edge-free **`takeHold`** / **`drop`** may need **zero** post-classify Bedrock calls.

## Key files

| Area | Files |
| --- | --- |
| Entry + route | [`index.ts`](index.ts), [`cardinalityGate.ts`](cardinalityGate.ts) |
| Membership compiler | [`compileMembershipAtomic.ts`](compileMembershipAtomic.ts), [`membershipFrame.ts`](membershipFrame.ts), [`complexityPreGates.ts`](complexityPreGates.ts), [`membershipObservation.ts`](membershipObservation.ts) |
| Identity + prompts | [`identityStage.ts`](identityStage.ts), [`buildPrompt.ts`](buildPrompt.ts), [`interpretIdentity.ts`](interpretIdentity.ts), [`resolveObjectSpan.ts`](resolveObjectSpan.ts), [`embeddingMatch/`](embeddingMatch/) (policy + wiring) |
| Complexity finalize | [`interpretAndFinalize.ts`](interpretAndFinalize.ts), [`complexityClasses.ts`](complexityClasses.ts) |
| Relational | [`frameExtract/runFrameExtractStage.ts`](frameExtract/runFrameExtractStage.ts), [`frameExtract/buildFrameExtractPrompt.ts`](frameExtract/buildFrameExtractPrompt.ts), [`compileRelational.ts`](compileRelational.ts), [`resolveRelationalGrounding.ts`](resolveRelationalGrounding.ts), [`normalizeRelationSpan.ts`](normalizeRelationSpan.ts), [`evaluateRelationalLegality.ts`](evaluateRelationalLegality.ts) |
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
- Phase C--D planning (Plan IR, plan LLM): [`../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.manipulationFrameAndRelational.planning.md) (Phase C blocked on [`AGENT.faultTolerantObjectManipulation.planning.md`](../../../../../../taskPlanning/lambda/ephemera/dataSource/actions/AGENT.faultTolerantObjectManipulation.planning.md))
