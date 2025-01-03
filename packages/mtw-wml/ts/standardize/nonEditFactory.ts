import { isSchemaAction, isSchemaBookmark, isSchemaCharacter, isSchemaComputed, isSchemaExample, isSchemaFeature, isSchemaImage, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaRoom, isSchemaTheme, isSchemaVariable, SchemaTag } from "../schema/baseClasses"
import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isStandardAction, isStandardBookmark, isStandardCharacter, isStandardComputed, isStandardFeature, isStandardImage, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, isStandardTheme, isStandardVariable, StandardComponentData } from "./baseClasses"
import StandardAction from "./components/action"
import StandardBookmark from "./components/bookmark"
import StandardCharacter from "./components/character"
import { StandardComponent } from "./components/component"
import StandardComputed from "./components/computed"
import StandardFeature from "./components/feature"
import StandardExample from "./components/example"
import StandardImage from "./components/image"
import StandardKnowledge from "./components/knowledge"
import StandardMap from "./components/map"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardRoom from "./components/room"
import StandardTheme from "./components/theme"
import { isSchemaTreeNode } from "./components/utils"
import StandardVariable from "./components/variable"
import { isStandardExample } from "./components/dataTypes/example"

//
// standardNonEditComponentFactory takes an incoming argument that can apply to one of the non-edit StandardComponent classes,
// finds the correct constructor, and creates the sub-typed class
//
export const standardNonEditComponentFactory = (arg: StandardComponentData | GenericTreeNode<SchemaTag>): StandardComponent | undefined => {

    if ((!isSchemaTreeNode(arg) && isStandardCharacter(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaCharacter)(arg))) {
        return new StandardCharacter(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardExample(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaExample)(arg))) {
        return new StandardExample(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardRoom(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRoom)(arg))) {
        return new StandardRoom(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardFeature(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaFeature)(arg))) {
        return new StandardFeature(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardKnowledge(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaKnowledge)(arg))) {
        return new StandardKnowledge(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardBookmark(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaBookmark)(arg))) {
        return new StandardBookmark(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMap(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMap)(arg))) {
        return new StandardMap(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMessage(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMessage)(arg))) {
        return new StandardMessage(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMoment(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMoment)(arg))) {
        return new StandardMoment(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardTheme(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaTheme)(arg))) {
        return new StandardTheme(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardVariable(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaVariable)(arg))) {
        return new StandardVariable(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardComputed(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaComputed)(arg))) {
        return new StandardComputed(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardAction(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaAction)(arg))) {
        return new StandardAction(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardImage(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaImage)(arg))) {
        return new StandardImage(arg)
    }
    return undefined
}

export default standardNonEditComponentFactory
