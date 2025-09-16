---
---

# WML Data Product
---

The WML data product owns the domain of all WML representations, and the associated NDJSON files
that represent the machine-readable standardForm version of that same data. As with most MTW data
products, the WML product consists of the following:
- WebSocket API calls for client-side inputs
- Internal API calls for process inputs
- A state API call for delivering the materialized current view of a given asset
- An eventBridge source (mtw.wml) for delivering delta changes to assets

Additionally, WML exposes the materialized current view (machine readable) in NDJSON S3 objects,
which subscribers can read directly. This is generally a more efficient way to get an atomic
update on state.

---

# EventBridge Events

---

## Content Update
- AssetId: `ASSET#{id}`
- RequestId: uuid
- schema: A WML schema with (likely) edit elements such as Replace and Remove, as well as added new
plain elements, that has been applied to the specified asset.

This event means that an edit has been applied to the asset

## Authorization Update
- AssetId: `ASSET#{id}`
- RequestId: uuid
- schema: A WML schema with (likely) edit elements such as Replace and Remove, as well as added new
plain elements, that has been applied to authorization layer of the specified asset.

## Content Removed
- AssetId: `ASSET#{id}`
- RequestId: uuid

This event means that an asset's content has been removed or the asset has been deleted.
This should be published when assets are moved to Archive zone or when their content is reset to empty.

**TODO**: This event needs to be implemented in the WML lambda. Currently missing but required by the assets data source for proper decaching.

## Merge Conflict
- AssetId: `ASSET#{id}`
- RequestId: uuid

This event means that the system tried to apply an edit, but failed because it was in conflict
with the current state of the asset

## Related Documentation

- **[Event Flow Documentation](AGENT.event.md)**: Event processing patterns and content flow analysis (planned documentation)
- **[WML Language System](../../packages/mtw-wml/ts/AGENT.md)**: Core WML language documentation and parsing
- **[Assets System](../assets/)**: Asset caching and component management integration
- **[Ephemera System](../ephemera/)**: Real-time game state and character interaction system
- **[System Architecture](../../AGENT.architecture.events.md)**: Overall event architecture principles
- **[Architectural Philosophy](../../AGENT.architecture.philosophy.md)**: Core architectural philosophy and design principles

---
---