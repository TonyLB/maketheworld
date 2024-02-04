import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/readOnly"
import {
    EphemeraActionId,
    EphemeraBookmarkId,
    EphemeraCharacterId,
    EphemeraComputedId,
    EphemeraFeatureId,
    EphemeraId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraMomentId,
    EphemeraRoomId,
    EphemeraVariableId,
    isEphemeraActionId,
    isEphemeraBookmarkId,
    isEphemeraComputedId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraMessageId,
    isEphemeraMomentId,
    isEphemeraRoomId,
    isEphemeraVariableId
} from "@tonylb/mtw-interfaces/ts/baseClasses"
import { splitType } from "@tonylb/mtw-utilities/dist/types";
import { NormalCharacterPronouns } from "@tonylb/mtw-wml/ts/normalize/baseClasses"
import { GenericTree } from "@tonylb/mtw-wml/ts/tree/baseClasses";
import { SchemaOutputTag, SchemaTag } from "@tonylb/mtw-wml/ts/simpleSchema/baseClasses";
import { StateItemId } from "../internalCache/baseClasses"

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
    name: GenericTree<SchemaOutputTag>;
}

export type EphemeraRenderMixin = {
    render: GenericTree<SchemaOutputTag>;
}

export type EphemeraStateMappingMixin = {
    stateMapping: Record<string, StateItemId>;
}

export type EphemeraKeyMappingMixin = {
    keyMapping: Record<string, EphemeraId>;
}

export type EphemeraFeature = {
    EphemeraId: EphemeraFeatureId;
    key: string;
} & EphemeraNameMixin & EphemeraRenderMixin & EphemeraStateMappingMixin & EphemeraKeyMappingMixin

export type EphemeraKnowledge = {
    EphemeraId: EphemeraKnowledgeId;
    key: string;
} & EphemeraNameMixin & EphemeraRenderMixin & EphemeraStateMappingMixin & EphemeraKeyMappingMixin

export type EphemeraBookmark = {
    EphemeraId: EphemeraBookmarkId;
    key: string;
} & EphemeraRenderMixin & EphemeraStateMappingMixin & EphemeraKeyMappingMixin

export type EphemeraRoom = {
    EphemeraId: EphemeraRoomId;
    key: string;
    exits: GenericTree<SchemaTag>;
} & EphemeraNameMixin & EphemeraRenderMixin & EphemeraStateMappingMixin & EphemeraKeyMappingMixin

export type EphemeraMapRoom = {
    EphemeraId: string;
    x: number;
    y: number;
} & EphemeraConditionMixin & EphemeraStateMappingMixin

export type EphemeraMap = {
    EphemeraId: EphemeraMapId;
    key: string;
    rooms: GenericTree<SchemaTag>;
    images: GenericTree<SchemaTag>;
} & EphemeraNameMixin & EphemeraStateMappingMixin & EphemeraKeyMappingMixin

export type EphemeraMessageRoom = {
    EphemeraId: string;
} & EphemeraConditionMixin

export type EphemeraMessage = {
    EphemeraId: EphemeraMessageId;
    key: string;
    rooms: EphemeraRoomId[];
} & EphemeraRenderMixin & EphemeraStateMappingMixin & EphemeraKeyMappingMixin

export type EphemeraMomentMessage = {
    EphemeraId: string;
} & EphemeraConditionMixin

export type EphemeraMoment = {
    EphemeraId: EphemeraMomentId;
    key: string;
    messages: EphemeraMessageId[];
} & EphemeraStateMappingMixin

export type EphemeraCharacter = {
    EphemeraId: EphemeraCharacterId;
    key: string;
    address: AssetWorkspaceAddress;
    Name: string;
    Pronouns: NormalCharacterPronouns;
    FirstImpression: string;
    OneCoolThing?: string;
    Outfit?: string;
    Color: 'blue' | 'purple' | 'green' | 'pink';
    fileURL?: string;
    Connected: boolean;
    ConnectionIds: string[];
    RoomId: string;
    assets: string[];
}

export type EphemeraAction = {
    EphemeraId: EphemeraActionId;
    key: string;
    src: string;
}

export type EphemeraVariable = {
    EphemeraId: EphemeraVariableId;
    key: string;
    default: string;
}

export type EphemeraComputed = {
    EphemeraId: EphemeraComputedId;
    key: string;
    src: string;
    dependencies: EphemeraItemDependency[];
}

export type EphemeraItem = EphemeraFeature | EphemeraKnowledge | EphemeraBookmark | EphemeraMessage | EphemeraMoment | EphemeraRoom | EphemeraMap | EphemeraCharacter | EphemeraAction | EphemeraVariable | EphemeraComputed

export const isEphemeraFeatureItem = (item: EphemeraItem): item is EphemeraFeature => (isEphemeraFeatureId(item.EphemeraId))
export const isEphemeraKnowledgeItem = (item: EphemeraItem): item is EphemeraKnowledge => (isEphemeraKnowledgeId(item.EphemeraId))
export const isEphemeraBookmarkItem = (item: EphemeraItem): item is EphemeraBookmark => (isEphemeraBookmarkId(item.EphemeraId))
export const isEphemeraMessageItem = (item: EphemeraItem): item is EphemeraMessage => (isEphemeraMessageId(item.EphemeraId))
export const isEphemeraMomentItem = (item: EphemeraItem): item is EphemeraMoment => (isEphemeraMomentId(item.EphemeraId))
export const isEphemeraRoomItem = (item: EphemeraItem): item is EphemeraRoom => (isEphemeraRoomId(item.EphemeraId))
export const isEphemeraMapItem = (item: EphemeraItem): item is EphemeraMap => (isEphemeraMapId(item.EphemeraId))
export const isEphemeraActionItem = (item: EphemeraItem): item is EphemeraAction => (isEphemeraActionId(item.EphemeraId))
export const isEphemeraVariableItem = (item: EphemeraItem): item is EphemeraVariable => (isEphemeraVariableId(item.EphemeraId))
export const isEphemeraComputedItem = (item: EphemeraItem): item is EphemeraComputed => (isEphemeraComputedId(item.EphemeraId))

type LegalEphemeraTag = 'Asset' | (EphemeraItem['EphemeraId'] extends `${infer T}#${string}` ? Capitalize<Lowercase<T>> : never)

const isLegalEphemeraTag = (tag: string): tag is LegalEphemeraTag => (['Asset', 'Room', 'Map', 'Character', 'Action', 'Variable', 'Computed', 'Message'].includes(tag))

export const tagFromEphemeraWrappedId = (EphemeraId: string): LegalEphemeraTag => {
    const [upperTag] = splitType(EphemeraId)
    const tag = `${upperTag[0].toUpperCase()}${upperTag.slice(1).toLowerCase()}`
    if (isLegalEphemeraTag(tag)) {
        return tag
    }
    else {
        throw new Error(`Invalid dependency tag: ${tag}`)
    }
}

export type EphemeraDependencyImport = {
    key: string;
    asset: string;
}

export type EphemeraDependencies = {
    room?: string[];
    map?: string[];
    mapCache?: string[];
    computed?: string[];
    imported?: EphemeraDependencyImport[];
}

export type EphemeraStateComputed = {
    key: string;
    computed: true;
    src: string;
    value?: any;
}

export type EphemeraStateVariable = {
    key: string;
    computed?: false;
    imported?: false;
    value: any;
}

export type EphemeraStateImport = {
    key: string;
    computed?: false;
    imported: true;
    value: any;
    asset: string;
}

type EphemeraStateItem = EphemeraStateComputed | EphemeraStateVariable | EphemeraStateImport

export type EphemeraState = {
    [key: string]: EphemeraStateItem
}

export const isEphemeraStateVariable = (item: EphemeraStateItem): item is EphemeraStateVariable => (!(item.computed || item.imported))
export const isEphemeraStateComputed = (item: EphemeraStateItem): item is EphemeraStateComputed => (item.computed || false)
export const isEphemeraStateImport = (item: EphemeraStateItem): item is EphemeraStateImport => (!(item.computed || false) && (item.imported || false))

export type EphemeraImportStateItem = {
    state: EphemeraState;
    dependencies: Record<string, EphemeraDependencies>;
}

export type EphemeraImportState = {
    [key: string]: EphemeraImportStateItem;
}
export type EphemeraPushArgs = {
    EphemeraId: string;
    scopeMap?: any;
}