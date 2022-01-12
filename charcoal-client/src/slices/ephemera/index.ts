import { EphemeraNodes } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    lifelineCondition,
    subscribeAction,
    syncAction,
    unsubscribeAction
} from './index.api'
import receiveEphemera from './receiveEphemera'
import { getActiveCharacterList as getActiveCharacterListSelector, getCharactersInPlay as getCharactersInPlaySelector } from './selectors'

export const {
    slice: ephemeraSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<EphemeraNodes>({
    name: 'ephemera',
    initialSSMState: 'INITIAL',
    initialSSMDesired: 'CONNECTED',
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            charactersInPlay: {}
        }
    },
    sliceSelector: ({ ephemera }) => (ephemera),
    publicReducers: {
        receiveEphemera
    },
    publicSelectors: {
        getActiveCharacterList: getActiveCharacterListSelector,
        getCharactersInPlay: getCharactersInPlaySelector
    },
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                charactersInPlay: {}
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
    getActiveCharacterList,
    getCharactersInPlay
} = selectors

export default ephemeraSlice.reducer
