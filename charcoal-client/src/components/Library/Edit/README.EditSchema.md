---
---

# EditSchema

EditSchema context wrappers handle the deep-tree structure of WML Schema data. In order to align with the component
structure of React, EditSchema recursively presents a sub-tree, along with the onChange operator to manipulate the
stored data for the sub-tree, to all of the sub-components responsible for rendering that data.

Most importantly, EditSchema (and the useEditContext hook) present the following data:
- `value`: A GenericTree<SchemaTag> data structure that presents the current data for the sub-tree. In the case of
displaying a single sub-tag (i.e., "ShortName" or an "If" wrapper), this value will be an array with either one or zero
top elements. In the case of displaying a list (i.e., "Exits" for a room), this value will be an array with any number
of elements (e.g., one for each Exit or conditional wrapper with exits).
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