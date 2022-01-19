import { PlayerPublic } from './baseClasses'

export const getPlayer = (player: PlayerPublic): PlayerPublic => {
    const { PlayerName = '', CodeOfConductConsent = false, Characters = [] } = player || {}
    return {
        PlayerName,
        CodeOfConductConsent,
        Characters
    }
}

export const getMyCharacters = (player: PlayerPublic): PlayerPublic['Characters'] => {
    const { Characters = [] } = player || {}
    return Characters
}

export const getMyCharacterByKey = (getMyCharacters: (state: any) => PlayerPublic['Characters']) => (key: string | undefined) => (state: PlayerPublic): any => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (getMyCharacters: (state: any) => PlayerPublic['Characters']) => (key: string | undefined) => (state: PlayerPublic): any => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ CharacterId }) => (CharacterId === key))
}

//
// TODO: See if you can reduce the repetition of creating this type from the selectors
//
export type PlayerSelectors = {
    getPlayer: (player: PlayerPublic) => PlayerPublic;
    getMyCharacters: (player: PlayerPublic) => PlayerPublic['Characters'];
}
