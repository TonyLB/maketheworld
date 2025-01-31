import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { isStandardAction, isStandardCharacter, isStandardComputed, isStandardFeature, isStandardImage, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardRoom, isStandardTheme, isStandardVariable, StandardComponentData } from "./baseClasses"
import StandardAction from "./components/action"
import StandardCharacter from "./components/character"
import { StandardComponent } from "./components/baseClasses"
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
import { isSchemaCharacter, isSchemaTheme, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaAction, isSchemaComputed, isSchemaVariable } from "@tonylb/mtw-base/ts/schema/computation"
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image"
import { ComponentTag } from "./components/dataTypes/abstract"

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

//
// standardComponentByTag takes an incoming tag and key, and creates the appropriate StandardComponent
//
export const standardComponentByTag = (tag: ComponentTag, key: string): StandardComponent | undefined => {
    switch (tag) {
        case "Character":
            return new StandardCharacter(key)
        case "Example":
            return new StandardExample(key)
        case "Room":
            return new StandardRoom(key)
        case "Feature":
            return new StandardFeature(key)
        case "Knowledge":
            return new StandardKnowledge(key)
        case "Map":
            return new StandardMap(key)
        case "Message":
            return new StandardMessage(key)
        case "Moment":
            return new StandardMoment(key)
        case "Theme":
            return new StandardTheme(key)
        case "Variable":
            return new StandardVariable(key)
        case "Computed":
            return new StandardComputed(key)
        case "Action":
            return new StandardAction(key)
        case "Image":
            return new StandardImage(key)
        default:
            return undefined
    }

}

export default standardNonEditComponentFactory
