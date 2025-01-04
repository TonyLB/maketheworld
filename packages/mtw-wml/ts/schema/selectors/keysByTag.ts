import { unique } from "../../list"
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import SchemaTagTree from "../../tagTree/schema"
import { isSchemaWithKey, SchemaTag, SchemaWithKey } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport, SchemaImportTag } from "@tonylb/mtw-base/ts/schema/metaData"

export const selectKeysByTag = (tag: SchemaWithKey["tag"] | 'Import') => (tree: GenericTree<SchemaTag>): string[] => {
    const tagTree = new SchemaTagTree(tree)
    const keys = tagTree
        .filter({ match: tag })
        .prune({ not: { match: tag }})
        .tree
        .map(({ data }) => (data))
        .filter((data): data is SchemaWithKey | SchemaImportTag => (isSchemaWithKey(data) || isSchemaImport(data)))
        .map(({ key }) => (key))
        .filter((key): key is string => (typeof key !== 'undefined'))

    return unique(keys)
}