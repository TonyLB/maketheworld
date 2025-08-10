import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/readOnly"
import {

    EphemeraCharacterId,

    EphemeraFeatureId,
    EphemeraId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraMomentId,
    EphemeraRoomId,



    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId,

} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { splitType } from "@tonylb/mtw-utilities/ts/types";
import { GenericTree } from "@tonylb/mtw-base/ts/genericTree";
// StateItemId removed - Variable/Computed functionality no longer available
type StateItemId = string;
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-base/ts/schema";

type WrappedSchemaOutputTag = SchemaOutputTag | { tag: 'Remove' } | { tag: 'Replace' } | { tag: 'ReplaceMatch' } | { tag: 'ReplacePayload' }

export type EphemeraItemDependency = {
    key: string;
    EphemeraId: string;
}

export type EphemeraCondition = {
    dependencies: EphemeraItemDependency[];
    not?: boolean;
    if: string;
}

export type EphemeraConditionMixin = {
    conditions: EphemeraCondition[];
}

export type EphemeraNameMixin = {
    name: GenericTree<WrappedSchemaOutputTag>;
}

export type EphemeraRenderMixin = {
    render: GenericTree<WrappedSchemaOutputTag>;
}

// EphemeraStateMappingMixin removed - was for Variable/Computed state management

export type EphemeraKeyMappingMixin = {
    keyMapping: Record<string, string>;
}

export type EphemeraFeature = {
    EphemeraId: EphemeraFeatureId;
    key: string;
} & EphemeraNameMixin & EphemeraRenderMixin & EphemeraKeyMappingMixin

export type EphemeraKnowledge = {
    EphemeraId: EphemeraKnowledgeId;
    key: string;
} & EphemeraNameMixin

export type EphemeraRoom = {
    EphemeraId: EphemeraRoomId;
    key: string;
    shortName: GenericTree<WrappedSchemaOutputTag>;
    summary: GenericTree<WrappedSchemaOutputTag>;
    exits: GenericTree<SchemaTag>;
} & EphemeraNameMixin & EphemeraRenderMixin & EphemeraConditionMixin

export type EphemeraMapRoom = {
    EphemeraId: string;
    x: number;
    y: number;
} & EphemeraConditionMixin

export type EphemeraMap = {
    EphemeraId: EphemeraMapId;
    key: string;
    rooms: GenericTree<SchemaTag>;
    images: GenericTree<SchemaTag>;
} & EphemeraNameMixin & EphemeraKeyMappingMixin

export type EphemeraMessageRoom = {
    EphemeraId: string;
} & EphemeraConditionMixin

export type EphemeraMessage = {
    EphemeraId: EphemeraMessageId;
    key: string;
    rooms: EphemeraRoomId[];
} & EphemeraRenderMixin & EphemeraKeyMappingMixin

export type EphemeraMomentMessage = {
    EphemeraId: string;
} & EphemeraConditionMixin

export type EphemeraMoment = {
    EphemeraId: EphemeraMomentId;
    key: string;
    messages: EphemeraMessageId[];
}

export type EphemeraCharacter = {
    EphemeraId: EphemeraCharacterId;
    key: string;
    address: AssetWorkspaceAddress;
    Name: string;
    Pronouns?: string;
    Color: 'blue' | 'purple' | 'green' | 'pink';
    fileURL?: string;
    Connected: boolean;
    ConnectionIds: string[];
    RoomId: string;
    assets: string[];
    player?: string;
}



export type EphemeraItem = EphemeraFeature | EphemeraKnowledge | EphemeraMessage | EphemeraMoment | EphemeraRoom | EphemeraMap | EphemeraCharacter

export const isEphemeraFeatureItem = (item: EphemeraItem): item is EphemeraFeature => (isEphemeraFeatureId(item.EphemeraId))
export const isEphemeraKnowledgeItem = (item: EphemeraItem): item is EphemeraKnowledge => (isEphemeraKnowledgeId(item.EphemeraId))
export const isEphemeraMessageItem = (item: EphemeraItem): item is EphemeraMessage => (isEphemeraMessageId(item.EphemeraId))
export const isEphemeraMomentItem = (item: EphemeraItem): item is EphemeraMoment => (isEphemeraMomentId(item.EphemeraId))
export const isEphemeraRoomItem = (item: EphemeraItem): item is EphemeraRoom => (isEphemeraRoomId(item.EphemeraId))
export const isEphemeraMapItem = (item: EphemeraItem): item is EphemeraMap => (isEphemeraMapId(item.EphemeraId))


const isLegalEphemeraTag = (tag: string): tag is SchemaTag["tag"] => (['Asset', 'Feature', 'Knowledge', 'Room', 'Map', 'Character', 'Message'].includes(tag))

export const tagFromEphemeraWrappedId = (EphemeraId: string): SchemaTag["tag"] => {
    const [upperTag] = splitType(EphemeraId)
    const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
    if (isLegalEphemeraTag(tag)) {
        return tag
    }
    else {
        throw new Error(`Invalid dependency tag: ${tag}`)
    }
}








export type EphemeraPushArgs = {
    EphemeraId: string;
    scopeMap?: any;
}