import { SchemaTag } from "../../../schema/baseClasses";
import { GenericTree } from "../../../tree/baseClasses";
import { isSchemaTreeNode } from "../utils";
import { StandardActionData, isStandardAction } from "./action";
import { StandardBookmarkData, isStandardBookmark } from "./bookmark";
import { StandardCharacterData } from "./character";
import { StandardComputedData, isStandardComputed } from "./computed";
import { StandardFeatureData, isStandardFeature } from "./feature";
import { StandardImageData, isStandardImage } from "./image";
import { StandardKnowledgeData, isStandardKnowledge } from "./knowledge";
import { StandardMapData, isStandardMap } from "./map";
import { StandardMessageData, isStandardMessage } from "./message";
import { StandardMomentData, isStandardMoment } from "./moment";
import { StandardRoomData, isStandardRoom } from "./room";
import { StandardThemeData, isStandardTheme } from "./theme";
import { checkAll } from "./typeguards";
import { StandardVariableData, isStandardVariable } from "./variable";

export { isStandardRoom, isStandardFeature, isStandardKnowledge, isStandardBookmark, isStandardMap, isStandardTheme, isStandardMessage, isStandardMoment, isStandardAction, isStandardVariable, isStandardComputed, isStandardImage }

export type StandardComponentNonEditData =
    StandardCharacterData |
    StandardRoomData |
    StandardFeatureData |
    StandardKnowledgeData |
    StandardBookmarkData |
    StandardMapData |
    StandardThemeData |
    StandardMessageData |
    StandardMomentData |
    StandardVariableData |
    StandardComputedData |
    StandardActionData |
    StandardImageData

export type StandardRemoveData = {
    key: string;
    tag: 'Remove';
    component: StandardComponentNonEditData;
}

export type StandardReplaceData = {
    key: string;
    tag: 'Replace';
    match: StandardComponentNonEditData;
    payload: StandardComponentNonEditData;
}

export const isStandardFactory = <T extends StandardComponentData>(tag: T["tag"]) => (value: StandardComponentData): value is T => (value.tag === tag)

export const isStandardCharacter = isStandardFactory<StandardCharacterData>("Character")

export const isStandardNonEdit = (value: any): value is StandardComponentNonEditData => (
    isStandardRoom(value) ||
    isStandardFeature(value) ||
    isStandardKnowledge(value) ||
    isStandardBookmark(value) ||
    isStandardMap(value) ||
    isStandardTheme(value) ||
    isStandardMessage(value) ||
    isStandardMoment(value) ||
    isStandardVariable(value) ||
    isStandardComputed(value) ||
    isStandardAction(value) ||
    isStandardImage(value)
)

export const isStandardRemove = (arg: any): arg is StandardRemoveData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Remove'),
        ('component' in arg && isStandardNonEdit(arg.component))
    )
}
export const isStandardReplace = (arg: any): arg is StandardReplaceData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('tag' in arg && arg.tag === 'Replace'),
        ('match' in arg && isStandardNonEdit(arg.match)),
        ('payload' in arg && isStandardNonEdit(arg.payload))
    )
}

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

export type StandardComponentData = StandardComponentNonEditData | StandardRemoveData | StandardReplaceData
export type StandardFormData = {
    key: string;
    tag: 'Asset' | 'Character';
    update?: boolean;
    byId: Record<string, StandardComponentData>;
    metaData: GenericTree<SchemaTag>;
}

export const isStandardComponent = (arg: any): arg is StandardComponentData => (isStandardNonEdit(arg) || isStandardRemove(arg) || isStandardReplace(arg))

export const isStandardForm = (arg: any): arg is StandardFormData => {
    if (typeof arg !== 'object') {
        return false
    }
    return checkAll(
        ('key' in arg && typeof arg.key === 'string'),
        ('tag' in arg && ['Asset', 'Character'].includes(arg.tag)),
        ('metaData' in arg && Array.isArray(arg.metaData) && arg.metaData.every(isSchemaTreeNode)),
        ('byId' in arg && typeof arg.byId === 'object' && Object.values(arg.byId).every(isStandardComponent))
    )
}
