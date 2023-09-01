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

# OrchestrateMessage IntenralCache

The OrchestrateMessage internalCache class is the interface by which the system can order messages relative to
one another, so that they are delivered in the proper sequence.

---

## Needs Addressed

---

Some messages need to be delivered before or after other messages: e.g., "Tess leaves" should be delivered
fractionally before the Room perception message for the place Tess is arriving to, and "Tess arrives" should
be delivered fractionally after that perception event.

---

## Tree fragments

Messages can be tagged with a "MessageGroup" UUID that associates them with a certain group of messages.
These messageGroups are stored in the internalCache (and generated from its class functions) along with
their relations with each other.

```js
type MessageGroupId = string;

type MessageGroupOrchestration = {
    messageGroupId: MessageGroupId;
} &
({
    type: 'branch';
    before: MessageGroupId[];           // A list of messageGroups that must occur before this one, with no necessary ordering relative to each other
    after: MessageGroupId[];            // A list of messageGroups that must occur after this one, with no necessary ordering relative to each other
    during: MessageGroupId[];           // A list of messageGroups that must be reported, in sequence order, after all "before" items and before all "after"
} |
{
    type: 'leaf';
})
```

---

## Orchestration

As part of the handling of Publish Message, the "allOffsets" method of the OrchestrateMessage cache is called, returning a list
of time-offsets for each messageGroup in the cache. These offsets will be both positive and negative, with the root node of each
tree being at offset zero, before branches being offset into the past and after branches into the future. Each publishMessage
that has a messageGroupId assigned will have the relevant time-offset applied when the message is delivered, ensuring that message
order is presented as intended.