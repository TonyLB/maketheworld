---
---

# EditSchema

EditSchema context wrappers handle the deep-tree structure of WML Schema data. In order to align with the component
structure of React, EditSchema recursively presents a sub-tree, along with the onChange operator to manipulate the
stored data for the sub-tree, to all of the sub-components responsible for rendering that data.

Most importantly, EditSchema (and the useEditContext hook) present the following data:
- `value`: A GenericTree<SchemaTag> data structure that presents the current data for the sub-tree. This value will be an
array with any number of elements (e.g., one for each Exit or conditional wrapper with exits).
- `onChange`: (newValue: GenericTree<SchemaTag>) => void. This function takes a new value to assign in place of value (above)
and does the necessary data operations to place that new value into the redux store. NOTE: Very frequently, an EditSchema
wrapper will call recursively to the onChange operator of **its** Edit Context, altering just its own sub-tree of a larger
tree, and then passing that tree change up to the handler that accepts the data in total.

---
---

## EditSchema and updateStandard

While EditSchema frequently is passed an onChange that calls updateStandard at the top level, EditSchema *itself* is
agnostic to the redux storage format. So, for instance, a DescriptionEditor showing the `shortName` field for a
room would initialize its outermost EditSchema with a dispatch of updateStandard:replaceItem to update the shortName
item on that particular room component ... but EditSchema knows only that it has a function to call on changes.

Because of this, EditSchema itself should not store componentKeys, tags, or other context about the *nature* of the
information it is editing.

---
---

## EditSchema vs. EditSchemaNode

Frequently, the focus of a sub-tree is a single node and its descendants. Because of the frequency of this pattern,
it is called out with a different context wrapper, `EditSchemaNode`, along with a new hook, `useEditNodeContext`,
which handles the transformations necessary to present `onChange` and `onDelete` functions that operate on a single
node, rather than on a list. The underlying value in the actual context provider will be an array with either one or zero
top elements, but the wrapper and hook together present it more consistently for specific use.

---
---

## EditSubListSchema

The `EditSubListSchema` wrapper takes a context with a list of items, and a specified index, and creates a
context with that single item (as if created manually with `EditSchemaNode`), automating the transformations
necessary to apply onChange events targetted on the specific node to become a change on the greater list.

---
---