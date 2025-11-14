import { PlayerData, PlayerNodes, PlayerPublic } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    lifelineCondition,
    playerNameCondition,
    subscribeAction,
    syncAction,
    unsubscribeAction
} from './index.api'
import { receivePlayer } from './receivePlayer'
import { PromiseCache } from '../promiseCache'
import { createSelector, Selector } from '@reduxjs/toolkit'
import { OnboardingKey, OnboardingSubItem, onboardingChapters } from '../../components/Onboarding/checkpoints'
import { playerDataSourceSelectors } from './playerDataSource'
import { getPlayerName, getSessionId } from '../settings'
import { PlayerSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'

const playerPromiseCache = new PromiseCache<PlayerData>()

// Type for publicSelectors that singleSSM expects (selectors that take publicData)
// Our actual selectors read from RootState, so we wrap them in publicSelectors
type PlayerPublicSelectors = {
}

export const {
    slice: playerSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<PlayerNodes, PlayerPublicSelectors>({
    name: 'player',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['CONNECTED'],
    promiseCache: playerPromiseCache,
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            PlayerName: '',
            CodeOfConductConsent: false,
            Assets: [],
            Characters: [],
            Settings: { onboardCompleteTags: [] },
            SessionId: ''
        }
    },
    sliceSelector: ({ player }) => (player),
    publicReducers: {
        receivePlayer
    },
    publicSelectors: {},
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                PlayerName: '',
                CodeOfConductConsent: false,
                Assets: [],
                Characters: [],
                Settings: { onboardCompleteTags: [] },
                SessionId: ''
            }
        },
        states: {
            INITIAL: {
                stateType: 'HOLD',
                next: 'SUBSCRIBE',
                condition: (data: any, getState: any) => {
                    // Always check LifeLine condition
                    if (!lifelineCondition(data, getState)) {
                        return false
                    }
                    // Also check PlayerName condition
                    return playerNameCondition(data, getState)
                }
            },
            SUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: subscribeAction,
                resolve: 'SYNCHRONIZE',
                reject: 'ERROR'
            },
            SYNCHRONIZE: {
                stateType: 'ATTEMPT',
                action: syncAction,
                resolve: 'CONNECTED',
                reject: 'ERROR'
            },
            CONNECTED: {
                stateType: 'CHOICE',
                choices: ['UNSUBSCRIBE', 'SIGNOUT']
            },
            SIGNOUT: {
                stateType: 'REDIRECT',
                newIntent: ['CONNECTED'],
                choices: ['UNSUBSCRIBE']
            },
            UNSUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: unsubscribeAction,
                resolve: 'INITIAL',
                reject: 'ERROR'
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: []
            }
        }
    }
})

export const { onEnter } = publicActions
export const {
    getStatus
} = selectors
export const { setIntent } = playerSlice.actions

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
    (assets) => assets.filter((asset: any) => (asset?.zone === 'Draft'))
)

export const getMyPersonalAssets = createSelector(
    getMyAssets,
    (assets) => assets.filter((asset: any) => (asset?.zone === 'Personal'))
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

export default playerSlice.reducer
