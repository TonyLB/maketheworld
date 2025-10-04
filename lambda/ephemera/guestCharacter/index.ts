import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB";

// Recreated function from deleted cacheAsset module
const pushCharacterEphemera = async (character: {
    key: string;
    EphemeraId: string;
    Name: string;
    Color: string;
    Pronouns: string;
    assets: string[];
    RoomId: string;
    player: string;
}) => {
    const updateKeys: (keyof typeof character)[] = ['Name', 'Pronouns', 'Color', 'assets', 'RoomId', 'player']
    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: character.EphemeraId,
            DataCategory: 'Meta::Character'
        },
        updateKeys: [...updateKeys],
        updateReducer: (draft) => {
            updateKeys.forEach((key) => {
                draft[key] = character[key]
            })
        },
    })
}

export const confirmGuestCharacter = async (userName: string): Promise<void> => {
    const { guestId: characterId, guestName: name } = (await ephemeraDB.getItem<{ guestId?: string; guestName?: string }>({
        Key: {
            EphemeraId: `PLAYER#${userName}`,
            DataCategory: 'Meta::Player'
        },
        ProjectionFields: ['guestId', 'guestName']
    })) || {}
    if (!(characterId && name)) {
        return
    }
    await pushCharacterEphemera({
        key: characterId,
        EphemeraId: `CHARACTER#${characterId}`,
        Name: name,
        Color: 'pink',
        Pronouns: 'they/them',
        assets: [],
        RoomId: 'VORTEX',
        player: userName
    })
}
