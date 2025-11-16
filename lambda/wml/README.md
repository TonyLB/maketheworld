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

## Merge Conflict
- AssetId: `ASSET#{id}`
- RequestId: uuid

This event means that the system tried to apply an edit, but failed because it was in conflict
with the current state of the asset

## Related Documentation

- **[Asset Zones](AGENT.zones.md)**: Zone system concepts and access patterns (WML lambda is zone authority)
- **[S3 Storage Architecture](s3Storage/AGENT.md)**: Current architecture with chunk-based snapshots (Phase 1 & 2 complete)
- **[S3 Storage Development](s3Storage/AGENT.development.md)**: Future enhancements and Phase 3 planning
- **[Publishing Strategy](AGENT.s3storage.publishing.plan.md)**: Draft management and publishing workflow
- **[Event Flow Documentation](AGENT.event.md)**: Event processing patterns and content flow analysis
- **[WML Language System](../../packages/mtw-wml/ts/AGENT.md)**: Core WML language documentation and parsing
- **[Assets System](../assets/)**: Asset caching and component management integration
- **[Ephemera System](../ephemera/)**: Real-time game state and character interaction system
- **[System Architecture](../../AGENT.architecture.events.md)**: Overall event architecture principles
- **[Architectural Philosophy](../../AGENT.architecture.philosophy.md)**: Core architectural philosophy and design principles

---
---