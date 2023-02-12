---
---

# Asset Manager

The Assets Lambda manages storage of long-duration Assets, defining the structure of the game world.

---

## Needs Addressed

---

***S3 Intake***
- Asset details must be stored in non-volatile S3 files in WML format
- Asset meta-data must be extracted from the S3 files automatically upon upload or change
- Assets must be able to be healed at any time by reconstructing them from their S3 file
- Assets must be able to exist in and move between three zones of access:
    - Personal assets are shown only to the player who owns them, or as part of Stories they share
    - Library assets are shown only as part of Stories they are imported into
    - Canon assets are shown to all players

***Denormalized Meta-Data***
- For a given asset, the manager should optimize *fetch* on a question of this form (even if that
optimization costs resources at *insert* time):
    - "Show me the default *inherited* values for all items referenced in this asset, as imported
    from other assets.  Including:
        - Default names and descriptions of all Components
        - Previous layers of all Maps, as shown in default condition"
- For a given asset and component ID, the manager should optimize *fetch* on a question of
this form:
    - "Show me all appearances of this component, in all ancestor assets in the import tree,
    in an order in which their dependencies do not conflict (DAG-sorted imports)."

---

## Layers
Different types of data are stored in different thematic layers within the DynamoDB assets table:

- [Player Layer](./README.player.md): This layer stores player information, particularly which characters
the player is currently authorized to play
- [Character Layer](./README.character.md): This layer stores character information, particularly the address
of the WML and JSON files in which the character is defined
- Asset Layer: This layer stores asset information, particularly the address of the WML and JSON files in which
the asset is defined
- [Permissions Layer](./README.permissions.md): This layer stores permission and access information, connecting
players to character and asset files, and characters to asset files to which they have inherent access

---

## Outlets

- ***heal***: Heals all player information from Cognito, assigning characters as they are currently
assigned in the Asset DB.
- ***healAsset***: Accepts an AssetID, looks it up based on current meta-data stored in the DB,
and reprocesses its WML file
- ***move***: Manually moves an asset file (specified by fileName argument) from the fromPath argument
to the toPath argument (DEPRECATED)
- ***checkout***: Moves an asset (specified by checkout) from the Library to the personal assets
of a player (specified by PlayerName)
- ***checkin***: Moves an asset (specified by checkin) from the Personal assets of a player into
the Library
- ***canonize***: Moves an asset (specified by canonize) from the Library into Canon (DEPRECATED)
- ***upload***: Generates a pre-signed S3 URL to upload an asset of type "tag" into "fileName" in
the personal assets of "PlayerName", and return updates on "RequestId"
- ***uploadImage***: Generates a pre-signed S3 URL to upload an Image of type "fileExtension" in
the personal assets of "PlayerName", and return updates on "RequestId"
- ***fetch***: Generates a pre-signed S3 URL to fetch "AssetId" from "fileName" in the personal
assets of "PlayerName"
- ***parseWML***: Accepts a source fileName (likely in the **uploads** folder) and a destination
address, and parses the source WML file as a possible new entry at the address.
- [***fetchImports***](./fetchImportDefaults/README.md): Accepts a list of imports from assets, and
recursively follows the import tree for a vertical slice of all relevant assets for only those items.

---

## S3

---

### Expected S3 Contents, before or after

Expects incoming files in WML Format, with ".wml" extensions

Generates (and later uses) ".json" extension files on the same root name, to track how
local scopedId keys are mapped to global UUID internal DB keys, and what the normal form of the
asset contains

---

## Meta::Asset records

---

### *Key Data*

- AssetId
- DataCategory

### *S3 Meta-Data*

- fileName: The base filename at which data for the asset is stored in S3
    - Base fileName plus ".wml" is the original WML file for the asset
    - Base fileName plus ".json" is the parsed output
- zone:  The zone ('Personal', 'Library', or 'Canon') in which the asset is stored and published
- player: The internal ID of the player (if any) for whom this is a personal asset
- subFolder:  Any subFolder between the zone and the fileName

### *Namespace Meta-Data*

- importTree:  importTree is a nested map.  Each key at the top level represents the owning asset importing values from the asset named in the key.  The *value* stored under that key is, itself, a nested tree of what imports that named asset makes, and so on down the entire tree.
- ancestryTree:  A denormalized nested map of all the Ancestry records (see below), which gives a quick way to fetch all
import ancestors that might have an impact on renders or operations of the asset
- descentTree:  Similary, a denormalized nested map of the Descent records, which gives a quick way to fetch all import
descendants that might be impacted by this asset in their renders or operations
- namespaceMap

### *Asset Denormalizations*

- defaultNames: A mapping from internal scopedId for components to the name (if any) that would be defined for that component in this asset if all conditions return false
- defaultExits: A mapping of all exits defined in this asset if all conditions return false

---

## <Component\> records

---

*For any tag in the component types (Room, Feature), a record will be stored in an adjacency list associated with*
*the Asset (by placing the Asset's AssetId in the DataCategory field of the component record)*

### *Key Data*

- AssetId
- DataCategory
- scopedId:  The key used internally within the asset to refer to this component

### *Component Denormalization*

- defaultAppearances

---

## Meta::Map records

---

*For any Map, a record will be stored in an adjacency list associated with the Asset (by placing the Asset's*
*AssetId in the DataCategory field of the map record)*

### *Key Data*

- AssetId
- DataCategory
- scopedId

### *Map Denormalization*

- defaultAppearances

---

## Ancestry records

---

*If an Asset imports from other Assets, it will have one Ancestry record associated with it in adjacency list*
*that stores the entire ancestry tree of the imported asset*

### *Key Data*

- AssetId
- DataCategory: `Ancestry-${importedScopedId}`
- tree

---

## Descent records

---

*If any other Asset imports from this Asset, this Asset will have one Descent record associated with it in adjacency list*
*that stores the entire descent tree of the importing asset*

### *Key Data*

- AssetId
- DataCategory: `Descent-${importedScopedId}`
- tree

---
