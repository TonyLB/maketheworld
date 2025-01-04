import { GenericTree, GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree"
import SchemaTagTree from "../../tagTree/schema"
import { isSchemaWithKey, SchemaTag, SchemaWithKey } from "@tonylb/mtw-base/ts/schema"
import { isSchemaImport, SchemaImportTag } from "@tonylb/mtw-base/ts/schema/metaData"

export const selectItemsByKey = (key: string) => (tree: GenericTree<SchemaTag>): (GenericTreeNodeFiltered<SchemaWithKey | SchemaImportTag, SchemaTag>)[] => {
    const tagTree = new SchemaTagTree(tree)
    const keyMatch = ({ data }) => ((isSchemaImport(data) || isSchemaWithKey(data)) && (data.key === key))
    const items = tagTree
        .filter({ match: keyMatch })
        .prune({ before: { match: keyMatch }})
        .tree
        .filter((node): node is GenericTreeNodeFiltered<SchemaWithKey | SchemaImportTag, SchemaTag> => (isSchemaWithKey(node.data) || isSchemaImport(node.data)))

    return items
}