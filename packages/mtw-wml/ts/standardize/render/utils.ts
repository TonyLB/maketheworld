import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { GenericTree, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaConditionFallthrough, isSchemaConditionStatement } from "@tonylb/mtw-base/ts/schema/condition"

export const stripUIFields = (tree: GenericTree<SchemaTag>): GenericTree<SchemaTag> => (
    tree.map((node) => (
        (treeNodeTypeguard(isSchemaConditionStatement)(node) || treeNodeTypeguard(isSchemaConditionFallthrough)(node))
        ? {
            data: { ...node.data, selected: undefined },
            children: stripUIFields(node.children) ?? []
        }
        : {
            ...node,
            children: stripUIFields(node.children) ?? []
        }
    ))
)
