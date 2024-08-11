---
---

# Standard Form

---

## Needs Addressed

---

- In order to be a useful format for serializing and deserializing, Schema structure *generally* 
needs to be able to accept a wide variety of orderings and organizations of semantic data, all
of them *functionally equivalent*, in order to be the maximally flexible format for accepting
changes from internal clients.

- A *usable* format for extracting data and editing content should **not** have a wide variety
of orderings and representations: It should have a single, unique, predictable ordering and
presentation of any given semantic meaning.
- *Standard Form* is that predictable ordering: A single point within the cloud of
possibilities for "how should this meaning be expressed," that is built to be the easiest
to manipulate.

---

## Rules of Organization

---

- All conditionals are pushed to as low a level as possible. There are no top-level conditions
as direct children of the Asset. Conditions only exist within Components, as close as possible
to where they create a fork in meaning (e.g., within the Description of a component, or directly
around the Exits they are controlling).
- All non-component items exist within the Component from which they originate (i.e., no top-level Exits)
- All top-level items have all of their data aggregated into a **single** appearance. Reliably,
if you look at an example of (e.g.) a Room, you will find either all the aggregate data about its
render, name, and exits, or no children except those specific to its context (i.e., positions in
a Map).

---

## Machine-readable format

---

In addition to schema notation, standard forms can be accessed in a machine-readable format where all
properties are broken out into the appropriate fields for their component (i.e., the record element for
a Room component will have fields with appropriate information for shortName, name, summary, description,
etc.) Because the machine-readable format is complete, it is possible (and desirable) to make edits to
that format, and then *regenerate* the WML format as and when needed, rather than edit the Schema tree and
then regenerate the machine-readable format. Both are equivalent operations, but the former is faster and
more maintainable.

---

## How to generate

---

Use the `standardizeSchema` function in `./standardize.ts` of this directory in order to create a standard
schema from one that may be disordered.

---
