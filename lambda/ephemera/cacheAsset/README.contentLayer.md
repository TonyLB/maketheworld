# Content Layer

Content Layer information is stored in the Ephemera DyanoDB table in order to provide easy-to-search information about
components represented in assets which have been cached for such ready access. Its general purpose is to provide
search patterns oriented around *components* rather than around *assets* specifically.

## Requirements

To efficiently store content information about components in the Ephemera DynamoDB table, the following needs must be addressed:

- Quickly fetch data for an individual component, regardless of its name or renaming across various assets, to promptly present a character's view of that component.
- Retrieve all necessary information to render a component, organized by conditionals that determine the relevance of each piece of information at any given moment.

## Data Elements

The Content Layer consists of several types of rows in the table, each with distinctive patterns of
search (by EphemeraId and DataCategory, the table's compound key elements), and with their own
specific data formats.

### Asset Meta-Record

A top-level record that connects an ASSET universalKey with the address in the
S3 asset storage where its data files were loaded from when caching occurred.

**Key**: EphemeraId: `ASSET#${AssetKey}`, DataCategory: 'Meta::Asset'
**Data**:

- address: AssetWorkspaceAddress

**Behaviors**: This record should be created or updated only when cached, and should
be removed only when the asset is explicitly decached.

### Component Meta-Record

A single top-level record for the Platonic ideal of a given component (distinct from
the details of how it is specified in any given asset). The record tracks how the component
has been referenced in cached AssetIDs, and how characters and objects are currently relating
to the component in the fictional space.

**Key**: EphemeraId: `${ComponentType}#${ComponentId}`, DataCategory: 'Meta::Room' or 'Meta::Feature'
**Data**:

- cached: A non-empty set of AssetIDs
- activeCharacters ('Meta::Room' items only): A list of characters currently being played who are present in the room

**Behaviors**: The record should be removed when the last per-asset record for that component is decached.

### Component Per-Asset Record

A record stored in an adjacency list associated with a Component universalKey and a specific Asset.
This stores data about how the Component *as a whole* is changed by that one asset (i.e., changes outside of
any specific Example records).

**Key**: EphemeraId: `${ComponentType}#${ComponentId}`, DataCategory: `${AssetId}`
**Data**:

- scopedId: The key used internally within this asset to refer to this component
- Non-rendering information, like Room's shortName, Map's positions, etc.

**Behaviors**: This record should be created or updated whenever the component is cached within an asset and
removed when the asset is decached, or when the asset changes such that it no longer updates the specific component.

### Example Record

A record stored in an adjacency list associated with a Component universalKey, and further specified by
a combined string of an Example universalKey (which is always locally specific to that Component), concatenated
with the AssetId. This stores the rendering data for one asset's view of one particular Example of rendering
the Component. For each Component there can potentially be a large number of these items.

**Key**: EphemeraId: `${ComponentType}#${ComponentId}`, DataCategory: `EXAMPLE#${ExampleId}::${AssetId}`
**Data**:

- name: StandardRender output of the name sub-field of the Example
- summary: Similarly for summary
- description: ... and for description
- [TO BE IMPLEMENTED]: Tags that define under what circumstances this example is the correct one to show
- [TO BE IMPLEMENTED]: A vector embedding to facilitate semantic search

**Behavior**: Should be created when data including Examples is cached, and removed when the relevant
asset is decached, or changed so that it no longer updates that example.
