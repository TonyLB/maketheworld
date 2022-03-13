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
    initialSSMDesired: 'INACTIVE',
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            Assets: [],
            Characters: []
        }
    },
    sliceSelector: ({ library }) => (library),
    publicReducers: {
        receiveLibrary
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
                next: 'INACTIVE',
                condition: lifelineCondition
            },
            INACTIVE: {
                stateType: 'CHOICE',
                choices: ['SUBSCRIBE']
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
                resolve: 'INACTIVE',
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

export const {
    setIntent
} = librarySlice.actions

export default librarySlice.reducer
