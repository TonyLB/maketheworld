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

## Subscribes to

- ***WML***:
    - Content Update
    - Authorization Update

- ***Asset***:
    - Asset Added
    - Asset Removed
    - Asset Canonized
    - Asset Decanonized

---

## Events Streamed

- ***[TODO] Character Added***: When a character has been added to a cached asset
- ***[TODO] Character Update***: When a character's content has been updated in a cached asset
- ***[TODO] Character Removed***: When a character has been removed from a cached asset
- ***[TODO] Character Assigned***: When a character receives a player-can-play grant
- ***[TODO] Character Unassigned***: When a character loses a player-can-play grant

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
    fileURL?: string;
    HomeId: string;
}
```

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
    global: Boolean; // Whether to update only the connection that started the outlet, or all connections
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

## Testing Patterns

---

### InternalCache Dependency Injection

The `internalCache` is a global singleton that provides caching services across the lambda. While this works well in production, it can make unit testing difficult due to Jest's module caching behavior and the difficulty of mocking global instances.

#### Pattern Implemented

We've implemented a **dependency injection pattern** that allows tests to inject mock instances while keeping production code clean:

```typescript
// In the function signature, add an optional override parameter
export const perceptionMessage = async ({ 
    payloads, 
    messageBus, 
    internalCacheOverride 
}: { 
    payloads: PerceptionRequestMessage[], 
    messageBus: MessageBus,
    internalCacheOverride?: any
}): Promise<void> => {
    // Use a local getter function to choose between override and default
    const getCache = () => internalCacheOverride || internalCache
    
    // Use getCache() instead of internalCache directly throughout the function
    const messageMetaForCharacter = await getCache().ComponentMeta.getAcrossAssets(ephemeraId, assetList)
    // ... rest of the function
}
```

#### Usage in Tests

```typescript
// Create a mock instance with the methods you need
const mockInternalCache = {
    Global: {
        get: jest.fn().mockResolvedValue(['Base'])
    },
    CharacterMeta: {
        get: jest.fn().mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            // ... other properties
        })
    },
    ComponentMeta: {
        getAcrossAssets: jest.fn().mockResolvedValue({
            [`ASSET#Base`]: new StandardMessage({
                // ... component data
            })
        })
    }
} as any

// Pass the mock to the function
await perceptionMessage({ 
    payloads: [/* test payload */], 
    messageBus: messageBusMock,
    internalCacheOverride: mockInternalCache
})
```

#### Benefits

1. **Clean Production Code**: Production code uses the default `internalCache` instance without any test-specific logic
2. **Reliable Testing**: Tests can inject completely controlled mock instances without worrying about module caching issues
3. **Type Safety**: The pattern maintains TypeScript type checking
4. **Minimal Changes**: Only requires adding an optional parameter and a local getter function

#### Future Candidates for This Pattern

The following functions and modules could benefit from this same dependency injection pattern:

- **`lambda/ephemera/executeAction`**: Uses `internalCache` for character and room lookups
- **`lambda/ephemera/moveCharacter`**: Uses `internalCache` for room and character validation
- **`lambda/ephemera/checkLocation`**: Uses `internalCache` for location-based queries
- **`lambda/ephemera/fetchEphemera`**: Uses `internalCache` for character and room data
- **`lambda/ephemera/characterEvents`**: Uses `internalCache` for character state management
- **`lambda/ephemera/registerCharacter`**: Uses `internalCache` for character registration
- **`lambda/ephemera/guestCharacter`**: Uses `internalCache` for guest character handling
- **`lambda/ephemera/canonUpdate`**: Uses `internalCache` for canonical data updates
- **`lambda/ephemera/roomUpdate`**: Uses `internalCache` for room state updates
- **`lambda/ephemera/mapUpdate`**: Uses `internalCache` for map rendering
- **`lambda/ephemera/mapSubscription`**: Uses `internalCache` for map subscription logic

#### Implementation Guidelines

When implementing this pattern in other functions:

1. **Add the optional parameter**: `internalCacheOverride?: any`
2. **Create a local getter**: `const getCache = () => internalCacheOverride || internalCache`
3. **Replace all `internalCache` calls**: Use `getCache()` instead
4. **Update tests**: Create mock instances and pass them via `internalCacheOverride`
5. **Document the pattern**: Add comments explaining the dependency injection approach

This pattern significantly improves test reliability and maintainability while keeping production code clean and performant.

## Related Documentation

- **[Event Flow Documentation](AGENT.event.md)**: Event processing patterns and real-time flow analysis (planned documentation)  
- **[Perception System](perception/AGENT.md)**: Detailed perception processing documentation
- **[Internal Cache System](internalCache/AGENT.md)**: Caching architecture supporting event processing
- **[Assets System](../assets/)**: Asset management and component caching integration
- **[WML System](../wml/)**: Content processing and validation system
- **[System Architecture](../../AGENT.architecture.events.md)**: Overall event architecture principles
- **[Architectural Philosophy](../../AGENT.architecture.philosophy.md)**: Perception-driven processing philosophy

---