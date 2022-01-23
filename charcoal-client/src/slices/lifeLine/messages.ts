type MessageFormatWorld = {
    DisplayProtocol: 'WorldMessage';
    Target: string;
    CreatedTime: number;
    Message: string;
}

type MessageFormatCharacter = {
    DisplayProtocol: 'Player';
    Target: string;
    CreatedTime: number;
    CharacterId: string;
    Message: string;
}

type MessageFormatDirect = {
    DisplayProtocol: 'Direct';
    Target: string;
    CreatedTime: number;
    CharacterId: string;
    Title: string;
    Message: string;
    Recipients: string[];
}

type MessageFormatAnnounce = {
    DisplayProtocol: 'Announce';
    Target: string;
    CreatedTime: number;
    Title: string;
    Message: string;
}

type MessageFormatRoomDescription = {
    DisplayProtocol: 'RoomDescription';
    Target: string;
    CreatedTime: number;
    RoomId: string;
    Name: string;
    Description: string;
    Ancestry: string
    Exits: Array<{
        Name: string;
        RoomId: string;
        Visibility: string;
    }>;
    RoomCharacters: Array<{
        CharacterId: string;
        Name: string;
        FirstImpression: string;
        Pronouns: string;
        OneCoolThing: string;
        Outfit: string;
    }>
}

export type MessageFormat = MessageFormatWorld | MessageFormatCharacter | MessageFormatDirect | MessageFormatAnnounce | MessageFormatRoomDescription
