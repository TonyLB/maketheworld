# socketQueue
This class stores and aggregates payloads that should (eventually) be flushed out to
one or more WebSocket connections.

---

## Needs Addressed

---

- Functions that just want to deliver a message on the socket should not be worrying about
    the details of the apiManagementClient SDK
- Socket payloads should be aggregated for compact delivery and easier client parsing:
    - Messages to the same character target should be grouped
    - Ephemera Updates to the same connection should be grouped

---

## Usage

---

```js
    const queue = new SocketQueue()
    queue.send({
        ConnectionId: '1234',
        Message: {
            messageType: 'whatever',
            payload: 'something'
        }
    })
    await queue.flush()
```

---

## Methods

---

| clear |
| --- |
| Removes all the payloads that have been sent to the queue |
| **Arguments**: () |

| send |
| --- |
| Adds a new payload to be delivered to a single connection. |
| **Arguments**: { *ConnectionId*, *Message* } |

| sendGlobal |
| --- |
| Adds a new payload to be delivered identically to all open connections. |
| **Arguments**: *Message* |

| flush |
| --- |
| Aggregates payloads and delivers them to their respective target connections.  Empties the queue afterwards. |
| **Arguments**: ()

---

## Behaviors

### Expected Message Format
Message payloads are expected to have an array of elements each containing a Target and a CreatedTime.

```ts
type Message = {
    Target: string;
    CreatedTime: number;
    // ???
}

type SocketQueueMessagePayload = {
    messageType: 'Messages';
    messages: Message[];
    LastSync?: number;
}
```
Ephemera payloads are expected to contain a list of possible updates (so far 'CharacterInPlay' and
'Map')
```ts
type EphemeraUpdateCharacterInPlay = {
    type: 'CharacterInPlay';
    CharacterId: string;
    Name: string;
    Color?: string;
    RoomId?: string;
    Connected: boolean;
}

type EphemeraUpdateMapLayer = {
    roomLocations: Record<string, { x: number; y: number }>;
    //
    // Does each MapLayer also need exit connections?
    //
}

type EphemeraUpdateMap = {
    type: 'Map':
    CharacterId: string;
    MapId: string;
    Layers: EphemeraUpdateMapLayer[];
}

type SocketQueueEphemeraPayload = {
    messageType: 'Ephemera';
    updates: (EphemeraUpdateCharacterInPlay | EphemeraUpdateMap)[]
}
```
Success and Error messages can also be sent for various operations (so far only 'Upload')
```ts
type SocketQueueUploadError = {
    messageType: 'Error';
    operation: 'Upload';
}

type SocketQueueUploadSuccess = {
    messageType: 'Success';
    operation: 'Upload';
}

type SocketQueuePayload = SocketQueueMessagePayload | SocketQueueEphemeraPayload | SocketQueueUploadError | SocketQueueUploadSuccess
```

### Aggregation

---

**Messages**

---

**Decision**:  Message payloads should not be delivered separately by different Target values (given that
all targets are being delivered to the same Connection).

*Therefore*:  Message payloads are sorted by CreatedTime (interleaving different targets in a sorted
list).  The entire list of messages queued for a given connection is delivered in a single WebSocket
message with a list payload.
