---
---

# WML Data Source

---

The WML data product owns the domain of all S3 files for long-term retention of world-markup-language assets,
and the associated NDJSON files that represent the machine-readable standardForm version of that same data.
As with most MTW data products, the WML product consists of the following:
- WebSocket API calls for client-side inputs
- Internal API calls for process inputs
- A state API call for delivering the materialized current view of a given asset
- An eventBridge source (mtw.wml) for delivering delta changes to assets

---

# EventBridge Events

---

## Asset Edited
- AssetId: `ASSET#{id}` | `CHARACTER#{id}`
- RequestId: uuid
- schema: A WML schema with (likely) edit elements such as Replace and Remove, as well as added new
plain elements, that has been applied to the specified asset.

This event means that an edit has been applied to the asset

## Merge Conflict
- AssetId: `ASSET#{id}` | `CHARACTER#{id}`
- RequestId: uuid

This event means that the system tried to apply an edit, but failed because it was in conflict
with the current state of the asset

---
---