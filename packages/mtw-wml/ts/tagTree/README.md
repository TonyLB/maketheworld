---
---

# Tag Tree

---

## Needs Addressed

---

World Markup Language has many nesting operations that are effectively commutative. For
example, all of the following are equivalent:
- Creating a Room, with a Description, which contains only a Condition which then
contains some text
- Creating a Room, which contains a Condition, which contains only the Description containing
some text
- Creating a Condition which contains only a Room, containing a Description, containing
some text

As you can see, changing the relative position of the "Condition" tag does not change the
semantic meaning of the nested stack. The *meaning* is that that chunk of text (the leaf
node) is associated with (a) the Room in its context, and (b) the Condition in its context.

There are many circumstances in which these trees are best looked at from a specific ordering:
For instance, to standardize a normal form for presentation, we insist "Room is the first wrapper,
then Description, then Condition."  This guarantees that you can have a tree which has one top-level
node per Room, and which consolidates Room information under that node.

Because this pattern recurs, MTW needs an abstraction for how to deal with these situations
consistently and conveniently.

---

## Implementation

---

A usefully different way to envision the same data is that the leaf node (the *Text*) has direct
semantic import ("here is some text"), whereas the Room, Description, and Condition are context
**tags** that either (a) associate the object (the chunk of text) with other objects and groupings,
or (b) provide added context to the meaning of the leaf node:
- Wrapping the text in a Description tag says "This is for a Description, not for a Name, or any
other type of text"
- Wrapping the text in a Room tag says "This text is associated with this Room, rather than any
other object"
- Wrapping the text in a Condition tag says "This text is rendered only under this condition."

So a TagTree creates the structure to view a complex tree in a non-nested way, as an ordered list
of leafs, along with their tags. It knows which tags can be reordered relative to each other (i.e.,
Condition can go anywhere, but Description should be at a lower level of the tree than Room), as well
as which leaf nodes can be reordered relative to each other (Exits in a room can be ordered in
any number, but chunks of text in a Description must maintain their order).

---

## Data Contract

---

TagTree is a black-box class: The internals of the abstraction are **not** something you would want
to manipulate directly from the outside. Instead, TagTree accepts and returns GenericTree<whatever>
data types. What it does with them internally is not guaranteed stable, and should not be directly
accessed.

---

## Methods

---

TBD