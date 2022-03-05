# fetchEphemera
This function serializes the state of current Ephemera in order to update a front-end client
(particularly when first connecting to player or character, to get baseline information)

---

## Needs Addressed

---

- Front-end clients need to be able to synchronize to the starting state of the Ephemera,
    so that their subscription updates have a baseline to start from.
- Each character connected for play needs an independent baseline of Map information
    (since different characters will see different maps)

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

**fetchEphemeraId** posts messages to all open WebSocket connections, with format as follows

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

**fetchEphemeraId** does not deliver any information for characters that are not connected.
