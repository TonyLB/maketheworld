import { SchemaTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses"

export const isSchemaTreeNode = (value: any): value is GenericTreeNode<SchemaTag> => {
    return Boolean(value && typeof value === 'object' && 'data' in value && 'children' in value)
}

export const standardFieldToOutputNode = (field: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> => (
    field ? [field] : []
)
