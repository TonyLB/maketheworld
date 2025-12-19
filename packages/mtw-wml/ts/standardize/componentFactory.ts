import { GenericTreeNode, treeNodeTypeguard } from "@tonylb/mtw-base/ts/genericTree"
import { StandardComponent } from "./components/baseClasses"
import StandardCharacter from "./components/character"
import StandardFeature from "./components/feature"
import StandardExample from "./components/example"
import StandardImage from "./components/image"
import StandardKnowledge from "./components/knowledge"
import StandardMap from "./components/map"
import StandardMessage from "./components/message"
import StandardMoment from "./components/moment"
import StandardRoom from "./components/room"
import { isSchemaCharacter, SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isSchemaTreeNode } from "../schema"
import { StandardComponentData } from "./baseClasses"
import { isStandardCharacterData, isStandardExampleData, isStandardFeatureData, isStandardImageData, isStandardKnowledgeData, isStandardMapData, isStandardMessageData, isStandardMomentData, isStandardRoomData } from "./components/dataTypes"
import { isSchemaExample } from "@tonylb/mtw-base/ts/schema/example"
import { isSchemaFeature, isSchemaKnowledge, isSchemaMap, isSchemaMessage, isSchemaMoment, isSchemaRoom } from "@tonylb/mtw-base/ts/schema/components"
import { isSchemaImage } from "@tonylb/mtw-base/ts/schema/image"

//
// standardComponentFactory takes an incoming argument that can apply to any of the StandardComponent classes,
// finds the correct constructor, and creates the sub-typed class
//
export const standardComponentFactory = (arg: StandardComponentData | GenericTreeNode<SchemaTag>): StandardComponent | undefined => {
    if ((!isSchemaTreeNode(arg) && isStandardCharacterData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaCharacter)(arg))) {
        return new StandardCharacter(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardExampleData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaExample)(arg))) {
        return new StandardExample(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardRoomData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaRoom)(arg))) {
        return new StandardRoom(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardFeatureData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaFeature)(arg))) {
        return new StandardFeature(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardKnowledgeData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaKnowledge)(arg))) {
        return new StandardKnowledge(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMapData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMap)(arg))) {
        return new StandardMap(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMessageData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMessage)(arg))) {
        return new StandardMessage(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardMomentData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaMoment)(arg))) {
        return new StandardMoment(arg)
    }
    if ((!isSchemaTreeNode(arg) && isStandardImageData(arg)) || (isSchemaTreeNode(arg) && treeNodeTypeguard(isSchemaImage)(arg))) {
        return new StandardImage(arg)
    }
    return undefined
}
