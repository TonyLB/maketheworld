import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree";
import { isStandardComponentData, StandardComponentNonEditData } from "./components/dataTypes";
import { StandardBaseData } from "./components/dataTypes/abstract";
import { StandardActionData } from "./components/dataTypes/action";
import { StandardCharacterData } from "./components/dataTypes/character";
import { StandardComputedData } from "./components/dataTypes/computed";
import { StandardExampleData } from "./components/dataTypes/example";
import { StandardFeatureData } from "./components/dataTypes/feature";
import { StandardImageData } from "./components/dataTypes/image";
import { StandardKnowledgeData } from "./components/dataTypes/knowledge";
import { StandardMapData } from "./components/dataTypes/map";
import { StandardMessageData } from "./components/dataTypes/message";
import { StandardMomentData } from "./components/dataTypes/moment";
import { StandardRoomData } from "./components/dataTypes/room";
import { checkAll, checkTypes } from "./components/dataTypes/typeguards";
import { StandardVariableData } from "./components/dataTypes/variable";
import { AssetUUID, ComponentUUID, isSchemaAssetUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "@tonylb/mtw-base/ts/schema/edit";
import { StandardKey } from "./components/reference";
import { deepEqual } from "../lib/objects";
import { StandardReferenceData } from "./components/dataTypes/reference";

type StandardBase = {
    key: string;
    update?: boolean;
}

export type StandardNodeKeys<T extends StandardBase> = Exclude<{
        [K in keyof T]: T[K] extends GenericTreeNodeFiltered<any, any> | undefined ? K : never
    }[keyof T], (undefined | 'key' | 'id' | 'update')>

export type StandardCharacter = StandardCharacterData
export type StandardRoom = StandardRoomData
export type StandardFeature = StandardFeatureData
export type StandardKnowledge = StandardKnowledgeData
export type StandardMap = StandardMapData
export type StandardMessage = StandardMessageData
export type StandardMoment = StandardMomentData
export type StandardVariable = StandardVariableData
export type StandardComputed = StandardComputedData
export type StandardAction = StandardActionData
export type StandardImage = StandardImageData

export type StandardComponentDataNonEdit =
    StandardCharacter |
    StandardExampleData |
    StandardRoom |
    StandardFeature |
    StandardKnowledge |
    StandardMap |
    StandardMessage |
    StandardMoment |
    StandardVariable |
    StandardComputed |
    StandardAction |
    StandardImage

export type StandardRemove = {
    key?: string;
    universalKey?: string;
    tag: 'Remove';
    context?: StandardReferenceData[];
    component: StandardComponentDataNonEdit;
}

export type StandardReplace = {
    key?: string;
    universalKey?: string;
    tag: 'Replace';
    context?: StandardReferenceData[];
    match: StandardComponentDataNonEdit;
    payload: StandardComponentDataNonEdit;
}

export const unwrapStandardComponent = (component: StandardComponentData): StandardComponentDataNonEdit => {
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

export type StandardComponentData = StandardComponentDataNonEdit | StandardRemove | StandardReplace
export type StandardComponentTag = StandardComponentData["tag"]

export const isStandardFactory = <T extends StandardComponentData>(tag: StandardComponentTag) => (value: StandardComponentData): value is T => (value.tag === tag)

export const isStandardCharacter = isStandardFactory<StandardCharacter>("Character")
export const isStandardRoom = isStandardFactory<StandardRoom>("Room")
export const isStandardFeature = isStandardFactory<StandardFeature>("Feature")
export const isStandardKnowledge = isStandardFactory<StandardKnowledge>("Knowledge")
export const isStandardMap = isStandardFactory<StandardMap>("Map")
export const isStandardMessage = isStandardFactory<StandardMessage>("Message")
export const isStandardMoment = isStandardFactory<StandardMoment>("Moment")
export const isStandardAction = isStandardFactory<StandardAction>("Action")
export const isStandardVariable = isStandardFactory<StandardVariable>("Variable")
export const isStandardComputed = isStandardFactory<StandardComputed>("Computed")
export const isStandardImage = isStandardFactory<StandardImage>("Image")

export const isStandardRemove = isStandardFactory<StandardRemove>("Remove")
export const isStandardReplace = isStandardFactory<StandardReplace>("Replace")

export const isStandardNonEdit = (value: StandardComponentData): value is Exclude<StandardComponentData, StandardRemove | StandardReplace> => (!(["Remove", "Replace"].includes(value.tag)))

export const defaultComponentFromTag = (tag: SchemaTag["tag"], key?: string, universalKey?: ComponentUUID): Exclude<StandardComponentNonEditData, string> => {
    switch(tag) {
        case 'Example':
            return {
                tag,
                key,
                universalKey
            }
        case 'Character':
            return {
                tag,
                key,
                universalKey
            }
        case 'Room':
            return {
                tag,
                key,
                universalKey,
                exits: []
            }
        case 'Feature':
        case 'Knowledge':
            return {
                tag,
                key,
                universalKey
            }
        case 'Message':
            return {
                tag,
                key,
                universalKey,
                rooms: []
            }
        case 'Image':
            return {
                tag: 'Image' as const,
                key,
                universalKey
            }
        case 'Variable':
            return {
                tag: 'Variable' as const,
                key,
                universalKey,
                default: ''
            }
        case 'Computed':
            return {
                tag: 'Computed' as const,
                key,
                universalKey,
                src: '',
            }
        case 'Action':
            return {
                tag: 'Action' as const,
                key,
                universalKey,
                src: '',
            }
        case 'Map':
            return {
                tag: 'Map' as const,
                key,
                universalKey,
                images: [],
                positions: [],
            }
        default:
            throw new Error(`No default component for tag: '${tag}'`)
    }
}

export type EditInternalStandardNode<T extends SchemaTag, ChildType extends SchemaTag> = GenericTreeNodeFiltered<T, ChildType>

export type EditWrappedStandardNode<T extends SchemaTag, ChildType extends SchemaTag> = {
    data: SchemaRemoveTag;
    children: EditInternalStandardNode<T, ChildType>[];
} | {
    data: SchemaReplaceTag;
    children: { data: SchemaReplaceMatchTag | SchemaReplacePayloadTag, children: EditInternalStandardNode<T, ChildType>[] }[];
} | EditInternalStandardNode<T, ChildType>

export type StandardAsset = {
    tag: 'Asset';
} & StandardBase

export type SerializeNDJSONMixin = {
    from?: AssetUUID;
    universalKey?: string;
    fileName?: string;
}

export type StandardNDJSON = (({ tag: 'Asset', universalKey?: string } & StandardBaseData) | (StandardComponentData & SerializeNDJSONMixin))[]

export const isStandardNDJSONLine = (line: any): line is StandardNDJSON[number] => {
    if (!(typeof line === 'object')) {
        return false
    }
    if ('tag' in line && line.tag === 'Asset') {
        return checkAll(
            checkTypes(
                line,
                {
                    key: 'string'
                },
                {}
            )
        )
    }
    return checkAll(
        isStandardComponentData(line),
        checkTypes(
            line,
            {},
            {
                universalKey: 'string',
            }
        ),
        (!line?.from || isSchemaAssetUUID(line.from))
    )
}

export const isStandardNDJSON = (value: any): value is StandardNDJSON => {
    if (!Array.isArray(value)) {
        return false
    }
    return value.every(isStandardNDJSONLine)
}

export type StandardFormSubsetRequestFull = {
    requestType: 'Full',
    keys: StandardKey[];
    cascadeConditions?: {
        conditionType: 'Link' | 'Position' | 'Exit';
        cascadeType: StandardFormSubsetRequest["requestType"];
        chainCascade?: boolean;
    }[];
}

export type StandardFormSubsetRequestStub = {
    requestType: 'Stub',
    keys: StandardKey[];
}

export type StandardFormSubsetRequestShortName = {
    requestType: 'ShortName',
    keys: StandardKey[];
}

export type StandardFormSubsetRequestExit = {
    requestType: 'Exit',
    keys: StandardKey[];
    cascadeConditions?: {
        conditionType: 'Link' | 'Position' | 'Exit';
        cascadeType: StandardFormSubsetRequest["requestType"];
        chainCascade?: boolean;
    }[];
}

export type StandardFormSubsetRequest =
    StandardFormSubsetRequestFull |
    StandardFormSubsetRequestExit |
    StandardFormSubsetRequestShortName |
    StandardFormSubsetRequestStub

export const standardFormSubsetRequestPriority = (request?: StandardFormSubsetRequest): number => {
    if (!request) {
        return Infinity
    }
    switch(request.requestType) {
        case 'Full':
            return 1
        case 'Exit':
            return 2
        case 'ShortName':
            return 3
        case 'Stub':
            return 4
    }
}

//
// TODO: Create a standardForSubsetRequestMatch function that can compare two requests and determine if they have
// equivalent arguments (other than their keys) and return a boolean. This will be useful for determining
// if a new request can be merged with an existing one.
//
export const standardFormSubsetRequestMatch = (a: StandardFormSubsetRequest) => (b: StandardFormSubsetRequest): boolean => {
    if (a.requestType !== b.requestType) {
        return false
    }
    switch(a.requestType) {
        case 'Full':
        case 'Exit':
            if (b.requestType !== a.requestType) {
                return false
            }
            return deepEqual(a.cascadeConditions, b.cascadeConditions)
        case 'ShortName':
        case 'Stub':
            return true
    }
}