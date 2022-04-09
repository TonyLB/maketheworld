---
---

# ScopeMap

The ScopeMap class handles the mapping from local and imported keys in an Asset to the
globally-specified keys that are used internally to store item data in the database.

---

## Needs Addressed

---

- Programmers need a straightforward way to handle translation of keys during Asset
management

---

## Usage

### Constructor

```ts
    const scopeMap = newScopeMap({
        VORTEX: 'ROOM#VORTEX',
        clockTower: 'FEATURE#1234-abcd',
        downtownMap: 'MAP#5678-efef'
    })
```

### importAssetIds

Pulls global mapping data from the mapping of previous imports, merges it into the ScopeMap
object key mapping, and then returns the calculated importTree.

```ts
    const importTree = await scopeMap.importAssetIds({
        VORTEX: {
            asset: 'BASE',
            key: 'VORTEX',
        },
        welcomeRoom: {
            asset: 'BASE',
            key: 'welcome'
        }
    })
```

### getTranslateFile

Looks up the translate file from S3 and imports the key mappings into the ScopeMap object.
Returns non-scope contents of the translateFile.

```ts
    const { asset, importTree } = await scopeMap.getTranslateFile(s3Client, { name: '/Player/Test/Assets/ImportTest.translate.json' })
```

### translateNormalForm

Adds translated keys to all mappable entries in a NormalForm:  EphemeraId added to Room, Map and Feature tags.
toEphemeraId added to Exits.  toFeatureId and targetTag added to Links.  Any unmapped entries in the asset are
given a UUID mapping (which is merged into the existing scopeMap data)

```ts
    const newNormalForm = scopeMap.translateNormalForm(oldNormalForm)
```

---

## Behaviors

---



---