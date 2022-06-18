---
---

# Ephemera Manager

The Ephemera Lambda manages storage and state of short-term assets, defining how the long-term
structure of the world is currently instantiated, and what has happened and is happening inside
of it.

---

## Needs Addressed

---

***Denormalized Meta-Data***
- For a given room or feature, the manager should optimize *fetch* on a question of this form (even if
that optimization costs resources at *insert* time):
    - "Show me the default *inherited* values for this item across all assets, including:
        - Default names and descriptions of all Components
        - Previous layers of all Maps, as shown in default condition"
- For a given component, the manager should optimize *fetch* on a question of
this form:
    - "Show me all appearances of this component, in all ancestor assets in the import tree,
    in an order in which their dependencies do not conflict (DAG-sorted imports)."

<!-- ***Caching***
- For a given asset, the manager must be able to cache the asset from a message delivered out of
long-term compact storage into short-term read-optimized storage.
- Re-caching must perform the bare minimum of touches on the short-term storage, to minimize
disruptions to game-play of creative changes. -->

---

## Outlets

- ***update handler***: Handler for DynamoDB event on **ephemera** table.
- ***heal***: Heals a character information (specified by CharacterId argument).
- ***healGlobal***: Self-Heals all global values (connections, etc.)
- ***evaluate***: Directly executes an action (specified by Action and AssetId arguments)

---

**TODO: Define the formats for data in the Ephemera table**
