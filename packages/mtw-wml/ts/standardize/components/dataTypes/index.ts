import { SchemaTag } from "../../../schema/baseClasses";
import { GenericTree } from "../../../tree/baseClasses";
import { StandardActionData } from "./action";
import { StandardBookmarkData } from "./bookmark";
import { StandardCharacterData } from "./character";
import { StandardComputedData } from "./computed";
import { StandardFeatureData } from "./feature";
import { StandardImageData } from "./image";
import { StandardKnowledgeData } from "./knowledge";
import { StandardMapData } from "./map";
import { StandardMessageData } from "./message";
import { StandardMomentData } from "./moment";
import { StandardRoomData } from "./room";
import { StandardThemeData } from "./theme";
import { StandardVariableData } from "./variable";

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
export const isStandardRoom = isStandardFactory<StandardRoomData>("Room")
export const isStandardFeature = isStandardFactory<StandardFeatureData>("Feature")
export const isStandardKnowledge = isStandardFactory<StandardKnowledgeData>("Knowledge")
export const isStandardBookmark = isStandardFactory<StandardBookmarkData>("Bookmark")
export const isStandardMap = isStandardFactory<StandardMapData>("Map")
export const isStandardTheme = isStandardFactory<StandardThemeData>("Theme")
export const isStandardMessage = isStandardFactory<StandardMessageData>("Message")
export const isStandardMoment = isStandardFactory<StandardMomentData>("Moment")
export const isStandardAction = isStandardFactory<StandardActionData>("Action")
export const isStandardVariable = isStandardFactory<StandardVariableData>("Variable")
export const isStandardComputed = isStandardFactory<StandardComputedData>("Computed")
export const isStandardImage = isStandardFactory<StandardImageData>("Image")

export const isStandardRemove = isStandardFactory<StandardRemoveData>("Remove")
export const isStandardReplace = isStandardFactory<StandardReplaceData>("Replace")

export const isStandardNonEdit = (value: StandardComponentData): value is Exclude<StandardComponentData, StandardRemoveData | StandardReplaceData> => (!["Remove", "Replace"].includes(value.tag))

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
