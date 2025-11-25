import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import type { SerializeNDJSONMixin, StandardComponentData, StandardComponentTag } from "../../baseClasses"
import { isSchemaTreeNode } from "../../../schema"
import { AssetUUID, isSchemaAssetUUID, ComponentUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardReferenceData } from "./reference"

import { isStandardCharacter, StandardCharacterData } from "./character"

import { isStandardExample, StandardExampleData } from "./example"
import { StandardFeatureData, isStandardFeature } from "./feature"
import { StandardImageData, isStandardImage } from "./image"
import { StandardKnowledgeData, isStandardKnowledge } from "./knowledge"
import { StandardMapData, isStandardMap } from "./map"
import { StandardMessageData, isStandardMessage } from "./message"
import { StandardMomentData, isStandardMoment } from "./moment"
import { StandardRoomData, isStandardRoom } from "./room"

import { checkAll } from "./typeguards"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { StandardEditableData } from "@tonylb/mtw-base/ts/editable"
import { RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import { ReferenceListData } from "./reference"

export { isStandardRoom, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardImage }

export type StandardComponentNonEditData =
    StandardCharacterData |
    StandardExampleData |
    StandardRoomData |
    StandardFeatureData |
    StandardKnowledgeData |
    StandardMapData |
    StandardMessageData |
    StandardMomentData |



    StandardImageData

export type StandardRemoveData = {
    key?: string;
    universalKey?: string;
    tag: 'Remove';
    component: StandardComponentNonEditData;
    implicitParent?: StandardReferenceData | ComponentUUID;  // Parent StandardKey (serialized as StandardReferenceData or ComponentUUID)
}

export type StandardReplaceData = {
    key?: string;
    universalKey?: string;
    tag: 'Replace';
    match: StandardComponentNonEditData;
    payload: StandardComponentNonEditData;
    implicitParent?: StandardReferenceData | ComponentUUID;  // Parent StandardKey (serialized as StandardReferenceData or ComponentUUID)
}

export const isStandardFactory = <T extends StandardComponentData>(tag: StandardComponentTag) => (value: StandardComponentData): value is T => (typeof value !== 'string' && value.tag === tag)

export const isStandardNonEdit = (value: any): value is StandardComponentNonEditData => (
    isStandardCharacter(value) ||
    isStandardExample(value) ||
    isStandardRoom(value) ||
    isStandardFeature(value) ||
    isStandardKnowledge(value) ||
    isStandardMap(value) ||
    isStandardMessage(value) ||
    isStandardMoment(value) ||
    isStandardImage(value)
)

export const isStandardRemoveWithOptions = (options: { typeGuard?: (value: any) => boolean } = {}) => (arg: any): arg is StandardRemoveData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Remove'),
        ('component' in arg && (options.typeGuard ?? isStandardNonEdit)(arg.component))
    )
}

export const isStandardRemove = isStandardRemoveWithOptions()

export const isStandardReplaceWithOptions = (options: { typeGuard?: (value: any) => boolean } = {}) => (arg: any): arg is StandardReplaceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Replace'),
        ('match' in arg && (options.typeGuard ?? isStandardNonEdit)(arg.match)),
        ('payload' in arg && (options.typeGuard ?? isStandardNonEdit)(arg.payload))
    )
}

export const isStandardReplace = isStandardReplaceWithOptions()

export const unwrapStandardComponent = (component: StandardComponentData): StandardComponentNonEditData => {
    if (isStandardNonEdit(component)) {
        return component
    }
    else if (isStandardRemove(component)) {
        return component.component
    }
    else {
        return component.payload
    }
}

export type StandardFormData = {
    universalKey: AssetUUID;
    components: StandardComponentData[];
    metaData: GenericTree<SchemaTag>;
    shortName?: StandardEditableData<string>;
    summary?: StandardEditableData<RenderTree>;
    topLevel?: ReferenceListData;
}

export const isStandardComponentData = (arg: any): arg is StandardComponentData => (isStandardNonEdit(arg) || isStandardRemove(arg) || isStandardReplace(arg))

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
