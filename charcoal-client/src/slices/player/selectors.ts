import { PlayerPublic } from './baseClasses'
import { Selector } from '../../store'
import { createSelector } from '@reduxjs/toolkit'
import { OnboardingKey, onboardingChapters } from '../../components/Onboarding/checkpoints'

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

export const getMySettings = (player: PlayerPublic): PlayerPublic['Settings'] => {
    const { Settings = { onboardCompleteTags: [] } } = player || {}
    return Settings
}

const guestCharacter = (guestId: string, guestName: string): PlayerPublic['Characters'][number] => ({
    CharacterId: `CHARACTER#${guestId}`,
    Name: guestName,
    Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' }
})

export const getMyCharacterByKey = (getMyCharacters: Selector<PlayerPublic['Characters']>, getMySettings: Selector<PlayerPublic['Settings']>) => (key: string | undefined): Selector<any> => (state) => {
    if (key === 'Guest') {
        const { guestId, guestName } = getMySettings(state)
        return guestCharacter(guestId, guestName)
    }
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (getMyCharacters: Selector<PlayerPublic['Characters']>, getMySettings: Selector<PlayerPublic['Settings']>) => (key: string | undefined): Selector<any> => (state) => {
    const { guestId, guestName } = getMySettings(state)
    if (key === `CHARACTER#${guestId}`) {
        return guestCharacter(guestId, guestName)
    }
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
    getMySettings: (player: PlayerPublic) => PlayerPublic['Settings'];
}
