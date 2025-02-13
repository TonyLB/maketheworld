import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isSchemaTreeNode } from "../components/utils"
import { StandardAuthRemove, StandardAuthReplace } from "./components/edits"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaRemove, isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload } from "@tonylb/mtw-base/ts/schema/edit"
import { isStandardAuthRemove, isStandardAuthReplace, isStandardGrant, StandardAuthorizationData } from "./components/dataTypes"
import { StandardAuthorizationItem } from "./components/baseClasses"
import { isSchemaGrant } from "@tonylb/mtw-base/ts/schema/authorization"
import StandardGrant from "./components/grant"
import { isStandardAuthorizationNonEdit } from "./components/nonEdit"

//
// standardNonEditComponentFactory takes an incoming argument that can apply to one of the non-edit StandardComponent classes,
// finds the correct constructor, and creates the sub-typed class
//
export const standardNonEditAuthorizationFactory = (arg: StandardAuthorizationData | GenericTreeNode<SchemaTag>): StandardAuthorizationItem | undefined => {

    if ((!isSchemaTreeNode(arg) && isStandardGrant(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaGrant)(arg))) {
        return new StandardGrant(arg)
    }
    return undefined
}

//
// standardAuthorizationFactory takes an incoming argument that can apply to any of the StandardAuthorizationItem classes (including Remove and Replace),
// finds the correct constructor, and creates the sub-typed class
//
export const standardAuthorizationFactory = (arg: StandardAuthorizationData | GenericTreeNode<SchemaTag>): StandardAuthorizationItem | undefined => {
    if (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRemove)(arg)) {
        const { children } = arg
        if (children.length !== 1) {
            throw new Error("SchemaRemove must have exactly one child")
        }
        const childComponent = standardAuthorizationFactory(children[0])
        if (!(childComponent && isStandardAuthorizationNonEdit(childComponent))) {
            throw new Error("SchemaRemove must have a valid child component")
        }
        return new StandardAuthRemove(childComponent)
    }
    if (!isSchemaTreeNode(arg) && isStandardAuthRemove(arg)) {
        const childComponent = standardAuthorizationFactory(arg.component)
        if (!(childComponent && isStandardAuthorizationNonEdit(childComponent))) {
            throw new Error("SchemaRemove must have a valid child component")
        }
        return new StandardAuthRemove(childComponent)
    }
    if (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaReplace)(arg)) {
        const { children } = arg
        const match = children.find(treeNodeTypeguard(isSchemaReplaceMatch))
        const payload = children.find(treeNodeTypeguard(isSchemaReplacePayload))
        if (match?.children?.length !== 1) {
            throw new Error("SchemaReplace must have exactly one match child")
        }
        if (payload?.children?.length !== 1) {
            throw new Error("SchemaReplace must have exactly one payload child")
        }
        const matchComponent = standardAuthorizationFactory(match.children[0])
        const payloadComponent = standardAuthorizationFactory(payload.children[0])
        if (!(matchComponent && isStandardAuthorizationNonEdit(matchComponent) && payloadComponent && isStandardAuthorizationNonEdit(payloadComponent))) {
            throw new Error("SchemaReplace must have valid child components")
        }
        return new StandardAuthReplace(matchComponent, payloadComponent)
    }
    if (!isSchemaTreeNode(arg) && isStandardAuthReplace(arg)) {
        const matchComponent = standardAuthorizationFactory(arg.match)
        const payloadComponent = standardAuthorizationFactory(arg.payload)
        if (!matchComponent || !payloadComponent) {
            throw new Error("SchemaReplace must have valid child components")
        }
        return new StandardAuthReplace(matchComponent, payloadComponent)
    }
    return standardNonEditAuthorizationFactory(arg)
}
