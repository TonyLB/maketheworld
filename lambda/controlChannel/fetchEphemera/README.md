
---
---

# fetchEphemera
This function serializes the state of current Ephemera in order to update a front-end client
(particularly when first connecting to player, to get global baseline information)

---

## Needs Addressed

---

- Front-end clients need to be able to synchronize to the starting state of the Ephemera,
    so that their subscription updates have a baseline to start from.

---

## Usage

---

```js
    await fetchEphemera(RequestId)
```

---

## Behaviors

### Expected Ephemera Format

**fetchEphemera** expects specific structures in the ephemera DynamoDB table:

---

*CharactersInPlay*

| EphemeraId | DataCategory | Name | Connected | RoomId |
| --- | --- | --- | --- | --- |
| CHARACTERINPLAY#ABC | Meta::Character | TestOne | True | VORTEX |
| CHARACTERINPLAY#DEF | Meta::Chraacter | TestTwo | False | Welcome |

### Output

**fetchEphemera** returns a message suitable for posting to WebSocket, with format as follows

```ts
    output = {
        type: 'Ephemera',
        RequestId: 'Request1234',
        updates: [{
            CharacterId: 'ABC',
            Name: 'TestOne',
            Connected: true,
            RoomId: 'VORTEX'
        }]
    }
```

**fetchEphemera** does not deliver any information for characters that are not connected.

---
---

# fetchEphemeraForCharacter (TO BE IMPLEMENTED)
This function serializes the state of current Ephemera from the perspective of a particular
character, to give starting baseline information for things that character sees particularly
(e.g. Maps)

---

## Needs Addressed

---

- Each character connected for play needs an independent baseline of Map information
    (since different characters will see different maps)

---

## Usage

---

```js
    await fetchEphemeraForCharacter({ RequestId: 'Request1234', CharacterId: 'Lucian' })
```

---

## Behaviors

### Expected Ephemera Format

**fetchEphemeraForCharacter** expects specific structures in the ephemera DynamoDB table:

---

*Maps*

```ts
type MapRoomLocation = {
    x: number;
    y: number;
}

type MapAppearance = {
    conditions: AppearanceCondition;
    roomLocations: Record<string, MapRoomLocation>;
}
```

| EphemeraId | DataCategory | Name | appearances |
| --- | --- | --- | --- |
| MAP#ABC | Meta::Map | | |
| MAP#ABC | ASSET#BASE | Grand Bazaar | { ... MapAppearance[] ... } |
| MAP#ABC | ASSET#LibraryStuff | | { ... more MapAppearance[] ... } |
| MAP#DEF | Meta::Map | | |
| MAP#DEF | ASSET#ThievesGuild | Back Alleys | { ... MapAppearance[] ... } |

| EphemeraId | DataCategory | assets |
| --- | --- | --- |
| CHARACTERINPLAY#Lucian | Meta::Character | ['LibraryStuff'] |
| CHARACTERINPLAY#Locke | Meta::Character | ['ThievesGuild'] |
| Global | Assets | ['BASE'] |

### Output

**fetchEphemeraForCharacter** returns a message suitable for posting to WebSocket, with format as follows

```ts
    output = {
        type: 'Ephemera',
        RequestId: 'Request1234',
        updates: [{
            CharacterId: 'Lucian',
            MapId: 'ABC',
            name: 'Grand Bazaar',
            roomLocations: {
                // Render-aggregated set of roomLocations this character can see
            }
        }]
    }
```

**fetchEphemeraForCharacter** does not deliver any information for maps that appear in no assets the character can see.
