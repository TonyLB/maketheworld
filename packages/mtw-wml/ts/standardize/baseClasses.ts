import { GenericTreeNodeFiltered } from "@tonylb/mtw-base/ts/genericTree";
import { isStandardComponentData, isStandardComponentInputData, StandardComponentInputNonEditData, StandardComponentNonEditData } from "./components/dataTypes";
import { StandardBaseData } from "./components/dataTypes/abstract";

import { checkAll, checkTypes } from "./components/dataTypes/typeguards";

import { AssetUUID, ComponentUUID, isSchemaAssetUUID, SchemaTag } from "@tonylb/mtw-base/ts/schema";
import { SchemaRemoveTag, SchemaReplaceMatchTag, SchemaReplacePayloadTag, SchemaReplaceTag } from "@tonylb/mtw-base/ts/schema/edit";
import { StandardKey } from "./keys/key";
import { ReferenceListData } from "./keys/dataTypes/reference";
import { StandardComponentReferenceKey } from "./components/baseClasses";

/**
 * Semantic modes that StandardForm can operate in, indicating how the form should be interpreted
 * and used in different contexts.
 * 
 * @see {@link ./AGENT.md#semantic-modes AGENT.md - Semantic Modes} for detailed explanation of each mode
 */
export type StandardFormSemanticMode = 
    | 'direct-representation'    // Mode 1: Direct representation of a single asset
    | 'edits-to-apply'           // Mode 2: Edits to be applied to a single asset  
    | 'aggregation'              // Mode 3: Aggregation of content from multiple assets

export type StandardComponentData = StandardComponentNonEditData
export type StandardComponentInputData = StandardComponentInputNonEditData
export type StandardComponentTag = StandardComponentData["tag"]

export const isStandardDataFactory = <T extends StandardComponentData>(tag: StandardComponentTag) => (value: StandardComponentData): value is T => (value.tag === tag)

export const defaultComponentFromTag = (tag: SchemaTag["tag"], key?: string, universalKey?: ComponentUUID): Exclude<StandardComponentNonEditData, string> => {
    switch(tag) {
        case 'Character':
        case 'Room':
        case 'Feature':
        case 'Knowledge':
        case 'Message':
        case 'Moment':
        case 'Image':
        case 'Map':
        case 'Mark':
        case 'Lens':
        case 'Guidance':
        case 'Situation':
            return {
                tag,
                key,
                universalKey
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
    key: string;
    universalKey?: string;
}

export type SerializeNDJSONMixin = {
    from?: AssetUUID;
    origin?: AssetUUID[];  // Array of ancestor asset UUIDs in inheritance chain (from StandardBaseData)
    universalKey?: string;
    fileName?: string;
}

export type StandardNDJSON = (({ tag: 'Asset', topLevel?: ReferenceListData } & StandardBaseData) | (StandardComponentInputData & SerializeNDJSONMixin))[]

export const isStandardNDJSONLine = (line: any): line is StandardNDJSON[number] => {
    if (!(typeof line === 'object')) {
        return false
    }
    if ('tag' in line && line.tag === 'Asset') {
        return checkAll(
            checkTypes(
                line,
                {
                    universalKey: 'string'
                },
                {
                    shortName: 'string',
                    summary: 'renderTree'
                }
            ),
            isSchemaAssetUUID(line.universalKey)
        )
    }
    return checkAll(
        isStandardComponentInputData(line),
        checkTypes(
            line,
            {},
            {
                universalKey: 'string',
            }
        ),
        (!line?.from || isSchemaAssetUUID(line.from)),
        (!line?.origin || (Array.isArray(line.origin) && line.origin.every(isSchemaAssetUUID)))
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
    cascadeConditions?: StandardFormSubsetCascadeCondition[];
}

export type StandardFormSubsetRequestStub = {
    requestType: 'Stub',
    keys: StandardKey[];
    cascadeConditions?: StandardFormSubsetCascadeCondition[];
}

export type StandardFormSubsetRequestShortName = {
    requestType: 'ShortName',
    keys: StandardKey[];
    cascadeConditions?: StandardFormSubsetCascadeCondition[];
}

export type StandardFormSubsetRequestExitsAndShortName = {
    requestType: 'ExitsAndShortName',
    keys: StandardKey[];
    cascadeConditions?: StandardFormSubsetCascadeCondition[];
}

// New directed graph cascade condition type
export type StandardFormSubsetCascadeGraphNode = {
    name: string;
    requestType: StandardFormSubsetRequest['requestType'];
    transitions: ({
        connectionType: StandardComponentReferenceKey['referenceType'];
        targetNode: string; // Reference to another node by name
    })[];
}

export type StandardFormSubsetCascadeCondition = {
    graph: StandardFormSubsetCascadeGraphNode[];
    startNodes: string[]; // Names of nodes to start traversal from
}

export type StandardFormSubsetRequest =
    StandardFormSubsetRequestFull |
    StandardFormSubsetRequestExitsAndShortName |
    StandardFormSubsetRequestShortName |
    StandardFormSubsetRequestStub

export const standardFormSubsetRequestPriority = (request?: StandardFormSubsetRequest): number => {
    if (!request) {
        return Infinity
    }
    switch(request.requestType) {
        case 'Full':
            return 1
        case 'ExitsAndShortName':
            return 2
        case 'ShortName':
            return 3
        case 'Stub':
            return 4
        default:
            return Infinity
    }
}

//
// TODO: Create a standardForSubsetRequestMatch function that can compare two requests and determine if they have
// equivalent arguments (other than their keys) and return a boolean. This will be useful for determining
// if a new request can be merged with an existing one.
//
export const standardFormSubsetRequestMatch = (a: StandardFormSubsetRequest) => (b: StandardFormSubsetRequest): boolean => {
    // For merging purposes, we only care about requestType matching
    // cascadeConditions are used during traversal, not merging
    return a.requestType === b.requestType
}