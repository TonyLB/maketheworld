import { isSchemaRemove, isSchemaReplace, SchemaTag } from "../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isStandardRemove, isStandardReplace, StandardComponentData } from "./baseClasses"
import { StandardComponent } from "./components/component"
import { isSchemaTreeNode } from "./components/utils"
import { StandardRemove, StandardReplace } from "./edits"
import standardNonEditComponentFactory from "./nonEditFactory"

//
// standardComponentFactory takes an incoming argument that can apply to any of the StandardComponent classes (including Remove and Replace),
// finds the correct constructor, and creates the sub-typed class
//
export const standardComponentFactory = (arg: StandardComponentData | GenericTreeNode<SchemaTag>): StandardComponent | undefined => {
    if ((!isSchemaTreeNode(arg) && isStandardRemove(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRemove)(arg))) {
        return new StandardRemove(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardReplace(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaReplace)(arg))) {
        return new StandardReplace(arg)
    }
    return standardNonEditComponentFactory(arg)
}
