import { LegalCharacterColor } from "./baseClasses";

export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target: string;
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

const checkAll = (...items: boolean[]): boolean => (
    items.reduce<boolean>((previous, item) => (previous && item), true)
)

const checkRequiredTypes = (item: any, typeList: Record<string, string>): boolean => {
    if (typeof item !== 'object') {
        return false
    }
    return Object.entries(typeList).reduce<boolean>((previous, [key, typeString]) => (
        previous && (key in item && typeof(item[key]) === typeString)
    ), true)
}

export const isTaggedMessageContent = (message: any): message is TaggedMessageContent => {
    if (typeof message !== 'object') {
        return false
    }
    switch(message.tag) {
        case 'String':
            return checkRequiredTypes(message, { value: 'string' })
        case 'LineBreak':
            return true
        case 'Link':
            return checkRequiredTypes(message, { text: 'string', to: 'string' })
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
            && checkRequiredTypes(roomItem, { Name: 'string', RoomId: 'string' })
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
            && checkRequiredTypes(roomItem, { Name: 'string', CharacterId: 'string' })
    ), true)
}

export type RoomDescribeData = {
    Description: TaggedMessageContent[];
    Name: string;
    RoomId: string;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
}

export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

export type FeatureDescribeData = {
    Description: TaggedMessageContent[];
    Name: string;
    FeatureId: string;
}

export type FeatureDescription = {
    DisplayProtocol: 'FeatureDescription';
} & FeatureDescribeData & MessageAddressing

export type MapDescribeRoom = {
    roomId: string;
    name: string;
    x: number;
    y: number;
    exits: {
        name: string;
        to: string;
    }[];
}

export type MapDescribeData = {
    MapId: string;
    Name: string;
    fileURL?: string;
    rooms: MapDescribeRoom[];
}

const validateMapRoomList = (items: any) => {
    if (!Array.isArray(items)) {
        return false
    }
    return items.reduce<boolean>((previous, roomItem) => {
        if (!previous && checkRequiredTypes(roomItem, { roomId: 'string', name: 'string', x: 'number', y: 'number' })) {
            return false
        }
        const exits = roomItem.exits
        if (!Array.isArray(exits)) {
            return false
        }
        return exits.reduce<boolean>((previous, exit) => (
            previous && checkRequiredTypes(exit, { name: 'string', to: 'string' })
        ), true)
    }, true)
}

export const isMapDescribeData = (message: any): message is MapDescribeData => {
    return checkAll(
        checkRequiredTypes(message, { MapId: 'string', Name: 'string' }),
        !(message.fileURL && typeof message.fileURL !== 'string'),
        validateMapRoomList(message.rooms)
    )
}

type CharacterDescribeData = {
    CharacterId: string;
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
    CharacterId: string;
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
    console.log(`Validating: ${JSON.stringify(message, null, 4)}`)
    const validateMessageList = (messages: any): boolean => {
        console.log(`Messages: ${JSON.stringify(messages, null, 4)}`)
        if (!Array.isArray(messages)) {
            return false
        }
        return checkAll(...(messages.map((message) => (isTaggedMessageContent(message)))))
    }
    if (typeof message !== 'object') {
        return false
    }
    if (!checkRequiredTypes(message, { MessageId: 'string', CreatedTime: 'number', Target: 'string' })) {
        return false
    }
    switch(message.DisplayProtocol) {
        case 'WorldMessage':
            return validateMessageList(message.Message)
        case 'SayMessage':
        case 'NarrateMessage':
        case 'OOCMessage':
            return checkAll(
                'CharacterId' in message && typeof message.CharacterId === 'string',
                'Name' in message && typeof message.Name === 'string',
                ['blue', 'pink', 'purple', 'green', 'grey'].includes(message.Color),
                validateMessageList(message.Message)
            )
        case 'RoomDescription':
        case 'RoomHeader':
            return checkAll(
                'Name' in message && typeof message.Name === 'string',
                'RoomId' in message && typeof message.RoomId === 'string',
                validateRoomExitList(message.Exits),
                validateRoomCharacterList(message.Characters),
                validateMessageList(message.Description)
            )
        case 'RoomUpdate':
            return checkAll(
                !('Name' in message) || typeof message.Name === 'string',
                !('RoomId' in message) || typeof message.RoomId === 'string',
                validateRoomExitList(message.Exits ?? []),
                validateRoomCharacterList(message.Characters ?? []),
                validateMessageList(message.Description ?? [])
            )
        case 'FeatureDescription':
            return checkAll(
                'Name' in message && typeof message.Name === 'string',
                'FeatureId' in message && typeof message.FeatureId === 'string',
                validateMessageList(message.Description)
            )
        case 'CharacterDescription':
            return checkAll(
                checkRequiredTypes(message, {
                    CharacterId: 'string',
                    Name: 'string'
                }),
                !message.fileURL || typeof message.fileURL === 'string',
                !message.FirstImpression || typeof message.FirstImpression === 'string',
                !message.OneCoolThing || typeof message.OneCoolThing === 'string',
                !message.Outfit || typeof message.Outfit === 'string',
                !message.Pronouns || checkRequiredTypes(message.Pronouns, {
                    subject: 'string',
                    object: 'string',
                    possessive: 'string',
                    adjective: 'string',
                    reflexive: 'string'
                })
            )
        default: return false
    }
}