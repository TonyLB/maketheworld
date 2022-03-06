
---
---

# render
This function accepts a list of world object/character pairs, and renders each world object from the point 
of view of that character.  It returns the render outcomes, which can vary depending on whether the
object was a Room, Feature or Map.

---

## Needs Addressed

---

- People need human-readable descriptions of the things in the world
- Different characters should see different things
- Appearance of objects should change depending on the state variables in the assets containing them
- Changes from assets should be aggregated sequentially

---

## Usage

---

```js
    const rendersToUpdate = [{
        EphemeraId: 'ROOM#VORTEX',
        CharacterId: 'Tess'
    },
    {
        EphemeraId: 'FEATURE#ClockTower',
        CharacterId: 'Tess'
    },
    {
        EphemeraId: 'MAP#Downtown',
        CharacterId: 'Marco'
    }]

    globalAssets = ['BASE']
    characterAssets = {
        Tess: ['LayerA', 'MixLayerA'],
        Marco: ['LayerA', 'LayerB', 'MixLayerB']
    }

    const renderOutput = await render({
        renderList: rendersToUpdate,
        assetMeta: existingStatesByAsset,
        assetLists: {
            global: globalAssets,
            characters: characterAssets
        }
    })
```

---
---

## Behaviors

### Expected Ephemera Format

Room objects are expected to be cached in the Ephemera table using the standards
in [**mergeEntries**](../../../assets/cache/README.mergeEntries.md).

### Output

***TODO:*** Document the render output formats