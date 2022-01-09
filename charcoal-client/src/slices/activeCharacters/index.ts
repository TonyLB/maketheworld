import { ActiveCharacterNodes } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    fetchAction,
    registerAction,
    syncAction,
    backoffAction
} from './index.api'

export const {
    slice: activeCharactersSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = multipleSSM<ActiveCharacterNodes>({
    name: 'activeCharacters',
    initialSSMState: 'INITIAL',
    initialSSMDesired: 'CONNECTED',
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            defaultValue: {},
            value: {}
        }
    },
    sliceSelector: ({ activeCharacters }) => (activeCharacters),
    publicReducers: {
    },
    publicSelectors: {
    },
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                defaultValue: {},
                value: {}
            }
        },
        states: {
            INITIAL: {
                stateType: 'HOLD',
                next: 'FETCHFROMCACHE',
                condition: lifelineCondition
            },
            FETCHFROMCACHE: {
                stateType: 'ATTEMPT',
                action: fetchAction,
                resolve: 'REGISTER',
                reject: 'ERROR'
            },
            REGISTER: {
                stateType: 'ATTEMPT',
                action: registerAction,
                resolve: 'SYNCHRONIZE',
                reject: 'ERROR'
            },
            SYNCHRONIZE: {
                stateType: 'ATTEMPT',
                action: syncAction,
                resolve: 'CONNECTED',
                reject: 'SYNCHRONIZEBACKOFF'
            },
            SYNCHRONIZEBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'SYNCHRONIZE',
                reject: 'ERROR'
            },
            CONNECTED: {
                stateType: 'CHOICE',
                choices: ['INITIAL']
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: []
            }
        }
    }
})

export const { addItem } = activeCharactersSlice.actions
// export const { } = publicActions
// export const {
// } = selectors

export default activeCharactersSlice.reducer
