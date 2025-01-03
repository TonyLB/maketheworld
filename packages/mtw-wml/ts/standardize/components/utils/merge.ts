import { SchemaTag } from "../../../schema/baseClasses"
import applyEdits from "../../../schema/treeManipulation/applyEdits"
import SchemaTagTree from "../../../tagTree/schema"
import { GenericTreeNode } from "@tonylb/mtw-base/ts/genericTree"

export const combineTaggedChildren = (base: GenericTreeNode<SchemaTag> | undefined, incoming: GenericTreeNode<SchemaTag> | undefined): GenericTreeNode<SchemaTag> | undefined => {
    if (!base) {
        return incoming
    }
    if (!incoming) {
        return base
    }
    const tagTree = new SchemaTagTree([base])
    const incomingTagTree = new SchemaTagTree([incoming])
    tagTree._tagList = [...tagTree._tagList, ...incomingTagTree._tagList]
    const combinedSchema = applyEdits(tagTree.tree)
    return combinedSchema.length ? combinedSchema[0] : undefined
}
