import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import type { StandardComponentData, StandardComponentTag } from "../../baseClasses"
import { isSchemaTreeNode } from "../../../schema"
import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardKeyData } from "../../keys/dataTypes/reference"

import { isStandardCharacterData, StandardCharacterData } from "./character"

import { isStandardExampleData, StandardExampleData } from "./example"
import { StandardFeatureData, isStandardFeatureData } from "./feature"
import { StandardImageData, isStandardImageData } from "./image"
import { StandardKnowledgeData, isStandardKnowledgeData } from "./knowledge"
import { StandardMapData, isStandardMapData } from "./map"
import { StandardMessageData, isStandardMessageData } from "./message"
import { StandardMomentData, isStandardMomentData } from "./moment"
import { StandardRoomData, StandardRoomObjectData, StandardRoomRenderData, isStandardRoomData } from "./room"
import { StandardMarkData, isStandardMarkData } from "./mark"
import { StandardLensData, isStandardLensData } from "./lens"
import { StandardGuidanceData, isStandardGuidanceData } from "./guidance"
import { StandardSituationData, isStandardSituationData } from "./situation"

import { checkAll } from "./typeguards"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { ReferenceListData } from "../../keys/dataTypes/reference"
import type { WmlStandardizeMode } from "../../wmlStandardizeMode"

export type { StandardRoomObjectData, StandardRoomRenderData }
export { isStandardCharacterData, isStandardExampleData, isStandardRoomData, isStandardFeatureData, isStandardKnowledgeData, isStandardMapData, isStandardMessageData, isStandardMomentData, isStandardImageData, isStandardMarkData, isStandardLensData, isStandardGuidanceData, isStandardSituationData }

export type StandardComponentNonEditData =
    StandardCharacterData |
    StandardExampleData |
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
    StandardSituationData


export const isStandardFactory = <T extends StandardComponentData>(tag: StandardComponentTag) => (value: StandardComponentData): value is T => (typeof value !== 'string' && value.tag === tag)

export const isStandardComponentData = (value: any): value is StandardComponentData => (
    isStandardCharacterData(value) ||
    isStandardExampleData(value) ||
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
    isStandardSituationData(value)
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
