---
---

# Standard Schema

---

## Needs Addressed

---

- The Schema structure *generally* needs to be able to accept a wide variety of orderings
and organizations of semantic data, all of them *functionally equivalent*, in order to be the
maximally flexible format for accepting changes from internal clients.
- In order to be the maximally *usable* format for extracting data and editing content, the
Schema should **not** have a wide variety of orderings: It should have a single, unique,
predictable ordering and presentation of any given semantic meaning.
- *Standard Schema Form* is that predictable ordering: A single point within the cloud of
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
- All top-level items have all of their data aggregated into a **single** appearance. Reliably,
if you look at an of (e.g.) a Room, you will find either all the aggregate data about its
render, name, and exits, or no children except those specific to its context (i.e., positions in
a Map).

---

## How to generate

---

Use the `standardizeSchema` function in `./standardize.ts` of this directory in order to create a standard
schema from one that may be disordered.

---
