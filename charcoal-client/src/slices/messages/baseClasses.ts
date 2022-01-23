export type MessageAddressing = {
    MessageId: string;
    CreatedTime: number;
    Target: string;
}

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

type RoomDescribeData = {
    Description: string;
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

export type CharacterSpeech = {
    DisplayProtocol: 'SayMessage';
    CharacterId: string;
    Message: string;
    Name: string;
} & MessageAddressing

export type CharacterNarration = {
    DisplayProtocol: 'NarrateMessage';
    CharacterId: string;
    Message: string;
    Name: string;
} & MessageAddressing

export type OutOfCharacterMessage = {
    DisplayProtocol: 'OutOfCharacterMessage';
    CharacterId: string;
    Message: string;
} & MessageAddressing

export type Message = WorldMessage | RoomDescription | RoomHeader | CharacterNarration | CharacterSpeech | OutOfCharacterMessage

export type MessageState = Record<string, Message[]>
