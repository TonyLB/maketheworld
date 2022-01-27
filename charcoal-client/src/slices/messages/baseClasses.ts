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

type MessageCharacterInfo = {
    CharacterId: string;
    Name: string;
    Color: string;
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
    DisplayProtocol: 'OutOfCharacterMessage';
    Message: string;
} & MessageAddressing & MessageCharacterInfo

export type Message = WorldMessage | RoomDescription | RoomHeader | CharacterNarration | CharacterSpeech | OutOfCharacterMessage

export type MessageState = Record<string, Message[]>
