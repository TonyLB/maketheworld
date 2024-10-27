import { isSchemaCondition, isSchemaConditionFallthrough, isSchemaConditionStatement, isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaTag } from "../../../schema/baseClasses"
import { GenericTree, GenericTreeNode, GenericTreeNodeFiltered, treeNodeTypeguard } from "../../../tree/baseClasses"
import { treeTypeGuard } from "../../../tree/filter"
import { EditInternalStandardNode, EditWrappedStandardNode } from "../../baseClasses"

export const isSchemaTreeNode = (value: any): value is GenericTreeNode<SchemaTag> => {
    return Boolean(value && 'data' in value && 'children' in value)
}

export const standardFieldToOutputNode = (field: GenericTreeNode<SchemaTag>): GenericTree<SchemaTag> => (
    field ? [field] : []
)
