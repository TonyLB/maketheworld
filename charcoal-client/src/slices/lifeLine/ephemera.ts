type EphemeraCharacterInPlay = {
    type: 'CharacterInPlay',
    CharacterId: string;
    Connected: boolean;
    RoomId: string;
    Name: string;
}

type ActiveCharacterMapExit = {
    name?: string;
    to: string;
    toEphemeraId: string;
    key: string;
}

export type ActiveCharacterMapRoom = {
    roomId: string;
    exits?: ActiveCharacterMapExit[];
    name?: string;
    x?: number;
    y?: number;
}

export type EphemeraMapUpdate = {
    type: 'MapUpdate';
    targets: { characterId: string }[];
    MapId: string;
    Name: string;
    fileURL: string;
    rooms: ActiveCharacterMapRoom[];
}

export type EphemeraFormat = EphemeraCharacterInPlay | EphemeraMapUpdate

export const isEphemeraMapUpdate = (message: EphemeraFormat): message is EphemeraMapUpdate => (message.type === 'MapUpdate')
