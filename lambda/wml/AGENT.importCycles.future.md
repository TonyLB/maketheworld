# Future work: prevent cross-asset import cycles at WML acceptance

**Status:** Deferred. **Purpose:** Track exploration of rejecting or repairing edits **before** commit when they would create a **directed cycle** in cross-asset import (`_from`) graphs---so problematic states never reach **`assets`** / Dynamo.

## Context

- [`lambda/assets/dataSource/components/verticals/AGENT.md`](../assets/dataSource/components/verticals/AGENT.md) documents that **`assets`** runs **after** **`wml`** accepts edits, so cycle detection at **`assets`** is **diagnostic / index salvage**, not rejection-at-source.
- The **client** may already fence some edits when graph context is loaded.
- **Proper** prevention requires **`wml`** (or a validation API invoked during accept) to see **enough cross-asset import edges**---possibly expensive (traverse imports / load asset closure).

## Direction (not committed)

- Define **what graph** is in scope at accept time (loaded assets only vs server-assisted full closure).
- Run **cycle detection** (DFS / SCC) on directed edges implied by proposed **`_from`** plus known peers.
- **Reject** or **block save** with a clear author-facing message when an edit would close a cycle.

## Related

- [`lambda/assets/dataSource/components/verticals/AGENT.md`](../assets/dataSource/components/verticals/AGENT.md) (**Cycles (imports)** behavior and salvage boundary).
- [**`mtw.assets.components.verticals` writer**](../assets/dataSource/components/verticals/AGENT.md) (index salvage vs authoring truth).
