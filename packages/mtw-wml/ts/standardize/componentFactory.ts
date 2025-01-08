import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isStandardRemove, isStandardReplace, StandardComponentData } from "./baseClasses"
import { StandardComponent } from "./components/baseClasses"
import { isSchemaTreeNode } from "./components/utils"
import { StandardRemove, StandardReplace } from "./edits"
import standardNonEditComponentFactory from "./nonEditFactory"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace } from "@tonylb/mtw-base/ts/schema/edit"

//
// standardComponentFactory takes an incoming argument that can apply to any of the StandardComponent classes (including Remove and Replace),
// finds the correct constructor, and creates the sub-typed class
//
export const standardComponentFactory = (arg: StandardComponentData | GenericTreeNode<SchemaTag>): StandardComponent | undefined => {
    if (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRemove)(arg)) {
        const { children } = arg
        if (children.length !== 1) {
            throw new Error("SchemaRemove must have exactly one child")
        }
        const childComponent = standardComponentFactory(children[0])
        if (!childComponent) {
            throw new Error("SchemaRemove must have a valid child component")
        }
        return new StandardRemove(childComponent)
    }
    if (!isSchemaTreeNode(arg) && isStandardRemove(arg)) {
        const childComponent = standardComponentFactory(arg.component)
        if (!childComponent) {
            throw new Error("SchemaRemove must have a valid child component")
        }
        return new StandardRemove(childComponent)
    }
    if ((!isSchemaTreeNode(arg) && isStandardReplace(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaReplace)(arg))) {
        return new StandardReplace(arg)
    }
    return standardNonEditComponentFactory(arg)
}
