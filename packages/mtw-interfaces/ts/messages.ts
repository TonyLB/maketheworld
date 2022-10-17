import { EphemeraCharacterId, EphemeraFeatureId, EphemeraMapId, EphemeraRoomId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId, LegalCharacterColor } from "./baseClasses";
import { checkAll, checkTypes } from "./utils";

export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target: EphemeraCharacterId;
}

export type SpacerMessage = {
    DisplayProtocol: 'SpacerMessage';
} & MessageAddressing

type TaggedText = {
    tag: 'String';
    value: string;
}

type TaggedLineBreak = {
    tag: 'LineBreak';
}

export type TaggedLink = {
    tag: 'Link',
    text: string;
    to: string;
}

export type TaggedMessageContent = TaggedLink | TaggedText | TaggedLineBreak;

export const isTaggedMessageContent = (message: any): message is TaggedMessageContent => {
    if (typeof message !== 'object') {
        return false
    }
    switch(message.tag) {
        case 'String':
            return checkTypes(message, { value: 'string' })
        case 'LineBreak':
            return true
        case 'Link':
            return checkTypes(message, { text: 'string', to: 'string' })
        default: return false
    }
}

export const isTaggedLink = (item: TaggedMessageContent): item is TaggedLink => (item.tag === 'Link')
export const isTaggedText = (item: TaggedMessageContent): item is TaggedText => (item.tag === 'String')
export const isTaggedLineBreak = (item: TaggedMessageContent): item is TaggedLineBreak => (item.tag === 'LineBreak')

export type WorldMessage = {
    DisplayProtocol: 'WorldMessage';
    Message: TaggedMessageContent[];
} & MessageAddressing

export type RoomExit = {
    Name: string;
    RoomId: string;
    Visibility: 'Public' | 'Private';
}

const validateRoomExitList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { Name: 'string', RoomId: 'string' })
            && ['Public', 'Private'].includes(roomItem.Visibility)
    ), true)
}

export type RoomCharacter = {
    Name: string;
    CharacterId: string;
}

const validateRoomCharacterList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => (
        previous
            && checkTypes(roomItem, { Name: 'string', CharacterId: 'string' })
    ), true)
}

export type RoomDescribeData = {
    Description: TaggedMessageContent[];
    Name: string;
    RoomId: EphemeraRoomId;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
}

export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

export type FeatureDescribeData = {
    Description: TaggedMessageContent[];
    Name: string;
    FeatureId: EphemeraFeatureId;
}

export type FeatureDescription = {
    DisplayProtocol: 'FeatureDescription';
} & FeatureDescribeData & MessageAddressing

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
    Name: string;
    fileURL?: string;
    rooms: MapDescribeRoom[];
}

const validateMapRoomList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => {
        if (!(
            previous &&
            checkTypes(roomItem, { roomId: 'string', name: 'string', x: 'number', y: 'number' })
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
        checkTypes(message, { MapId: 'string', Name: 'string' }),
        !(message.fileURL && typeof message.fileURL !== 'string'),
        isEphemeraMapId(message.MapId),
        validateMapRoomList(message.rooms)
    )
}

type CharacterDescribeData = {
    CharacterId: EphemeraCharacterId;
    Name: string;
    fileURL?: string;
    FirstImpression?: string;
    Pronouns?: {
        subject: string;
        object: string;
        reflexive: string;
        possessive: string;
        adjective: string;
    };
    OneCoolThing?: string;
    Outfit?: string;
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
}

export type CharacterSpeech = {
    DisplayProtocol: 'SayMessage';
    Message: TaggedMessageContent[];
} & MessageAddressing & MessageCharacterInfo

export type CharacterNarration = {
    DisplayProtocol: 'NarrateMessage';
    Message: TaggedMessageContent[];
} & MessageAddressing & MessageCharacterInfo

export type OutOfCharacterMessage = {
    DisplayProtocol: 'OOCMessage';
    Message: TaggedMessageContent[];
} & MessageAddressing & MessageCharacterInfo

export type Message = SpacerMessage | WorldMessage | RoomDescription | RoomHeader | RoomUpdate | FeatureDescription | CharacterDescription | CharacterNarration | CharacterSpeech | OutOfCharacterMessage

export const isMessage = (message: any): message is Message => {
    const validateMessageList = (messages: any): boolean => {
        if (!Array.isArray(messages)) {
            return false
        }
        return checkAll(...(messages.map((message) => (isTaggedMessageContent(message)))))
    }
    if (typeof message !== 'object') {
        return false
    }
    if (!checkTypes(message, { MessageId: 'string', CreatedTime: 'number', Target: 'string' })) {
        return false
    }
    if (!isEphemeraCharacterId(message.Target)) {
        return false
    }
    switch(message.DisplayProtocol) {
        case 'WorldMessage':
            return validateMessageList(message.Message)
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            return checkAll(
                checkTypes(message, { CharacterId: 'string', Name: 'string' }),
                ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color),
                validateMessageList(message.Message)
            ) && isEphemeraCharacterId(message.CharacterId)
        case 'RoomDescription':
        case 'RoomHeader':
            return checkAll(
                checkTypes(message, { Name: 'string', RoomId: 'string' }),
                validateRoomExitList(message.Exits),
                validateRoomCharacterList(message.Characters),
                validateMessageList(message.Description)
            ) && isEphemeraRoomId(message.RoomId)
        case 'RoomUpdate':
            return checkAll(
                checkTypes(message, {}, { Name: 'string', RoomId: 'string' }),
                validateRoomExitList(message.Exits ?? []),
                validateRoomCharacterList(message.Characters ?? []),
                validateMessageList(message.Description ?? [])
            ) && isEphemeraRoomId(message.RoomId)
        case 'FeatureDescription':
            return checkAll(
                checkTypes(message, { Name: 'string', FeatureId: 'string' }),
                validateMessageList(message.Description)
            ) && isEphemeraFeatureId(message.FeatureId)
        case 'CharacterDescription':
            return checkAll(
                checkTypes(message, 
                    {
                        CharacterId: 'string',
                        Name: 'string'
                    },
                    {
                        fileUrl: 'string',
                        FirstImpression: 'string',
                        OneCoolThing: 'string',
                        Outfit: 'string'
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