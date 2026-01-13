# WML Schema

Schema format is the representation of WML that serves as the basic source of truth: Other formats (such as text representation,
or normalized form) derive from Schema format. Any time you want to edit the contents of WML, you should convert to Schema format,
make your edits there, and then convert back (if needed) to whatever format results you need. Do **not** directly manipulate
the contents of either text representation or normalized form.

## GenericTree

Schema format is class `GenericTree<SchemaTag>`.  Each node of the GenericTree has a `data` property (which holds a single SchemaTag)
item, and a `children` property (which holds all the items wrapped inside that tag). Schema tag data definitions should be absolutely
minimal, containing only the data defined in the *tag itself*. Previous versions of the software denormalized child information up
into the Schema tag data of wrapping nodes, and this turned out to be an enormous source of unnecessary complexity. Avoid the
temptation.

## TagTrees

Schema manipulation makes extensive use of the [TagTree](../../ts/tagTree/README.md) library, to reorder tags into some standard
hierarchy, and then to filter and prune them. 

***Current***: Currently, the TagTree library makes it very difficult to apply minimal edits to a tree that has been
reordered or filtered.

***Future***: A future iteration of the code should provide a more robust TagTree library which will allow viewing *and editing*
altered versions of the tree, with the edits being reflected in the most appropriate place in the original tree. This will make
complex editing of the Schema even easier.

## Selectors

Rather than denormalize data up from children to parent nodes, Schema manipulation takes a page from React/Redux, and depends
upon pure functions called **selectors** to generate condensed data out of a deep tree. For instance, there is a `render` selector
which takes all appearances of a specific context tag (by key), reorders it to put Conditions inside of Descriptions, filters
everything **but** the Descriptions (possibly including conditions), and aggregates that content. It takes the place of previous
denormalizations that tried to keep a running tally of "How would you render this world-item, if someone looked at it?", instead
depending on Schema manipulation tools to be able to efficiently assemble that from the source-of-truth tree.

## Edit Tags

Edit tags (`Remove` and `Replace`/`With`) have a special structure in schema trees that differs from their WML syntax:

### Remove Tags
- **WML**: `<Remove>content</Remove>`
- **Schema**: `{ tag: 'Remove', children: [content nodes] }`
- Structure is straightforward: Remove wraps the content to be removed.

### Replace Tags
- **WML**: `<Replace>oldcontent</Replace><With>newcontent</With>` (siblings)
- **Schema**: `{ tag: 'Replace', children: [
    { tag: 'ReplaceMatch', children: [old content] },
    { tag: 'ReplacePayload', children: [new content] }
  ]}`
- The parser transforms sibling `<Replace>` and `<With>` tags into a parent `Replace` node containing `ReplaceMatch` and `ReplacePayload` as children.
- When working with schema trees, look for `ReplaceMatch` and `ReplacePayload` as children of `Replace` nodes, not as siblings.

This transformation is handled automatically by the converters in `schema/converters/edit.ts`. When serializing back to WML, the print map converts the schema structure back to the sibling form.