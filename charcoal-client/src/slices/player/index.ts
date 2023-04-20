import { PlayerAction, PlayerNodes } from './baseClasses'
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
    PlayerSelectors
} from './selectors'
import { receivePlayer } from './receivePlayer'
import { setCurrentDraft as setCurrentDraftReducer, addAsset as addAssetReducer } from './reducers'

export const {
    slice: playerSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<PlayerNodes, PlayerSelectors>({
    name: 'player',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['CONNECTED'],
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
        getMyAssets: getMyAssetsSelector
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

export const { setCurrentDraft, addAsset } = publicActions
export const {
    getPlayer,
    getMyCharacters,
    getMyAssets
} = selectors

export const getMyCharacterById = getMyCharacterByIdSelector(getMyCharacters)
export const getMyCharacterByKey = getMyCharacterByKeySelector(getMyCharacters)

export default playerSlice.reducer
