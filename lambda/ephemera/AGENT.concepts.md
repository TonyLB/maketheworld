# Ephemera --- concepts (index)

This file indexes **cross-cutting mental models** for player-visible delivery and related ephemera behavior. Normative rules live in sibling **`*.contract.md`** files or under package **`AGENT.contract.md`** files. Package-local vocabulary (for example positions graphs) stays in package **`AGENT.concepts.md`** files under [`dataSource/`](dataSource/). **Diegetic logic** (play-semantics design) lives in [`diegeticLogic/`](diegeticLogic/).

**Task planning:** open implementation forks stay in [`taskPlanning/`](../../taskPlanning/) --- not here ([`taskPlanning/AGENT.md`](../../taskPlanning/AGENT.md#open-decisions-implementation--plan-only)).

---

## Cross-cutting topics

| Topic | Concepts | Contract | Scope |
| --- | --- | --- | --- |
| **Narrative transcript** | [`AGENT.narrativeTranscript.concepts.md`](AGENT.narrativeTranscript.concepts.md) | *(TBD)* | Fictional sort time (`CreatedTime`), revisions (`MessageId`), delivery looseness vs fan-in correlation |
| **Multi-channel room UI** | [`AGENT.multiChannel.concepts.md`](AGENT.multiChannel.concepts.md) | [`AGENT.multiChannel.contract.md`](AGENT.multiChannel.contract.md) | Room-render vs room-affordances channels, cadence, client composition |
| **Diegetic logic** | [`diegeticLogic/AGENT.concepts.md`](diegeticLogic/AGENT.concepts.md) (+ [`unknowns`](diegeticLogic/AGENT.unknowns.concepts.md)) | *(TBD)* | In-fiction coherence; knowns/unknowns; play-time operator design (pre-code) |

---

## Consumer pointers

| Area | Role |
| --- | --- |
| [`diegeticLogic/`](diegeticLogic/) | Play-semantics design; operators graduate to positions / actions / perception |
| [`publishMessage/`](publishMessage/) | Assigns wire `CreatedTime`, deferred coalescing, target resolution |
| [`dataSource/perception/`](dataSource/perception/) | Correlated fan-in; emits `PublishMessage` rows |
| [`charcoal-client/src/slices/messages/AGENT.md`](../../charcoal-client/src/slices/messages/AGENT.md) | Client ingest, `presentation` transcript, `getMessagesByRoom` |
| [`packages/mtw-interfaces/ts/messages.ts`](../../packages/mtw-interfaces/ts/messages.ts) | Wire `MessageAddressing` (`MessageId`, `CreatedTime`, `Target`) |

**Fan-in framework:** [`packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md`](../../packages/mtw-lambda-patterns/ts/dataSource/AGENT.implementation.md#fan-in-cluster-pattern-multi-leg-ingress-correlation) --- read **narrative transcript** concepts before tightening cluster output shapes.
