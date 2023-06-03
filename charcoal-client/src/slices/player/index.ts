import { PlayerData, PlayerNodes } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    fetchNotifications,
    lifelineCondition,
    subscribeAction,
    syncAction,
    unsubscribeAction
} from './index.api'
import {
    getPlayer as getPlayerSelector,
    getMyCharacters as getMyCharactersSelector,
    getMyAssets as getMyAssetsSelector,
    getMyCharacterById as getMyCharacterByIdSelector,
    getMyCharacterByKey as getMyCharacterByKeySelector,
    getMySettings as getMySettingsSelector,
    PlayerSelectors
} from './selectors'
import { receivePlayer } from './receivePlayer'
import { setCurrentDraft as setCurrentDraftReducer, addAsset as addAssetReducer } from './reducers'
import { PromiseCache } from '../promiseCache'
import { createSelector } from '@reduxjs/toolkit'
import { OnboardingKey, onboardingChapters } from '../../components/Onboarding/checkpoints'

const playerPromiseCache = new PromiseCache<PlayerData>()

export const {
    slice: playerSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<PlayerNodes, PlayerSelectors>({
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
            Settings: { onboardCompleteTags: [] }
        }
    },
    sliceSelector: ({ player }) => (player),
    publicReducers: {
        receivePlayer,
        setCurrentDraft: setCurrentDraftReducer,
        addAsset: addAssetReducer
    },
    publicSelectors: {
        getPlayer: getPlayerSelector,
        getMyCharacters: getMyCharactersSelector,
        getMyAssets: getMyAssetsSelector,
        getMySettings: getMySettingsSelector
    },
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
                Settings: { onboardCompleteTags: [] }
            }
        },
        states: {
            INITIAL: {
                stateType: 'HOLD',
                next: 'SUBSCRIBE',
                condition: lifelineCondition
            },
            SUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: subscribeAction,
                resolve: 'FETCHNOTIFICATIONS',
                reject: 'ERROR'
            },
            FETCHNOTIFICATIONS: {
                stateType: 'ATTEMPT',
                action: fetchNotifications,
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

export const { setCurrentDraft, addAsset, onEnter } = publicActions
export const {
    getPlayer,
    getMyCharacters,
    getMyAssets,
    getMySettings,
    getStatus
} = selectors

export const getActiveOnboardingChapter = createSelector(
    selectors.getMySettings,
    ({ onboardCompleteTags }) => {
        const firstChapterUnfinished = !(onboardCompleteTags.includes(`endMTWNavigation`))
        const index = firstChapterUnfinished ? 0 : onboardingChapters.findIndex(({ chapterKey }) => (onboardCompleteTags.includes(`active${chapterKey}`)))
        return { index: index === -1 ? undefined : index, currentChapter: index === -1 ? undefined : onboardingChapters[index] }
    }
)

export const getOnboardingPage = createSelector(
    selectors.getMySettings,
    getActiveOnboardingChapter,
    ({ onboardCompleteTags }, { currentChapter }) => {
        if (!currentChapter) {
            return undefined
        }
        const index = currentChapter.pages.findIndex((check) => (!onboardCompleteTags.includes(check.pageKey)))
        return index > -1 ? { ...currentChapter.pages[index], index, first: index === 0, last: index === currentChapter.pages.length - 1 } : undefined
    }
)

export const getNextOnboarding = createSelector(
    selectors.getMySettings,
    getOnboardingPage,
    ({ onboardCompleteTags }, page): OnboardingKey | undefined => {
        if (!page) {
            return undefined
        }
        return page.subItems.map(({ key }) => (key)).find((check) => (!onboardCompleteTags.includes(check))) as OnboardingKey | undefined
    }
)

export const getMyCharacterById = getMyCharacterByIdSelector(getMyCharacters, getMySettings)
export const getMyCharacterByKey = getMyCharacterByKeySelector(getMyCharacters, getMySettings)

export default playerSlice.reducer
