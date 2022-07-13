---
---

# Control Channel

The Control Channel lambda handles direct communication with players, routing all other function to
and from the websocket connection

---

## Needs Addressed

---

- The application needs to authenticate users before giving them access
- The application needs to record which player is assigned to a specific websocket connection
- The application needs to update the game world when a websocket connection is disconnected
(since it means characters may disconnect from in-play status)
- The application needs to be able to route messages for a character to the connections that
are subscribing to that character

---

## Outlets

- ***$connect***: Authenticates an incoming connection
- ***$disconnect***: Updates the world on a socket disconnect
- ***registercharacter***: Notifies the system that this socket is connecting to one
of the characters the player has permission to play
- ***fetchEphemera***: Either fetches the state of all current global ephemera (maps
and connected characters) or (if passed a CharacterId) fetches the ephemera information
for one specific character.
- ***fetchImportDefaults***: Fetches default names and appearances for a given Asset
(to help display assets imports in the Library editor)
- ***fetchLibrary***: Fetches the top level table-of-contents for the public library
and the player's personal assets
- ***whoAmI***: Returns player information about the player the connection is registered
to
- ***sync***: Given a targetId and startingAt epoch-milliseconds, sends batches of messages
from messageDelta for everything that has been logged by the system for that target
since that start point
- ***action***: Executes the specified action in the game-space
- ***link***: Returns a description of the specified link (if a Feature or Character) or
executes the associated action (if an Action link)
- ***command***: Parses a character-specified command, and if possible executes it

---

## InternalCache

This lambda uses the internalCache to implement its fetches from the database.  Many
functions use the same data, without knowing (in the complicated cascade) whether that
data has already been fetched.  The internalCache (a) separates concerns over data fetching
into one place, and (b) lets the processes using the data deal with an abstraction of
when (precisely) it is fetched.  Here are the cache items available:

### Global

```ts
type CacheGlobal = {
    ConnectionId: string;
    RequestId: string;
}
```

Stores explicitly assigned values, passed as parameters to the lambda

### CurrentPlayerMeta

```ts
type CurrentPlayerMeta = {
    player: string;
}
```

Fetches information (once) about the player associated with the current connection

### CharacterMeta

```ts
type CacheCharacterMeta = {
    EphemeraId: string;
    Name: string;
    RoomId: string;
    Color?: string;
}
```

Per character ID, stores fetched information about the character.

### CharacterHome

```ts
type CacheCharacterHome = {
    HomeId: string;
}
```

*The above should probably be folded into the CharacterMeta, but doing so will*
*require keeping the HomeID stored in ephemera as well as assets*

Per character ID, stores the HomeID of the character

### RoomCharacterList

```ts
type RoomCharacterActive = {
    EphemeraId: string;
    Color?: string;
    ConnectionIds: string[];
    fileURL?: string;
    Name: string;
}

type RoomCharacterList = Record<string, RoomCharacterActive>
```

Per room ID, stores information about the active characters in that room.

---

## MessageBus

This lambda uses the messageBus to implement its internal message passing.  Many functions
cascade into each other in complicated graphs (e.g. executing code can cause re-rendering rooms
which can cause dispatching of messages), so the messageBus is key to decoupling individual
pieces of functionality and separating concerns.  Here are the messages handled:

### ReturnValue

```ts
type ReturnValueMessage = {
    type: 'ReturnValue';
    body: Record<string, any>;
}
```

Queues properties to be assigned to the return value at completion of the function.

***Cascades***: None

### Connect

```ts
type ConnectMessage = {
    type: 'Connect';
    userName: string;
}
```

Connects the connectionId of the call with the player identified by the userName.  Updates
both ephemeraDB and assetDB in order to make sure that either system can identify later
connections.

***Cascades***: ReturnValue

### Disconnect

```ts
type DisconnectMessage = {
    type: 'Disconnect';
    connectionId: string;
}
```

Disconnects the provided connectionId.  Updates
both ephemeraDB and assetDB in order to make sure that either system can identify later
connections.

***Cascades***: ReturnValue

### WhoAmI

```ts
type WhoAmIMessage = {
    type: 'WhoAmI'
}
```

Identifies the player information connected to the incoming connectionId.

***Cascades***: ReturnValue

### Sync

```ts
type SyncRequest = {
    type: 'Sync';
    targetId: string;
    LastEvaluatedKey?: Record<string, AttributeValue>;
    startingAt?: number;
    limit?: number;
    loopCount?: number;
}
```

Requests a paginated set of message-data sync be queried and delivered to the user

***Cascades***: SyncResponse, Sync (recursive loop)

### SyncResponse

```ts
type SyncResponse = {
    type: 'SyncResponse',
    messages: any[];
    lastSync?: number;
}
```

Delivers a paginated set of message-data sync to the user

***Cascades***: None

### RegisterCharacter

```ts
type RegisterCharacterMessage = {
    type: 'RegisterCharacter';
    characterId: string;
}
```

Registers the connection as playing a given character

***Cascades***: ReturnValue

### EphemeraUpdate

```ts
type EphemeraUpdateEntry = {
    type: 'CharacterInPlay';
    CharacterId: string;
    Connected: boolean;
    RoomId: string;
    Name: string;
    fileURL: string;
}

type EphemeraUpdateMessage = {
    type: 'EphemeraUpdate';
    updates: EphemeraUpdateEntry[];
}
```

Delivers an ephemera update to the connected user

***Cascades***: None

### FetchPlayerEphemera

```ts
type FetchPlayerEphemeraMessage = {
    type: 'FetchPlayerEphemera';
}
```

Requests a full updates of ephemera for the connected player

***Cascades***: EphemeraUpdate

### ImportDefaults

```ts
type ImportDefaultsMessage = {
    type: 'ImportDefaults';
    components: Record<string, any>;
    aggregateExits: any[];
}
```

*Is this message loop better scoped in the asset lambda?*

Delivers an update of current import defaults for presenting a given asset in the
asset editor

***Cascades***: None

### FetchImportDefaults

```ts
type FetchImportDefaultsMessage = {
    type: 'FetchImportDefaults';
    importsByAssetId: Record<string, any>;
    assetId: string;
}
```

Requests an update of current import defaults for presenting a given asset in the
asset editor

***Cascades***: ImportDefaultMessage

### Perception

```ts
type PerceptionMessage = {
    type: 'Perception';
    characterId: string;
    ephemeraId: string;
}
```

Requests a render of some component in the game world, from the perspective of a given
character, and that the render be delivered to the connections playing that character.

***Cascades***: ReturnValue

### MoveCharacter

```ts
type MoveCharacterMessage = {
    type: 'MoveCharacter';
    characterId: string;
    roomId: string;
    leaveMessage?: string;
}
```

Requests a move of the specified character to new specified room, with an optional
leaveMessage to update those in the room being departed.

***Cascades***: None

---