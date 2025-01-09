import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isStandardRemove, isStandardReplace, StandardComponentData } from "./baseClasses"
import { StandardComponent } from "./components/baseClasses"
import { isSchemaTreeNode } from "./components/utils"
import { StandardRemove, StandardReplace } from "./components/edits"
import standardNonEditComponentFactory from "./nonEditFactory"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"

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
    if (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaReplace)(arg)) {
        const { children } = arg
        const match = children.find(isSchemaReplaceMatch)
        const payload = children.find(isSchemaReplacePayload)
        if (match?.children?.length !== 1) {
            throw new Error("SchemaReplace must have exactly one match child")
        }
        if (payload?.children?.length !== 1) {
            throw new Error("SchemaReplace must have exactly one payload child")
        }
        const matchComponent = standardComponentFactory(match.children[0])
        const payloadComponent = standardComponentFactory(payload.children[0])
        if (!matchComponent || !payloadComponent) {
            throw new Error("SchemaReplace must have valid child components")
        }
        return new StandardReplace(matchComponent, payloadComponent)
    }
    if (!isSchemaTreeNode(arg) && isStandardReplace(arg)) {
        const matchComponent = standardComponentFactory(arg.match)
        const payloadComponent = standardComponentFactory(arg.payload)
        if (!matchComponent || !payloadComponent) {
            throw new Error("SchemaReplace must have valid child components")
        }
        return new StandardReplace(matchComponent, payloadComponent)
    }
    return standardNonEditComponentFactory(arg)
}
