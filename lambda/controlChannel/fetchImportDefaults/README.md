
---
---

# fetchImportDefaults
This function fetches simple default values for appearance for Rooms and Features imported into
personal assets.  This allows the front-end client creator tools to display sensible defaults
for those values for the user to add customizations in the layer they're editing.  Those
defaults may not be what is being rendered at any particular moment (they are just what
will render if all conditionals fail), but they are a simple starting point that is easy
to fetch and calculate.

---

## Needs Addressed

---

- Front-end clients need to see something for imported rooms and features.

---

## Usage

---

```js
    await fetchImportDefaults({
        LayerA: {
            welcomeRoom: 'layerAWelcomeRoom',
            hallway: 'hallway'
        },
        LayerB: {
            walkway: 'outsideWalkway'
        }
    })
```

---

## Behaviors

### Expected Ephemera Format

**fetchImportDefaults** expects specific structures in the asset DynamoDB table:

---

*Meta::Asset entries*

| AssetId | DataCategory | importTree |
| --- | --- | --- |
| ASSET#LayerA | Meta::Asset | { BASE: {} } |
| ASSET#LayerB | Meta::Asset | { test: { BASE: {} } |

*Room adjacency list entries*

| AssetId | DataCategory | scopedId | appearances |
| --- | --- | --- | --- |
| ROOM#123 | ASSET#LayerA | layerAWelcomeRoom | [{ render: [': test addition'] }] |
| ROOM#345 | ASSET#LayerA | hallway | [] |
| ROOM#123 | ASSET#BASE | baseWelcome | [{ render: ['Test description'] }]
| ROOM#345 | ASSET#BASE | passage | [{ name: 'passage', render: ['Test'] }]
| ROOM#567 | ASSET#LayerB | outsideWalkway | [{ name: "Widow's walk" }]

### Output

**fetchImportDefaults** returns a mapping suitable for use in front-end creator client

```ts
    output = {
        welcomeRoom: {
            render: ['Test description', ': test addition']
        },
        hallway: {
            name: 'passage',
            render: ['Test']
        },
        walkway: {
            name: "Widow's walk"
        }
    }
```
