import { PlayerPublic } from './baseClasses'
import { Selector } from '../../store'
import { createSelector } from '@reduxjs/toolkit'
import { onboardingChapters } from '../../components/Onboarding/checkpoints'

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

export const getMyCharacterByKey = (getMyCharacters: Selector<PlayerPublic['Characters']>) => (key: string | undefined): Selector<any> => (state) => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ scopedId }) => (scopedId === key))
}

export const getMyCharacterById = (getMyCharacters: Selector<PlayerPublic['Characters']>) => (key: string | undefined): Selector<any> => (state) => {
    const Characters = getMyCharacters(state)
    return Characters.find(({ CharacterId }) => (CharacterId === key))
}

export const getActiveOnboardingChapter = createSelector(
    getMySettings,
    ({ onboardCompleteTags }) => {
        const firstChapterUnfinished = !(onboardCompleteTags.includes(`endMTWNavigate`))
        const index = firstChapterUnfinished ? 0 : onboardingChapters.findIndex(({ chapterKey }) => (onboardCompleteTags.includes(`active${chapterKey}`)))
        return { index, currentChapter: typeof index === 'undefined' ? undefined : onboardingChapters[index] }            
    }
)

export const getOnboardingPage = createSelector(
    getMySettings,
    getActiveOnboardingChapter,
    ({ onboardCompleteTags }, { currentChapter }) => {
        if (!currentChapter) {
            return undefined
        }
        return currentChapter.pages.find((check) => (!onboardCompleteTags.includes(check.pageKey)))
    }
)

//
// TODO: See if you can reduce the repetition of creating this type from the selectors
//
export type PlayerSelectors = {
    getPlayer: (player: PlayerPublic) => PlayerPublic;
    getMyCharacters: (player: PlayerPublic) => PlayerPublic['Characters'];
    getMyAssets: (player: PlayerPublic) => PlayerPublic['Assets'];
    getMySettings: (player: PlayerPublic) => PlayerPublic['Settings'];
    getActiveOnboardingChapter: (player: PlayerPublic) => { index?: number; currentChapter?: typeof onboardingChapters[number] }
    getOnboardingPage: (player: PlayerPublic) => typeof onboardingChapters[number]["pages"][number]
}
