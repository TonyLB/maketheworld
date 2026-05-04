import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { LibraryAsset } from '@tonylb/mtw-interfaces/ts/library'
import { PlayerSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types'
import { createSelector, Selector } from '@reduxjs/toolkit'

import { PlayerPublic } from './baseClasses'
import { OnboardingKey, OnboardingSubItem, onboardingChapters } from '../../components/Onboarding/checkpoints'
import { playerDataSourceSelectors } from './playerDataSource'
import { getPlayerName, getSessionId } from '../settings'

/** Draft assets from the player snapshot are always ASSET# (not CHARACTER#). */
export type DraftAsset = Omit<LibraryAsset, 'AssetId'> & { AssetId: AssetUUID }

// Helper to get the materialized view from playerDataSource
const getPlayerSnapshot = (state: any): PlayerSnapshot | null => {
    if (!state) {
        return null
    }
    
    // getSubscribedStreams is wrapped by singleSSM to extract publicData automatically
    // It expects root state and will call sliceSelector(state).publicData internally
    const subscribedStreams = playerDataSourceSelectors.getSubscribedStreams(state)
    if (!subscribedStreams) {
        return null
    }
    
    // Get the actual player name from settings (what we subscribed with)
    const playerName = getPlayerName(state)
    if (!playerName) {
        return null
    }
    
    // Look up the stream using the actual player name
    const stream = subscribedStreams[playerName]
    if (!stream?.materializedView) {
        return null
    }
    
    return stream.materializedView
}

export const getMySettings = createSelector(
    getPlayerSnapshot,
    (snapshot) => snapshot?.settings || { onboardCompleteTags: [] }
)

export const getPlayer = createSelector(
    getPlayerSnapshot,
    getSessionId,
    getPlayerName,
    (snapshot, sessionId, playerName) => {
        return {
            PlayerName: playerName,
            CodeOfConductConsent: true,
            Assets: snapshot?.assets || [],
            Characters: snapshot?.characters || [],
            Settings: snapshot?.settings || { onboardCompleteTags: [] },
            SessionId: sessionId
        }
    }
)

export const getMyCharacters = createSelector(
    getPlayerSnapshot,
    (snapshot) => snapshot?.characters || []
)

export const getMyAssets = createSelector(
    getPlayerSnapshot,
    (snapshot) => snapshot?.assets || []
)

export const getMyDraftAssets = createSelector(
    getMyAssets,
    (assets): DraftAsset[] => assets.filter((asset: LibraryAsset) => asset?.zone === 'Draft') as DraftAsset[]
)

export const getMyPersonalAssets = createSelector(
    getMyAssets,
    (assets) => assets.filter((asset: any) => (asset?.zone === 'Personal'))
)

// Get asset zone by AssetId (e.g., 'ASSET#uuid' or just 'uuid')
export const getAssetZone = (assetId: string): Selector<any> => createSelector(
    getMyAssets,
    (assets) => {
        // Normalize assetId - handle both 'ASSET#uuid' and 'uuid' formats
        const normalizedId = AssetKey(assetId)
        const asset = assets.find((a: any) => AssetKey(a.AssetId) === normalizedId)
        return asset?.zone
    }
)

export const getActiveOnboardingChapter = createSelector(
    getMySettings,
    ({ onboardCompleteTags }) => {
        const firstChapterUnfinished = !(onboardCompleteTags.includes(`endMTWNavigation`))
        const index = firstChapterUnfinished ? 0 : onboardingChapters.findIndex(({ chapterKey }) => (onboardCompleteTags.includes(`active${chapterKey}`)))
        return { index: index === -1 ? undefined : index, currentChapter: index === -1 ? undefined : onboardingChapters[index] }
    }
)

export const getOnboardingPage = createSelector(
    getMySettings,
    getActiveOnboardingChapter,
    ({ onboardCompleteTags }, { currentChapter }) => {
        if (!currentChapter) {
            return undefined
        }
        const index = currentChapter.pages.findIndex((check) => (!onboardCompleteTags.includes(check.pageKey)))
        return index > -1 ? { ...currentChapter.pages[index], index, first: index === 0, last: index === currentChapter.pages.length - 1 } : undefined
    }
)

export const getNextOnboardingEntry = createSelector(
    getMySettings,
    getOnboardingPage,
    ({ onboardCompleteTags }, page): OnboardingSubItem | undefined => {
        if (!page) {
            return undefined
        }
        return page.subItems.find(({ key }) => (!onboardCompleteTags.includes(key)))
    }
)

export const getNextOnboarding = createSelector(
    getNextOnboardingEntry,
    getOnboardingPage,
    (entry): OnboardingKey | undefined => (entry?.key)
)

const guestCharacter = (guestId: string, guestName: string): PlayerPublic['Characters'][number] => ({
    CharacterId: `CHARACTER#${guestId}`,
    DisplayName: guestName,
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
