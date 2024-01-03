# WML Normalized

Normalized format is a read-only view of the Schema organized by individual keyed tags.
It is a map, and the keys are the keys of tags present in the Schema. For each key,
the property will include:
* The `tag` property which shows what kind of tag it is (universally throughout the
entire Schema)
* The `appearances` property, which includes a list of Schema sub-trees, each rooted
in a single appearance of the specified tag

The sub-trees have a mix of different data types: `SchemaTag` when the tag is not
one that would appear in the Normalized table-of-contents, or `NormalReference` when
it would. The NormalReference contains a `key`, the `tag`, and the `index` of which
item in the Normal's `appearances` array this appearance represents. NormalReference
keys do not have any children (though the children that appear within them in the
original schema can be recursively reconstructed by lookup).