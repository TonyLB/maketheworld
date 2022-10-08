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

export type RoomCharacter = {
    Name: string;
    CharacterId: string;
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

export type LegalCharacterColor = 'blue' | 'pink' | 'purple' | 'green' | 'grey'

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
