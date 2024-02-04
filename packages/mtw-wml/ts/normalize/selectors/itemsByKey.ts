import { GenericTree, GenericTreeNodeFiltered, TreeId } from "../../tree/baseClasses"
import { SchemaImportTag, SchemaTag, SchemaWithKey, isSchemaImport, isSchemaWithKey } from "../../simpleSchema/baseClasses"
import SchemaTagTree from "../../tagTree/schema"

export const selectItemsByKey = (key: string) => (tree: GenericTree<SchemaTag, TreeId>): (GenericTreeNodeFiltered<SchemaWithKey | SchemaImportTag, SchemaTag, TreeId>)[] => {
    const tagTree = new SchemaTagTree(tree)
    const keyMatch = ({ data }) => ((isSchemaImport(data) || isSchemaWithKey(data)) && (data.key === key))
    const items = tagTree
        .filter({ match: keyMatch })
        .prune({ before: { match: keyMatch }})
        .tree
        .filter((node): node is GenericTreeNodeFiltered<SchemaWithKey | SchemaImportTag, SchemaTag, TreeId> => (isSchemaWithKey(node.data) || isSchemaImport(node.data)))

    return items
}