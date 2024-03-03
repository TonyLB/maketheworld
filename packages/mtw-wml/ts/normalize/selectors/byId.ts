import { SchemaTag } from "../../schema/baseClasses";
import { GenericTree, GenericTreeNode, TreeId } from "../../tree/baseClasses";
import { treeFindByID } from "../../tree/genericIDTree";

export const selectById = (id: string) => (tree: GenericTree<SchemaTag, TreeId>, options={ tag: '', key: '' }): GenericTreeNode<SchemaTag, TreeId> | undefined => {
    console.log(`schema(${id}): ${JSON.stringify(tree, null, 4)}`)
    const returnValue = treeFindByID(tree, id)
    console.log(`find: ${JSON.stringify(returnValue, null, 4)}`)
    return returnValue
}
