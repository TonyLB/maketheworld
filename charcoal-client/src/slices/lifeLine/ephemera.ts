type EphemeraCharacterInPlay = {
    type: 'CharacterInPlay',
    CharacterId: string;
    Connected: boolean;
    RoomId: string;
    Name: string;
}

export type EphemeraFormat = EphemeraCharacterInPlay
