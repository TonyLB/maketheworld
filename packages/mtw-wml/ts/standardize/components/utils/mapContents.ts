import { SchemaTag } from "../../../schema/baseClasses";
import { GenericTree, GenericTreeNode } from "../../../tree/baseClasses";

export const applyTreeCallbackToNode = (callback: (tree: GenericTree<SchemaTag>) => GenericTree<SchemaTag>) => (node: GenericTreeNode<SchemaTag> | undefined): GenericTreeNode<SchemaTag> | undefined => {
    if (!node) {
        return undefined
    }
    const returnValue = callback([node])
    if (returnValue.length > 1) {
        throw Error('mapContents callback on single-node cannot return multiple nodes')
    }
    if (returnValue.length && returnValue[0].data.tag === node.data.tag) {
        return returnValue[0]
    }
    return undefined
}