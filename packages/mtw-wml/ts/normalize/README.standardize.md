---
---

# Standard Normal Form

---

## Needs Addressed

---

- The NormalForm structure *generally* needs to be able to accept a wide variety of orderings
and organizations of semantic data, all of them *functionally equivalent*, in order to be the
maximally flexible format for accepting changes from internal clients.
- In order to be the maximally *usable* format for extracting data and analyzing content, the
NormalForm should **not** have a wide variety of orderings: It should have a single, unique,
predictable ordering and presentation of any given semantic meaning.
- *Standard Normal Form* is that predictable ordering: A single point within the cloud of
possibilities for "how should this meaning be expressed," that is built to be the easiest
to manipulate.

---

## Rules of Organization

---

- All conditionals are pushed to as low a level as possible. There are no top-level conditions
as direct children of the Asset. Conditions only exist within Components, as close as possible
to where they create a fork in meaning (e.g., within the Description of a component, or directly
around the Exits they are controlling).
- All Exits exist within the Room from which they originate (no top-level or "from" Exits)
- All top-level items have all of their data front-loaded into the **first** appearance. Reliably,
if you look at appearance-zero of (e.g.) a Room, you will find all the aggregate data about its
render, name, and exits. All other appearances (for instance, within a Map or Message) will be
empty.
- In order to facilitate this appearance-zero behavior, top-level items are listed in the following
order (sorted by key alphabetically within their sections unless otherwise specified):
    - *Images* are not mapped, as they need no top-level representation
    - *Bookmarks* (in an order determined by their directed acyclic graph)
    - *Features*
    - *Rooms*
    - *Maps*
    - *Messages*
    - *Moments*
    - *Variables*
    - *Computeds* (in an order determined by their directed acyclic graph)
    - *Actions*
    - *Imports*

---

## How to generate

---

Use the `standardizeNormal` function in `./standardize.ts` of this directory in order to create a standard
normalForm from one that may be disordered.

---
