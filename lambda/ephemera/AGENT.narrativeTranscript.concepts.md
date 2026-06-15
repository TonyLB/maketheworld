# Narrative transcript --- concepts and vocabulary

Concept extension of [`AGENT.concepts.md`](AGENT.concepts.md). Normative wire and producer rules: **`AGENT.narrativeTranscript.contract.md`** *(not yet drafted)*. Client ingest detail: [`charcoal-client/src/slices/messages/AGENT.md`](../../charcoal-client/src/slices/messages/AGENT.md). Room header composition (orthogonal): [`AGENT.multiChannel.concepts.md`](AGENT.multiChannel.concepts.md).

---

## Core vocabulary

| Term | Meaning |
| --- | --- |
| **Narrative transcript** | The time-ordered log a character sees in the message panel --- a **fictional** timeline for storytelling and UI, not a claim about when the server finished work. |
| **Transcript position** | Where a line sits in that log, carried on the wire as **`CreatedTime`** (with **`MessageId`** as tie-breaker). |
| **Revision** | Another payload for the **same** logical **`MessageId`**; may use a new **`CreatedTime`** without intending a second bubble (see revision vs position below). |
| **Beat** | A small set of lines that must appear in a **fixed narrative order** relative to each other (for example leave, room header, arrive on cross-room move). |
| **Correlation** | Server-side bookkeeping that decides **what copy** to emit and **when enough inputs exist** (fan-in clusters, PerceptionThreads). **Not** the same thing as transcript position. |

---

## Fictional `CreatedTime`

Player-facing messages use **`CreatedTime`** as **where the line belongs in the story**, not as wall-clock truth.

- The server assigns **`CreatedTime`** at publish time (see [`publishMessage/index.ts`](publishMessage/index.ts)).
- Dynamo **`message_delta`** keys rows as **`DeltaId = CreatedTime::MessageId`**.
- The client sorts and sections the transcript by **`(CreatedTime, MessageId)`** ([`charcoal-client/src/slices/messages/index.ts`](../../charcoal-client/src/slices/messages/index.ts)).
- **`OrchestrateMessages`** ([`internalCache/orchestrateMessages.ts`](internalCache/orchestrateMessages.ts)) expresses **relative** positions within a beat: **`before`** / root / **`after`** groups become negative / zero / positive offsets on a shared invocation **`baseTime`** ([`publishMessage/README.md`](publishMessage/README.md)).

**Implication:** Backend latency, handler order, and websocket packet order are **implementation details**. What matters for display is that each row carries the **intended transcript position**.

---

## Two mechanisms: position vs revision

The wire type does not separate "sort key" and "revision timestamp" into two fields. The system uses **two different rules**:

### 1. Transcript position (`CreatedTime` on new lines)

For a **new** logical line (new **`MessageId`**), **`CreatedTime`** is the narrative instant that line **first mattered**. Examples: **`WorldMessage`** leave/arrive, first header for a room section, chat lines.

### 2. In-place revision (`MessageId` stable)

For **`PerceptionMessage`** (and similar correlated rows), the **same** **`MessageId`** may receive **Generating** then **terminal** payloads. The client keeps **one** bubble per id in **`presentation`**, updating body while **anchoring** position to **`earliestCreatedTime`** for that id ([`charcoal-client/src/slices/messages/AGENT.md`](../../charcoal-client/src/slices/messages/AGENT.md) **Transcript model**).

Render-correlated threads may also set **explicit** `createdTime` on the bus payload (**`T0`** on Generating, **`max(T0 + 1, now)`** on terminal) --- see [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md).

**Do not conflate:** fan-in "wait until both legs exist" is about **choosing narrative copy**. **`MessageId`** replace pipelines are about **updating an existing line without moving it**.

---

## What delivery may be loose

These are **not** required for a correct transcript if **`CreatedTime`** (and **`MessageId`** rules) are right:

| Loose | Why it is OK |
| --- | --- |
| **Websocket packet order** | Client and server both sort by **`CreatedTime`** before display. |
| **Same lambda invocation** | Rows may publish from different handlers or invocations if transcript times are assigned coherently. |
| **Single batched publish** | Deferred coalescing ([`publishMessage/coalescer.ts`](publishMessage/coalescer.ts)) batches at settle for convenience --- not a client contract. |
| **Fan-in leg order** | Intent and fact may arrive in any order; completion is "all required legs present" ([`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation)). |
| **Emit cluster as one tuple** | Leave, header, and arrive may be **separate** `PublishMessage` publishes sharing an **`OrchestrateMessages`** tree (or explicit times). |

**Example:** Room header at transcript time **X**, leave at **X - 1 ms**, arrive at **X + 1 ms** --- even if leave arrives on the wire a second after the header, the user sees leave, then header context, then arrive.

**UX caveat:** Very late packets can cause **brief** intermediate UI (auto-scroll, withhold rules) before the transcript settles. Product norm is **eventual transcript consistency**, not frame-perfect simultaneous paint.

---

## What must stay tight

| Tight | Why |
| --- | --- |
| **Relative order inside a beat** | Leave before header before arrive for cross-room move (via offsets or explicit times). |
| **`(CreatedTime, MessageId)` sort** | End-to-end contract: Dynamo, websocket, client **`history`**. |
| **Same-`MessageId` replace semantics** | Generating/terminal and sticky header behavior depend on stable ids per channel ([`AGENT.multiChannel.contract.md`](AGENT.multiChannel.contract.md)). |
| **Terminal dedupe** | Do not surface two **final** deliveries for the same logical completion ([`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md) **Routing identity**). |
| **Separate concerns** | Correlation chooses **what** to say; transcript fields choose **where** it sits. |

---

## Relation to PerceptionThreads and fan-in

Today **`characterMove`** registers a targeting-only PerceptionThreads row after membership persist so async header render can correlate to a bucket ([`orchestrateNavigate.ts`](moveCharacter/orchestrateNavigate.ts), [`dataSource/perception/AGENT.md`](dataSource/perception/AGENT.md)). That registration is **render targeting bookkeeping**, not a transcript law. Leave/arrive world lines publish from **membership fan-in** with explicit **`createdTime`** (Model A **`beatAnchorTime`**) --- independent of header render lifecycle.

**Target fan-in model:** clusters correlate ingress legs (intent + fact, kick + terminal, etc.), then emit **independent** `PublishMessage` rows with coherent **`messageGroupId`** / **`CreatedTime`** assignments. Cluster completion should be **order-independent**; output should not re-require "emit `[Leave, Header, Arrive]` in one synchronous block."

**Anti-patterns to avoid when designing fan-in specs:**

- Requiring all legs of a cluster to publish in one handler pass "so order is right"
- Treating deferred coalescer batching as the only way to get narrative order
- Using side-band registration order as a substitute for explicit transcript times
- Conflating **`clusterKey`** with **`messageGroupId`** unless deliberately chosen

---

## Relation to multi-channel

**Narrative transcript** answers: *when does this line appear in the log?*

**Multi-channel** answers: *how do render and affordance rows compose in the sticky header?*

Channels are **semantically independent** on the wire; the client merges them for one virtual header ([`AGENT.multiChannel.concepts.md`](AGENT.multiChannel.concepts.md)). Affordance rows still have their own **`CreatedTime`** for aggregation tie-breaks; render rows **anchor** room-section position per multi-channel contract.

---

## Producer map (where times are assigned)

| Mechanism | Location | Role |
| --- | --- | --- |
| **`OrchestrateMessages` offsets** | [`publishMessage/index.ts`](publishMessage/index.ts) | Relative beat ordering within an invocation |
| **Explicit `createdTime` on bus payload** | Perception orchestration, some render threads | Generating/terminal overwrite timing |
| **`deliveryMode: 'deferred'`** | Move cluster, some perception legs | Hold until settle; still sorted by **`CreatedTime`** on flush |
| **Client `presentation` overload** | [`charcoal-client/src/slices/messages/index.ts`](../../charcoal-client/src/slices/messages/index.ts) | Stable position for revised bodies |

---

## Graduation

When normative rules are ready, add **`AGENT.narrativeTranscript.contract.md`** (must/must-not for producers and consumer assumptions) and link from [`AGENT.concepts.md`](AGENT.concepts.md). Fan-in Phase 0/1 specs should cite the contract for cluster **output** obligations.
