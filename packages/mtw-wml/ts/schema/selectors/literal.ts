import { isSchemaLiteralTag, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaString } from "@tonylb/mtw-base/ts/schema/renderTree"
import SchemaTagTree from "../../tagTree/schema"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"

export const selectLiteral = (tag: string) => (tree: GenericTree<SchemaTag>): string => {
    const tagTree = new SchemaTagTree(tree)
    return tagTree
        .filter({ match: tag })
        .prune({ or: [{ before: { match: tag } }, { after: { match: tag } }] })
        .tree
        .reduce<string>((previous, node) => {
            const { data, children } = node
            if (!isSchemaLiteralTag(data)) {
                return previous
            }
            const textValue = (children || [])
                .map(({ data }) => data)
                .filter(isSchemaString)
                .map(({ value }) => value)
                .join('')
            return textValue || previous
        }, '')
}
