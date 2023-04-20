import { PlayerPublic } from './baseClasses'
import { Selector } from '../../store'

export const getPlayer = (player: PlayerPublic): PlayerPublic => {
    const { PlayerName = '', CodeOfConductConsent = false, Assets = [], Characters = [], Settings = { onboardCompleteTags: [] }, currentDraft } = player || {}
    return {
        PlayerName,
        CodeOfConductConsent,
        Assets,
        Characters,
        Settings,
        currentDraft
    }
}

export const getMyCharacters = (player: PlayerPublic): PlayerPublic['Characters'] => {
    const { Characters = [] } = player || {}
    return Characters
}

export const getMyAssets = (player: PlayerPublic): PlayerPublic['Assets'] => {
    const { Assets = [] } = player || {}
    return Assets
}

export const getMyCharacterByKey = (getMyCharacters: Selector<PlayerPublic['Characters']>) => (key: string | undefined): Selector<any> => (state) => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (getMyCharacters: Selector<PlayerPublic['Characters']>) => (key: string | undefined): Selector<any> => (state) => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ CharacterId }) => (CharacterId === key))
}

//
// TODO: See if you can reduce the repetition of creating this type from the selectors
//
export type PlayerSelectors = {
    getPlayer: (player: PlayerPublic) => PlayerPublic;
    getMyCharacters: (player: PlayerPublic) => PlayerPublic['Characters'];
    getMyAssets: (player: PlayerPublic) => PlayerPublic['Assets'];
}
