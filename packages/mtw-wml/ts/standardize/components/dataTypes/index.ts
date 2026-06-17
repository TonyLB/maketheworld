import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import type { StandardComponentData, StandardComponentTag } from "../../baseClasses"
import { isSchemaTreeNode } from "../../../schema"
import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardKeyData } from "../../keys/dataTypes/reference"

import { isStandardCharacterData, StandardCharacterData } from "./character"

import { StandardFeatureData, isStandardFeatureData } from "./feature"
import { StandardImageData, isStandardImageData } from "./image"
import { StandardKnowledgeData, isStandardKnowledgeData } from "./knowledge"
import { StandardMapData, StandardMapInputData, isStandardMapData, isStandardMapInputData } from "./map"
import { StandardMessageData, isStandardMessageData } from "./message"
import { StandardMomentData, isStandardMomentData } from "./moment"
import { StandardRoomData, StandardRoomInputData, StandardRoomObjectData, StandardRoomRenderData, isStandardRoomData, isStandardRoomInputData } from "./room"
import { StandardMarkData, isStandardMarkData } from "./mark"
import { StandardLensData, StandardLensInputData, isStandardLensData, isStandardLensInputData } from "./lens"
import { StandardGuidanceData, StandardGuidanceInputData, isStandardGuidanceData, isStandardGuidanceInputData } from "./guidance"
import { StandardSituationData, StandardSituationInputData, isStandardSituationData, isStandardSituationInputData } from "./situation"
import { StandardAreaData, isStandardAreaData } from "./area"
import { StandardObjectData, isStandardObjectData } from "./object"
import {
    POSITION_GRAPH_NODE_TAGS,
    StandardPositionGraphData,
    isStandardPositionGraphData,
} from "./positionGraph"
import type { PositionGraphNodeTag } from "./positionGraph"

import { checkAll } from "./typeguards"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { ReferenceListData } from "../../keys/dataTypes/reference"
import type { WmlStandardizeMode } from "../../wmlStandardizeMode"

export type { StandardRoomObjectData, StandardRoomRenderData, StandardPositionGraphData, PositionGraphNodeTag }
export { POSITION_GRAPH_NODE_TAGS, isStandardPositionGraphData }
export {
    isStandardCharacterData,
    isStandardRoomData,
    isStandardRoomInputData,
    isStandardFeatureData,
    isStandardKnowledgeData,
    isStandardMapData,
    isStandardMapInputData,
    isStandardMessageData,
    isStandardMomentData,
    isStandardImageData,
    isStandardMarkData,
    isStandardLensData,
    isStandardLensInputData,
    isStandardGuidanceData,
    isStandardGuidanceInputData,
    isStandardSituationData,
    isStandardSituationInputData,
    isStandardAreaData,
    isStandardObjectData
}

export type StandardComponentNonEditData =
    StandardCharacterData |
    StandardRoomData |
    StandardFeatureData |
    StandardKnowledgeData |
    StandardMapData |
    StandardMessageData |
    StandardMomentData |
    StandardImageData |
    StandardMarkData |
    StandardLensData |
    StandardGuidanceData |
    StandardSituationData |
    StandardAreaData |
    StandardObjectData

export type StandardComponentInputNonEditData =
    StandardCharacterData |
    StandardRoomInputData |
    StandardFeatureData |
    StandardKnowledgeData |
    StandardMapInputData |
    StandardMessageData |
    StandardMomentData |
    StandardImageData |
    StandardMarkData |
    StandardLensInputData |
    StandardGuidanceInputData |
    StandardSituationInputData |
    StandardAreaData |
    StandardObjectData

export type StandardComponentInputData = StandardComponentInputNonEditData


export const isStandardFactory = <T extends StandardComponentData>(tag: StandardComponentTag) => (value: StandardComponentData): value is T => (typeof value !== 'string' && value.tag === tag)

export const isStandardComponentData = (value: any): value is StandardComponentData => (
    isStandardCharacterData(value) ||
    isStandardRoomData(value) ||
    isStandardFeatureData(value) ||
    isStandardKnowledgeData(value) ||
    isStandardMapData(value) ||
    isStandardMessageData(value) ||
    isStandardMomentData(value) ||
    isStandardImageData(value) ||
    isStandardMarkData(value) ||
    isStandardLensData(value) ||
    isStandardGuidanceData(value) ||
    isStandardSituationData(value) ||
    isStandardAreaData(value) ||
    isStandardObjectData(value)
)

export const isStandardComponentInputData = (value: any): value is StandardComponentInputData => (
    isStandardCharacterData(value) ||
    isStandardRoomInputData(value) ||
    isStandardFeatureData(value) ||
    isStandardKnowledgeData(value) ||
    isStandardMapInputData(value) ||
    isStandardMessageData(value) ||
    isStandardMomentData(value) ||
    isStandardImageData(value) ||
    isStandardMarkData(value) ||
    isStandardLensInputData(value) ||
    isStandardGuidanceInputData(value) ||
    isStandardSituationInputData(value) ||
    isStandardAreaData(value) ||
    isStandardObjectData(value)
)


export type StandardFormData = {
    universalKey: AssetUUID;
    components: StandardComponentData[];
    metaData: GenericTree<SchemaTag>;
    shortName?: StandardEditableData<string>;
    summary?: StandardEditableData<RenderTree>;
    topLevel?: ReferenceListData;
    standardizeMode?: WmlStandardizeMode;
}

export type StandardFormInputData = {
    universalKey: AssetUUID;
    components: StandardComponentInputData[];
    metaData: GenericTree<SchemaTag>;
    shortName?: StandardEditableData<string>;
    summary?: StandardEditableData<RenderTree>;
    topLevel?: ReferenceListData;
    standardizeMode?: WmlStandardizeMode;
}

export const isStandardForm = (arg: any): arg is StandardFormData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('universalKey' in arg && typeof arg.universalKey === 'string' && isSchemaAssetUUID(arg.universalKey)),
        ('metaData' in arg && Array.isArray(arg.metaData) && arg.metaData.every(isSchemaTreeNode)),
        ('components' in arg && Array.isArray(arg.components) && arg.components.every(isStandardComponentData))
    )
}

export const isStandardFormInput = (arg: any): arg is StandardFormInputData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('universalKey' in arg && typeof arg.universalKey === 'string' && isSchemaAssetUUID(arg.universalKey)),
        ('metaData' in arg && Array.isArray(arg.metaData) && arg.metaData.every(isSchemaTreeNode)),
        ('components' in arg && Array.isArray(arg.components) && arg.components.every(isStandardComponentInputData))
    )
}
