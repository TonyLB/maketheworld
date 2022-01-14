import { PlayerNodes } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    lifelineCondition,
    subscribeAction,
    syncAction,
    unsubscribeAction
} from './index.api'
import {
    getPlayer as getPlayerSelector,
    getMyCharacters as getMyCharactersSelector,
    getMyCharacterById as getMyCharacterByIdSelector,
    getMyCharacterByKey as getMyCharacterByKeySelector
} from './selectors'
import { receivePlayer } from './receivePlayer'

export const {
    slice: playerSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<PlayerNodes>({
    name: 'player',
    initialSSMState: 'INITIAL',
    initialSSMDesired: 'CONNECTED',
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            PlayerName: '',
            CodeOfConductConsent: false,
            Characters: []
        }
    },
    sliceSelector: ({ player }) => (player),
    publicReducers: {
        receivePlayer
    },
    publicSelectors: {
        getPlayer: getPlayerSelector,
        getMyCharacters: getMyCharactersSelector,
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
                Characters: []                    
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

// export const { } = publicActions
export const {
    getPlayer,
    getMyCharacters
} = selectors

export const getMyCharacterById = getMyCharacterByIdSelector(getMyCharacters)
export const getMyCharacterByKey = getMyCharacterByKeySelector(getMyCharacters)

export default playerSlice.reducer
