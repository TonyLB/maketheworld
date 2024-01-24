import { unique } from "../../list"
import { GenericTree } from "../../sequence/tree/baseClasses"
import { SchemaTag, SchemaWithKey, isSchemaWithKey } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectKeysByTag = (tag: SchemaWithKey["tag"]) => (tree: GenericTree<SchemaTag>): string[] => {
    const tagTree = new SchemaTagTree(tree)
    const keys = tagTree
        .filter({ match: tag })
        .prune({ not: { match: tag }})
        .tree
        .map(({ data }) => (data))
        .filter((isSchemaWithKey))
        .map(({ key }) => (key))

    return unique(keys)
}