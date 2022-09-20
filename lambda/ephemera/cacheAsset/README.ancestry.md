---
---

# Ancestry Layer

The Ancestry layer stores quick-fetch denormalizations for Ancestry and Descent, which maintain the
entire DAG of import connection, going "backward" from a given node to imported ancestors, and "forward"
from the node to descendants that (in turn) import it.

Ancestry information is useful for deriving the entire behavior of an asset (including everything it
inherits).

Descent information is useful for updating and rerendering assets in response to a change in an
asset from which they inherit.

---

## Needs Addressed

- Needs to start from an asset that imports components, variables, and actions from other assets, and
quickly fetch the entire ancestry tree of imports
- Needs to start from an asset that is imported by others and quickly fetch the entire descendant tree
of importing assets

---

## Tree Storage

---

*Any tree is stored as a recursively nested map:  A key indicates a node, and its value is a nested map of*
*children.  A leaf node is represented by a key with an empty map as its value.*

***Example***

```ts
  const tree = {
    A: {
        B: {},
        C: {}
    },
    D: {
        E: {
            F: {}
        }
    }
  }
```

This represents two trees, one rooted at A with children B and C, and one rooted at D with a child E
that in turn has a child F.

Note that the trees are not strictly non-intersecting:  They are directed acyclic graphs, but this means
that some branches may be repeated in their entirety.  e.g.:

```ts
  const tree = {
    A: {
        B: {},
        C: {
            E: {
                F: {}
            }
        }
    },
    D: {
        E: {
            F: {}
        }
    }
  }
```

---

## Ancestry

*Each **Meta::Asset** record will have an Ancestry field which stores a tree that indicates the import relationships*
*starting at that asset and stretching backward to earlier and earlier assets.*

***Example***

```ts
    const Ancestry = {
        TownSquare: {
            City: {}
        },
        Undercroft: {
            Sewer: {
                City: {}
            }
        }
    }
```

This indicates that the importing Asset (e.g. Cathedral) imports both the TownSquare and Undercroft Assets.  The
TownSquare imports City.  The Undercroft imports Sewer, which in turn *also* imports the City asset.

---

## Descent

*Each **Meta::Asset** record will have a Descent field which stores a tree that indicates the dependency relationships*
*starting at that asset and stretching forward to descendant importing assets.*

***Example***

```ts
    const Descent = {
        TownSquare: {
            Cathedral: {}
        },
        Sewer: {
            Undercroft: {
                Cathedral: {}
            }
        }
    }
```

This indicates the mathematical inverse of the Ancestry map, above:  This is a map of the descendants of the City
asset, indicating that it is imported by TownSquare and Sewer.  The TownSquare is imported by Cathedral.  The Sewer
is imported by Undercroft, which in turn is *also* imported by Cathedral.

---

## Updates

*Whenever an asset which either (a) is imported, (b) imports other assets, or (c) both is updated in a way that*
*changes its imports, it must cascade changes in both trees.  The Descent trees of any Ancestors must be updated*
*recursively and likewise the Ancestry tree of any Descendants*

***Example***

In the examples above, changing the TownSquare so that it imports the Undercroft causes the following changes:
- All of TownSquare's Ancestor (e.g. City and (now) Undercroft -> Sewer -> City) need to have their Descent trees
updated to include the Descent tree of TownSquare, so the overall descent tree of City changes into:

```ts
    const Descent = {
        TownSquare: {
            Cathedral: {}
        },
        Sewer: {
            Undercroft: {
                Cathedral: {},
                //
                // New below
                //
                TownSquare: {
                    Cathedral: {}
                }
            }
        }
    }
```

- All of TownSquare's Descendants (e.g. Cathedral) need to have their Ancestry trees updated to
include the (new) Ancestry tree of TownSquare, so the overall ancestry tree of Cathedral changes into:

```ts
    const Ancestry = {
        TownSquare: {
            City: {},
            //
            // New below
            //
            Undercroft: {
                Sewer: {
                    City: {}
                }
            }
        },
        Undercroft: {
            Sewer: {
                City: {}
            }
        }
    }
```

---
---