import { SchemaTag } from "../../schema/baseClasses";
import { GenericTree, GenericTreeNode, TreeId } from "../../tree/baseClasses";
import { treeFindByID } from "../../tree/genericIDTree";

export const selectById = (id: string) => (tree: GenericTree<SchemaTag, TreeId>, options={ tag: '', key: '' }): GenericTreeNode<SchemaTag, TreeId> | undefined => {
    return treeFindByID(tree, id)
}
