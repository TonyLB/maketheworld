import { SchemaTag, isSchemaLiteralTag } from "../../schema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree } from "../../tree/baseClasses"

export const selectLiteral = (tag: string) => (tree: GenericTree<SchemaTag>): string => {
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .filter({ match: tag })
        .prune({ or: [{ before: { match: tag } }, { after: { match: tag } }] })
        .tree
        .reduce<string>((previous, { data }) => (isSchemaLiteralTag(data) ? data.value : previous), '')
}
