import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist"
import {
    EphemeraActionId,
    EphemeraBookmarkId,
    EphemeraCharacterId,
    EphemeraComputedId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraMessageId,
    EphemeraMomentId,
    EphemeraRoomId,
    EphemeraVariableId
} from "@tonylb/mtw-interfaces/dist/baseClasses";
import { TaggedMessageContent } from "@tonylb/mtw-interfaces/dist/messages";
import { splitType } from "@tonylb/mtw-utilities/dist/types";
import { NormalCharacterPronouns } from "@tonylb/mtw-wml/dist/normalize/baseClasses"

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

export type EphemeraFeatureAppearance = {
    name: TaggedMessageContent[];
    render: TaggedMessageContent[];
} & EphemeraConditionMixin

export type EphemeraFeature = {
    EphemeraId: EphemeraFeatureId;
    key: string;
    appearances: EphemeraFeatureAppearance[];
}

export type EphemeraKnowledgeAppearance = EphemeraFeatureAppearance

export type EphemeraKnowledge = {
    EphemeraId: EphemeraKnowledgeId;
    key: string;
    appearances: EphemeraKnowledgeAppearance[];
}

export type EphemeraBookmarkAppearance = {
    render: TaggedMessageContent[];
} & EphemeraConditionMixin

export type EphemeraBookmark = {
    EphemeraId: EphemeraBookmarkId;
    key: string;
    appearances: EphemeraBookmarkAppearance[];
}

export type EphemeraExit = {
    conditions: EphemeraCondition[];
    name: string;
    to: EphemeraRoomId;
}

export type EphemeraRoomAppearance = {
    name: TaggedMessageContent[];
    render: TaggedMessageContent[];
    exits: EphemeraExit[];
} & EphemeraConditionMixin

export type EphemeraRoom = {
    EphemeraId: EphemeraRoomId;
    key: string;
    appearances: EphemeraRoomAppearance[];
}

export type EphemeraMapRoom = {
    EphemeraId: string;
    x: number;
    y: number;
} & EphemeraConditionMixin

export type EphemeraMapAppearance = {
    fileURL: string;
    name: TaggedMessageContent[];
    rooms: EphemeraMapRoom[];
} & EphemeraConditionMixin

export type EphemeraMessageAppearance = {
    render: TaggedMessageContent[];
    rooms: EphemeraRoomId[];
} & EphemeraConditionMixin

export type EphemeraMessage = {
    EphemeraId: EphemeraMessageId;
    key: string;
    appearances: EphemeraMessageAppearance[];
}

export type EphemeraMomentAppearance = {
    messages: EphemeraMessageId[];
} & EphemeraConditionMixin

export type EphemeraMoment = {
    EphemeraId: EphemeraMomentId;
    key: string;
    appearances: EphemeraMomentAppearance[];
}

export type EphemeraMap = {
    EphemeraId: EphemeraMapId;
    key: string;
    appearances: EphemeraMapAppearance[];
}

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