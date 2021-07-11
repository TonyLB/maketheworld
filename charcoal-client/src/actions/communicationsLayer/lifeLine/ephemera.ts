//
// TODO:  Once ephemera updates are migrated completely from graphQL
// to WebSocket, rewrite their data format so that it doesn't bend
// over backwards dealing with graphQL's limitations.
//

type CharacterInPlayUpdate = {
    CharacterId: string;
    Connected: boolean;
    RoomId: string;
}

export type EphemeraFormat = {
    CharacterInPlay?: CharacterInPlayUpdate;
}
