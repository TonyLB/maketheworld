
---
---

# assetRender
This function accepts an assetId, and optional prefetched asset state and asset normal form,
and renders the map-relevant information to cache, given the current state.  Map-relevant
information is, at the moment, names and exits on rooms.

---

## Needs Addressed

---

- Map render pulls a lot of global information, and needs to be cached up front
- Each asset has different layers of information to add to the map, and needs to be
    cached separately

---

## Usage

---

```js
    const renderOutput = await assetRender({
        assetId: 'BASE'
    })
```

---
---

## Behaviors

### Expected Ephemera Format

State should be recorded per **executeCode** (TODO: Document executeCode)

### Output

Returns a map keyed by room keys:

```ts
    type RoomExit = {
        name: string;
        to: string;             // The asset-local key of the room target
        toEphemeraId: string;   // The globalized key of the room target (e.g. 'VORTEX', not 'ROOM#VORTEX')
    }

    type RoomCacheItem = {
        EphemeraId: string;
        name: string[];
        exits: RoomExit[];
    }

    type RoomCache = Record<string, RoomCacheItem>
```

Should return the aggregate of only those items which are present in a condition-stack that wholly
executes in the current state.  Should exclude any layers whose conditions are deactivated.
