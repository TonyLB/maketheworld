---
---

# Publish Message

The PublishMessage messageBus handler is the interface to directly publish messages to character connections and to
logs of play.

---

## Needs Addressed

---

The Ephemera lambda needs a simple abstraction with which to deliver messages to active players.

---
---

# Message ordering (not this package's job)

Ordering messages relative to one another --- e.g. "Tess leaves" delivered fractionally before the room
perception message for the place Tess is arriving to, and "Tess arrives" fractionally after it --- belongs to
the presentation compiler, which stamps each line of a compiled plan at `beatAnchorTime + index`
([`positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md#narration-and-presentation)); a
render that resolves late publishes at its listener's stamped time through
[`dataSource/messageOrchestration`](../dataSource/messageOrchestration/AGENT.md).

This package assigns `CreatedTime` only for payloads that carry none of their own: `baseTime + index` in
payload-array order. It has no notion of message groups, relative offsets, or deferred batching.

Narrative ordering uses **fictional transcript time** (`CreatedTime`), not wire packet order --- see
[`../AGENT.narrativeTranscript.concepts.md`](../AGENT.narrativeTranscript.concepts.md).