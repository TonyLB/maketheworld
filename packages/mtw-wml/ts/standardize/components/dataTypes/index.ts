import { GenericTree } from "@tonylb/mtw-base/ts/genericTree"
import type { SerializeNDJSONMixin, StandardComponentData, StandardComponentTag } from "../../baseClasses"
import { isSchemaTreeNode } from "../utils"
import { ComponentTag, StandardBaseData } from "./abstract"
import { StandardActionData, isStandardAction } from "./action"
import { isStandardCharacter, StandardCharacterData } from "./character"
import { StandardComputedData, isStandardComputed } from "./computed"
import { isStandardExample, StandardExampleData } from "./example"
import { StandardFeatureData, isStandardFeature } from "./feature"
import { StandardImageData, isStandardImage } from "./image"
import { StandardKnowledgeData, isStandardKnowledge } from "./knowledge"
import { StandardMapData, isStandardMap } from "./map"
import { StandardMessageData, isStandardMessage } from "./message"
import { StandardMomentData, isStandardMoment } from "./moment"
import { StandardRoomData, isStandardRoom } from "./room"
import { StandardVariableData, isStandardVariable } from "./variable"
import { checkAll } from "./typeguards"
import { SchemaTag } from "@tonylb/mtw-base/ts/schema"
import { isStandardReferencePayloadData, StandardReferenceData } from "./reference"

export { isStandardRoom, isStandardFeature, isStandardKnowledge, isStandardMap, isStandardMessage, isStandardMoment, isStandardAction, isStandardVariable, isStandardComputed, isStandardImage }

export type StandardComponentNonEditData =
    StandardCharacterData |
    StandardExampleData |
    StandardRoomData |
    StandardFeatureData |
    StandardKnowledgeData |
    StandardMapData |
    StandardMessageData |
    StandardMomentData |
    StandardVariableData |
    StandardComputedData |
    StandardActionData |
    StandardImageData

export type StandardRemoveData = {
    key?: string;
    universalKey?: string;
    tag: 'Remove';
    component: StandardComponentNonEditData;
}

export type StandardReplaceData = {
    key?: string;
    universalKey?: string;
    tag: 'Replace';
    match: StandardComponentNonEditData;
    payload: StandardComponentNonEditData;
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
    isStandardVariable(value) ||
    isStandardComputed(value) ||
    isStandardAction(value) ||
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
    key: string;
    byId: Record<string, StandardComponentData>;
    metaData: GenericTree<SchemaTag>;
}

export const isStandardComponent = (arg: any): arg is StandardComponentData => (isStandardNonEdit(arg) || isStandardRemove(arg) || isStandardReplace(arg))

export const isStandardForm = (arg: any): arg is StandardFormData => {
    if (typeof arg !== 'object') {
        return false
    }
    // const firstErrorComponent = Object.values(arg.byId ?? {}).find((value) => !isStandardComponent(value))
    // if (firstErrorComponent) {
    //     console.error(`Invalid component in byId: ${JSON.stringify(firstErrorComponent, null, 4)}`)
    // }
    return checkAll(
        ('key' in arg && typeof arg.key === 'string'),
        ('metaData' in arg && Array.isArray(arg.metaData) && arg.metaData.every(isSchemaTreeNode)),
        ('byId' in arg && typeof arg.byId === 'object' && Object.values(arg.byId).every(isStandardComponent))
    )
}
