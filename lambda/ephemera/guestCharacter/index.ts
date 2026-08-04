import { ephemeraDB } from "@tonylb/mtw-utilities/ts/dynamoDB";
import { coyoteGameEnabled } from '@tonylb/mtw-base/ts/coyoteGame'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import internalCache from '../internalCache'
import type { MessageBus } from '../messageBus/baseClasses'
import { sendDeleteCacheRecords } from '../dataSource/apiEphemera'
import { queryAllRenderCacheDataCategoriesForComponent } from '../dataSource/renderCache/queryAllRenderCacheDataCategoriesForComponent'
import { DEFAULT_ROOM_STACK } from '../dataSource/positions/membership/trimEvictionLadder'
import type { RoomStackItem } from '../dataSource/positions/membership/types'
import { guestCoyoteSituations } from './guestSituations'

// Recreated function from deleted cacheAsset module
const pushCharacterEphemera = async (character: {
    key: string;
    EphemeraId: string;
    Name: string;
    Color: string;
    Pronouns: string;
    assets: string[];
    RoomStack: RoomStackItem[];
    player: string;
}) => {
    const updateKeys: (keyof typeof character)[] = ['Name', 'Pronouns', 'Color', 'assets', 'RoomStack', 'player']
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

const writeGuestSituationFacet = async (characterEphemeraId: EphemeraCharacterId, name: string, messageBus: MessageBus): Promise<void> => {
    const situations = guestCoyoteSituations(name)
    const desired = new StandardCharacter({
        tag: 'Character',
        universalKey: characterEphemeraId,
        shortName: name,
        situations,
    })
    const { component: existing } = await internalCache.ImprovisationComponentData.get(characterEphemeraId, IMPROVISATION_ASSET_ID)
    if (existing.equals(desired)) {
        console.log('[mtw.ephemera.guestCharacter] guest situation facet already up to date; skipping write', { characterEphemeraId })
        return
    }
    console.log('[mtw.ephemera.guestCharacter] writing guest situation facet', { characterEphemeraId, name })

    await ephemeraDB.putItem({
        EphemeraId: characterEphemeraId,
        DataCategory: IMPROVISATION_ASSET_ID,
        tag: 'Character',
        shortName: name,
        situations,
    })
    internalCache.ImprovisationComponentData.set(characterEphemeraId, IMPROVISATION_ASSET_ID, desired)

    const dataCategories = await queryAllRenderCacheDataCategoriesForComponent(characterEphemeraId)
    if (dataCategories.length > 0) {
        sendDeleteCacheRecords(messageBus, characterEphemeraId, { componentId: characterEphemeraId, dataCategories })
    }
}

export const confirmGuestCharacter = async (userName: string, messageBus: MessageBus): Promise<void> => {
    const { guestId: characterId, guestName: name } = (await ephemeraDB.getItem<{ guestId?: string; guestName?: string }>({
        Key: {
            EphemeraId: `PLAYER#${userName}`,
            DataCategory: 'Meta::Player'
        },
        ProjectionFields: ['guestId', 'guestName']
    })) || {}
    if (!(characterId && name)) {
        console.log('[mtw.ephemera.guestCharacter] no guestId/guestName on Meta::Player; nothing to confirm', { userName, characterId, name })
        return
    }
    const characterEphemeraId = `CHARACTER#${characterId}` as EphemeraCharacterId
    const guestName = coyoteGameEnabled ? userName : name
    console.log('[mtw.ephemera.guestCharacter] confirming guest', { userName, characterEphemeraId, guestName, coyoteGameEnabled })
    await pushCharacterEphemera({
        key: characterId,
        EphemeraId: characterEphemeraId,
        Name: guestName,
        Color: 'pink',
        Pronouns: 'they/them',
        assets: [],
        RoomStack: DEFAULT_ROOM_STACK,
        player: userName
    })
    if (coyoteGameEnabled) {
        try {
            await writeGuestSituationFacet(characterEphemeraId, guestName, messageBus)
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.stack ?? error.message : String(error)
            console.error(`[mtw.ephemera.guestCharacter] writeGuestSituationFacet failed for ${characterEphemeraId}: ${errorMessage}`)
        }
    }
}
