---
---

# Ephemera Asset caching

Caching reads the base data from the [Asset Workspace data-lake](../../../packages/mtw-asset-workspace/README.md), and creates data-derivatives to support
the Ephemera functions, storing them in the `ephemera` DynamoDB table.

Caching is built to be an idempotent, error-correcting process.  If something goes wrong with the
cached information, the way to fix it is to cache it again.

Data-derivatives are stored in several largely-independent layers of data:
- [Content Layer](./README.contentLayer.md): This layer stores the content of the underlying Assets (rooms, features, etc.) as it will be needed to render the world
- [Ancestry Layer](./README.ancestry.md): This layer stores the connections between different assets (what is dependent upon what earlier asset)
- [State Layer](./README.state.md): This layer stores the current state of all variables in the programmatic layer of the assets, and allows the world to be responsive
- Permissions Layer: This layer stores the current access granted *for* each character, *to* some set of assets (as well as globally accessible Canonical assets)

---

## Needs Addressed

- Ephemera data needs to scale up as a function of how much of the world is used in play, rather than as a function of how much
world has been created (essential to make creation a low-cost act and support grassroots authoring)
- Ephemera data needs to be available in a fetch-oriented format

---
---