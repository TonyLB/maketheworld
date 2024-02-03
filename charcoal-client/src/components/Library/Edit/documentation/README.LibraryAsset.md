---
---

# LibraryAsset

The LibraryAsset context presents various ways of looking at a personal asset as it
is being edited in the application

---

## Needs Addressed

---

- To be able to consistently load and save, Assets should be stored locally in WML format
as editing and display proceeds (rather than serialized just before saving)
- Programmers need a straightforward way of pulling organized information from
the WML data, without having to manually recreate the steps to pull that information
out at every single component

---

## Usage

### LibraryAsset context wrapper

```ts
    <LibraryAsset assetKey={assetKey || ''}>
        <Routes>
            <Route path={'WML'} element={<WMLEdit />} />
            <Route path={'Map/:MapId'} element={<MapEdit />} />
            <Route path={'Room/:RoomId'} element={<RoomDetail />} />
            <Route path={'Feature/:FeatureId'} element={<FeatureDetail />} />
            <Route path={''} element={<AssetEditForm />} />
        </Routes>
    </LibraryAsset>
```

### useLibraryAsset

```ts
    const { assetKey, normalForm, schema, updateSchema, defaultAppearances, updateWML, rooms } = useLibraryAsset()
```

---

## Behaviors

---

### Properties

- ***assetKey***: The asset-manager key through which the asset is written and fetched
- ***AssetId***: The database key for searching ephemera or asset items from the DB
- ***currentWML***: The text of the currently stored WML for the asset
- ***draftWML***: The text of the current WML in the editor (which may differ from currentWML
if the editor is in an unparsable error state)
- ***normalForm***: The normal form of all current data for the asset
- ***defaultAppearances***: The basic appearance of all components in the asset
*as inherited from* the import-tree of assets they are imported from (before the
changes in the asset itself)
- ***rooms***: Room information aggregated across all default (non-conditioned) tags for
each room
- ***features***: Feature information aggregated across all default (non-conditioned) tags for
each feature

### Methods

- ***updateSchema***: (value: UpdateSchemaPayload) => void: Adds, deletes, and replaces elements
in the current schema directly
- ***updateWML***: (value: string) => void: Updates the current WML
- ***save***: () => void: Initiates an asynchronous save to the asset manager back-end