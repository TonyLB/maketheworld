import { isRenderTreeNode, RenderTree } from "@tonylb/mtw-base/ts/renderTree"
import {
    EphemeraAssetId,
    EphemeraCharacterId,
    EphemeraFeatureId,
    EphemeraKnowledgeId,
    EphemeraMapId,
    EphemeraRoomId,
    isEphemeraAssetId,
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraMapId,
    isEphemeraRoomId,
    LegalCharacterColor
} from "./baseClasses";
import { checkAll, checkTypes } from "./utils";

export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target?: EphemeraCharacterId;
}

export type SpacerMessage = {
    DisplayProtocol: 'SpacerMessage';
} & MessageAddressing

const isRenderTree = (message: any): message is RenderTree | undefined => {
    if (typeof message === 'undefined') {
        return true
    }
    if (Array.isArray(message) && message.every(isRenderTreeNode)) {
        return true
    }
    return false
}

export type WorldMessage = {
    DisplayProtocol: 'WorldMessage';
    Message: RenderTree;
} & MessageAddressing

export type RoomExit = {
    Name: string;
    RoomId: EphemeraRoomId;
    Visibility: 'Public' | 'Private';
}

const validateRoomExitList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { Name: 'string', RoomId: 'string' })
            && isEphemeraRoomId(roomItem.RoomId)
            && ['Public', 'Private'].includes(roomItem.Visibility)
    ), true)
}

export type RoomCharacter = {
    Name: string;
    CharacterId: EphemeraCharacterId;
    fileURL?: string;
}

const validateRoomCharacterList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { Name: 'string', CharacterId: 'string' })
            && isEphemeraCharacterId(roomItem.CharacterId)
    ), true)
}

export type RoomDescribeData = {
    Description: RenderTree;
    ShortName: RenderTree;
    Name: RenderTree;
    Summary: RenderTree;
    RoomId: EphemeraRoomId;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
    assets?: Record<EphemeraAssetId, string>;
}

export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

export type FeatureDescribeData = {
    Description: RenderTree;
    Name: RenderTree;
    FeatureId: EphemeraFeatureId;
    assets?: Record<EphemeraAssetId, string>;
}

export type FeatureDescription = {
    DisplayProtocol: 'FeatureDescription';
} & FeatureDescribeData & MessageAddressing

export type KnowledgeDescribeData = {
    Description: RenderTree;
    Name: RenderTree;
    KnowledgeId: EphemeraKnowledgeId;
    assets?: Record<EphemeraAssetId, string>;
}

export type KnowledgeDescription = {
    DisplayProtocol: 'KnowledgeDescription';
} & KnowledgeDescribeData & MessageAddressing

export type MapDescribeRoom = {
    roomId: EphemeraRoomId;
    name: string;
    x: number;
    y: number;
    exits: {
        name: string;
        to: EphemeraRoomId;
    }[];
}

export type MapDescribeData = {
    MapId: EphemeraMapId;
    name: RenderTree;
    fileURL?: string;
    rooms: MapDescribeRoom[];
    assets?: Record<EphemeraAssetId, string>;
}

const validateMapRoomList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => {
        if (!(
            previous &&
            checkTypes(roomItem, { roomId: 'string', x: 'number', y: 'number' })
            && isEphemeraRoomId(roomItem.roomId)
        )) {
            return false
        }
        const exits = roomItem.exits
        if (!Array.isArray(exits)) {
            return false
        }
        return exits.reduce<boolean>((previous, exit) => (
            previous && checkTypes(exit, { name: 'string', to: 'string' }) && isEphemeraRoomId(exit.to)
        ), true)
    }, true)
}

export const isMapDescribeData = (message: any): message is MapDescribeData => {
    return checkAll(
        checkTypes(message, { MapId: 'string' }),
        !(message.fileURL && typeof message.fileURL !== 'string'),
        isEphemeraMapId(message.MapId),
        validateMapRoomList(message.rooms),
        isRenderTree(message.name)
    )
}

type CharacterDescribeData = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    fileURL?: string;
    Pronouns?: {
        subject: string;
        object: string;
        reflexive: string;
        possessive: string;
        adjective: string;
    };
    OneCoolThing?: string;
}

export type CharacterDescription = {
    DisplayProtocol: 'CharacterDescription';
} & CharacterDescribeData & MessageAddressing

export type RoomHeader = {
    DisplayProtocol: 'RoomHeader';
} & RoomDescribeData & MessageAddressing

export type RoomUpdate = {
    DisplayProtocol: 'RoomUpdate';
} & MessageAddressing & Partial<RoomDescribeData>

type MessageCharacterInfo = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    Color: LegalCharacterColor;
    fileURL?: string;
}

export type CharacterSpeech = {
    DisplayProtocol: 'SayMessage';
    Message: RenderTree;
} & MessageAddressing & MessageCharacterInfo

export type CharacterNarration = {
    DisplayProtocol: 'NarrateMessage';
    Message: RenderTree;
} & MessageAddressing & MessageCharacterInfo

export type OutOfCharacterMessage = {
    DisplayProtocol: 'OOCMessage';
    Message: RenderTree;
} & MessageAddressing & MessageCharacterInfo

export type Message = SpacerMessage | WorldMessage | RoomDescription | RoomHeader | RoomUpdate | FeatureDescription | KnowledgeDescription | CharacterDescription | CharacterNarration | CharacterSpeech | OutOfCharacterMessage

export const isMessage = (message: any): message is Message => {
    if (typeof message !== 'object') {
        return false
    }
    if (!checkTypes(message, { MessageId: 'string', CreatedTime: 'number' }, { Target: 'string' })) {
        return false
    }
    if (message.Target && !isEphemeraCharacterId(message.Target)) {
        return false
    }
    switch(message.DisplayProtocol) {
        case 'WorldMessage':
            return isRenderTree(message.Message)
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            return checkAll(
                checkTypes(message, { CharacterId: 'string', Name: 'string' }),
                ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color),
                isRenderTree(message.Message)
            ) && isEphemeraCharacterId(message.CharacterId)
        case 'RoomDescription':
        case 'RoomHeader':
            return checkAll(
                checkTypes(message, { RoomId: 'string' }),
                validateRoomExitList(message.Exits),
                validateRoomCharacterList(message.Characters),
                isRenderTree(message.Name),
                isRenderTree(message.Description),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraRoomId(message.RoomId)
        case 'RoomUpdate':
            return checkAll(
                checkTypes(message, {}, { RoomId: 'string' }),
                validateRoomExitList(message.Exits ?? []),
                validateRoomCharacterList(message.Characters ?? []),
                isRenderTree(message.Name ?? []),
                isRenderTree(message.Description ?? []),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraRoomId(message.RoomId)
        case 'FeatureDescription':
            return checkAll(
                checkTypes(message, { FeatureId: 'string' }),
                isRenderTree(message.Name),
                isRenderTree(message.Description),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraFeatureId(message.FeatureId)
        case 'KnowledgeDescription':
            return checkAll(
                checkTypes(message, { KnowledgeId: 'string' }),
                isRenderTree(message.Name),
                isRenderTree(message.Description),
                ...(Object.keys(message.assets || {})).map(isEphemeraAssetId)
            ) && isEphemeraKnowledgeId(message.KnowledgeId)
        case 'CharacterDescription':
            return checkAll(
                checkTypes(message, 
                    {
                        CharacterId: 'string',
                        Name: 'string'
                    },
                    {
                        fileUrl: 'string',
                        OneCoolThing: 'string',
                    }
                ),
                !message.Pronouns || checkTypes(message.Pronouns, {
                    subject: 'string',
                    object: 'string',
                    possessive: 'string',
                    adjective: 'string',
                    reflexive: 'string'
                })
            ) && isEphemeraCharacterId(message.CharacterId)
        default: return false
    }
}
