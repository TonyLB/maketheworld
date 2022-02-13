export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target: string;
}

export type SpacerMessage = {
    DisplayProtocol: 'SpacerMessage';
} & MessageAddressing

export type WorldMessage = {
    DisplayProtocol: 'WorldMessage';
    Message: string;
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

export type RoomDescribePortion = {
    tag: 'Link',
    to: string;
    text: string;
} | string;

type RoomDescribeData = {
    Description: RoomDescribePortion[];
    Name: string;
    RoomId: string;
    Exits: RoomExit[];
    Characters: RoomCharacter[];
}

export type RoomDescription = {
    DisplayProtocol: 'RoomDescription';
} & RoomDescribeData & MessageAddressing

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
    Message: string;
} & MessageAddressing & MessageCharacterInfo

export type CharacterNarration = {
    DisplayProtocol: 'NarrateMessage';
    Message: string;
} & MessageAddressing & MessageCharacterInfo

export type OutOfCharacterMessage = {
    DisplayProtocol: 'OOCMessage';
    Message: string;
} & MessageAddressing & MessageCharacterInfo

export type Message = SpacerMessage | WorldMessage | RoomDescription | RoomHeader | RoomUpdate | CharacterNarration | CharacterSpeech | OutOfCharacterMessage

export type MessageState = Record<string, Message[]>
