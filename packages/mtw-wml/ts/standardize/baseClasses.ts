import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag, SchemaTag } from "../schema/baseClasses";
import { GenericTreeNodeFiltered } from "../tree/baseClasses";
import { isStandardComponent } from "./components/dataTypes";
import { StandardBaseData } from "./components/dataTypes/abstract";
import { StandardActionData } from "./components/dataTypes/action";
import { StandardBookmarkData } from "./components/dataTypes/bookmark";
import { StandardCharacterData } from "./components/dataTypes/character";
import { StandardComputedData } from "./components/dataTypes/computed";
import { StandardFeatureData } from "./components/dataTypes/feature";
import { StandardImageData } from "./components/dataTypes/image";
import { StandardKnowledgeData } from "./components/dataTypes/knowledge";
import { StandardMapData } from "./components/dataTypes/map";
import { StandardMessageData } from "./components/dataTypes/message";
import { StandardComponentExport, StandardComponentImport } from "./components/dataTypes/metaData";
import { StandardMomentData } from "./components/dataTypes/moment";
import { StandardRoomData } from "./components/dataTypes/room";
import { StandardThemeData } from "./components/dataTypes/theme";
import { checkAll, checkTypes } from "./components/dataTypes/typeguards";
import { StandardVariableData } from "./components/dataTypes/variable";

export class StandardizerError extends Error {}
export class MergeConflictError extends StandardizerError {
    constructor(message?: string) {
        super(message ?? 'Merge conflict')
    }
}

type StandardBase = {
    key: string;
    update?: boolean;
}

export type StandardNodeKeys<T extends StandardBase> = Exclude<{
        [K in keyof T]: T[K] extends GenericTreeNodeFiltered<any, any, any> | undefined ? K : never
    }[keyof T], (undefined | 'key' | 'id' | 'update')>

export type StandardCharacter = StandardCharacterData
export type StandardRoom = StandardRoomData
export type StandardFeature = StandardFeatureData
export type StandardKnowledge = StandardKnowledgeData
export type StandardBookmark = StandardBookmarkData
export type StandardMap = StandardMapData
export type StandardTheme = StandardThemeData
export type StandardMessage = StandardMessageData
export type StandardMoment = StandardMomentData
export type StandardVariable = StandardVariableData
export type StandardComputed = StandardComputedData
export type StandardAction = StandardActionData
export type StandardImage = StandardImageData

export type StandardComponentDataNonEdit =
    StandardCharacter |
    StandardRoom |
    StandardFeature |
    StandardKnowledge |
    StandardBookmark |
    StandardMap |
    StandardTheme |
    StandardMessage |
    StandardMoment |
    StandardVariable |
    StandardComputed |
    StandardAction |
    StandardImage

export type StandardRemove = {
    tag: 'Remove';
    component: StandardComponentDataNonEdit;
} & StandardBase

export type StandardReplace = {
    tag: 'Replace';
    match: StandardComponentDataNonEdit;
    payload: StandardComponentDataNonEdit;
} & StandardBase

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

export const isStandardFactory = <T extends StandardComponentData>(tag: T["tag"]) => (value: StandardComponentData): value is T => (value.tag === tag)

export const isStandardCharacter = isStandardFactory<StandardCharacter>("Character")
export const isStandardRoom = isStandardFactory<StandardRoom>("Room")
export const isStandardFeature = isStandardFactory<StandardFeature>("Feature")
export const isStandardKnowledge = isStandardFactory<StandardKnowledge>("Knowledge")
export const isStandardBookmark = isStandardFactory<StandardBookmark>("Bookmark")
export const isStandardMap = isStandardFactory<StandardMap>("Map")
export const isStandardTheme = isStandardFactory<StandardTheme>("Theme")
export const isStandardMessage = isStandardFactory<StandardMessage>("Message")
export const isStandardMoment = isStandardFactory<StandardMoment>("Moment")
export const isStandardAction = isStandardFactory<StandardAction>("Action")
export const isStandardVariable = isStandardFactory<StandardVariable>("Variable")
export const isStandardComputed = isStandardFactory<StandardComputed>("Computed")
export const isStandardImage = isStandardFactory<StandardImage>("Image")

export const isStandardRemove = isStandardFactory<StandardRemove>("Remove")
export const isStandardReplace = isStandardFactory<StandardReplace>("Replace")

export const isStandardNonEdit = (value: StandardComponentData): value is Exclude<StandardComponentData, StandardRemove | StandardReplace> => (!["Remove", "Replace"].includes(value.tag))

export const defaultComponentFromTag = (tag: SchemaTag["tag"], key: string): StandardComponentData => {
    switch(tag) {
        case 'Room':
            return {
                tag,
                key,
                exits: [],
                themes: []
            }
        case 'Feature':
        case 'Knowledge':
            return {
                tag,
                key,
            }
        case 'Image':
            return {
                tag: 'Image' as const,
                key,
            }
        case 'Variable':
            return {
                tag: 'Variable' as const,
                key,
                default: 'false',
            }
        case 'Computed':
            return {
                tag: 'Computed' as const,
                key,
                src: '',
            }
        case 'Action':
            return {
                tag: 'Action' as const,
                key,
                src: '',
            }
        case 'Map':
            return {
                tag: 'Map' as const,
                key,
                themes: [],
                images: [],
                positions: [],
            }
        case 'Theme':
            return {
                tag: 'Theme' as const,
                key,
                prompts: [],
                rooms: [],
                maps: [],
            }
        default:
            throw new Error(`No default component for tag: '${tag}'`)
    }
}

export type EditInternalStandardNode<T extends SchemaTag, ChildType extends SchemaTag, Extra extends {} = {}> = GenericTreeNodeFiltered<T, ChildType, Extra>

export type EditWrappedStandardNode<T extends SchemaTag, ChildType extends SchemaTag, Extra extends {} = {}> = {
    data: SchemaRemoveTag;
    children: EditInternalStandardNode<T, ChildType, Extra>[];
} | {
    data: SchemaReplaceTag;
    children: { data: SchemaReplaceMatchTag | SchemaReplacePayloadTag, children: EditInternalStandardNode<T, ChildType, Extra>[] }[];
} | EditInternalStandardNode<T, ChildType, Extra>

export type StandardAsset = {
    tag: 'Asset';
} & StandardBase

export type SerializeNDJSONMixin = {
    from?: StandardComponentImport;
    exportAs?: StandardComponentExport;
    universalKey?: string;
    fileName?: string;
}

export type StandardNDJSON = (({ tag: 'Asset' } & StandardBaseData) | (StandardComponentData & SerializeNDJSONMixin))[]

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
        isStandardComponent(line),
        checkTypes(
            line,
            {},
            {
                universalKey: 'string',
            }
        ),
        (
            (!line?.from) ||
            (line.from.action === 'Content' && checkTypes(line.from.payload, { assetId: 'string' }, { fromKey: 'string' })) ||
            (line.from.action === 'Remove' && checkTypes(line.from.match, { assetId: 'string' }, { fromKey: 'string' })) ||
            (line.from.action === 'Replace' && checkTypes(line.from.match, { assetId: 'string' }, { fromKey: 'string' }) && checkTypes(line.from.payload, { assetId: 'string' }, { fromKey: 'string' }))
        ),
        (
            (!line?.exportAs) ||
            (line.exportAs.action === 'Content' && checkTypes(line.exportAs, { payload: 'string' })) ||
            (line.exportAs.action === 'Remove' && checkTypes(line.exportAs, { match: 'string' })) ||
            (line.exportAs.action === 'Replace' && checkTypes(line.exportAs, { match: 'string', payload: 'string' }))
        )
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
    keys: string[];
    cascadeConditions?: {
        conditionType: 'Link';
        cascadeType: StandardFormSubsetRequest["requestType"];
    }[];
}

export type StandardFormSubsetRequestStub = {
    requestType: 'Stub',
    keys: string[];
}

export type StandardFormSubsetRequestShortName = {
    requestType: 'ShortName',
    keys: string[];
}

export type StandardFormSubsetRequest =
    StandardFormSubsetRequestFull |
    StandardFormSubsetRequestShortName |
    StandardFormSubsetRequestStub

export const standardFormSubsetRequestPriority = (request?: StandardFormSubsetRequest): number => {
    if (!request) {
        return Infinity
    }
    switch(request.requestType) {
        case 'Full':
            return 1
        case 'ShortName':
            return 2
        case 'Stub':
            return 3
    }
}