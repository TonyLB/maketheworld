import { PlayerPublic } from './baseClasses'
import { Selector, RootState } from '../../store'
import { playerDataSourceSelectors } from './playerDataSource'
import { PlayerSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import { getSessionId as getSessionIdFromSettings, getPlayerName as getPlayerNameFromSettings } from '../settings'

const guestCharacter = (guestId: string, guestName: string): PlayerPublic['Characters'][number] => ({
    CharacterId: `CHARACTER#${guestId}`,
    Name: guestName,
    Pronouns: 'they/them'
})

export const getMyCharacterByKey = (key: string | undefined): Selector<any> => (state) => {
    if (key === 'Guest') {
        const settings = getMySettings(state)
        const { guestId, guestName } = settings
        if (!(guestId && guestName)) {
            throw new Error('Guest character requested but no guestId found in settings')
        }
        return guestCharacter(guestId, guestName)
    }
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (key: string | undefined): Selector<any> => (state) => {
    const settings = getMySettings(state)
    const { guestId, guestName } = settings
    if (key === `CHARACTER#${guestId}`) {
        if (!(guestId && guestName)) {
            throw new Error('Guest character requested but no guestId found in settings')
        }
        return guestCharacter(guestId, guestName)
    }
    const Characters = getMyCharacters(state)
    return Characters.find(({ CharacterId }) => (CharacterId === key))
}

//
// Selector types - these now read from RootState instead of PlayerPublic
//
export type PlayerSelectors = {
}
