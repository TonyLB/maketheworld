import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import { pushCharacterEphemera } from "../cacheAsset";

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
        OneCoolThing: 'Enthusiastic Curiosity',
        FirstImpression: 'Friendly Tourist',
        Color: 'pink',
        Pronouns: {
            subject: 'they',
            object: 'them',
            possessive: 'their',
            adjective: 'theirs',
            reflexive: 'themself'
        },
        assets: [],
        RoomId: 'VORTEX',
        player: userName
    })
}
