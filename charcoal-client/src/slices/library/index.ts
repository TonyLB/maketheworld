import { Library } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    lifelineCondition,
    subscribeAction,
    syncAction,
    unsubscribeAction
} from './index.api'
import {
    getLibrary as getLibrarySelector,
    LibrarySelectors
} from './selectors'
import { receiveLibrary } from './receiveLibrary'

export const {
    slice: librarySlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<Library, LibrarySelectors>({
    name: 'library',
    initialSSMState: 'INITIAL',
    initialSSMDesired: 'INITIAL',
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            Assets: [],
            Characters: []
        }
    },
    sliceSelector: ({ player }) => (player),
    publicReducers: {
        receivePlayer: receiveLibrary
    },
    publicSelectors: {
        getLibrary: getLibrarySelector
    },
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                Assets: [],
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
    getLibrary,
} = selectors

export default librarySlice.reducer
