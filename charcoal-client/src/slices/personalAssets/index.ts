import { PersonalAssetsNodes } from './baseClasses'
import { multipleSSM, multipleSSMSlice } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    getFetchURL,
    fetchAction,
    fetchDefaultsAction,
    saveAction,
    clearAction,
    backoffAction
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import { setCurrentWML as setCurrentWMLReducer, setDraftWML as setDraftWMLReducer } from './reducers'

export const {
    slice: personalAssetsSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = multipleSSM<PersonalAssetsNodes, PublicSelectors>({
    name: 'personalAssets',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['FRESH', 'DIRTY'],
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            defaultAppearances: {}
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
        setCurrentWML: setCurrentWMLReducer,
        setDraftWML: setDraftWMLReducer
    },
    publicSelectors,
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                defaultAppearances: {}
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
                choices: ['FETCHURL']
            },
            FETCHURL: {
                stateType: 'ATTEMPT',
                action: getFetchURL,
                resolve: 'FETCH',
                reject: 'FETCHURLBACKOFF'
            },
            FETCHURLBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'FETCHURL',
                reject: 'FETCHERROR'
            },
            FETCH: {
                stateType: 'ATTEMPT',
                action: fetchAction,
                resolve: 'FETCHDEFAULTS',
                reject: 'FETCHBACKOFF'
            },
            FETCHBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'FETCH',
                reject: 'FETCHERROR'
            },
            FETCHDEFAULTS: {
                stateType: 'ATTEMPT',
                action: fetchDefaultsAction,
                resolve: 'FRESH',
                reject: 'FETCHDEFAULTSBACKOFF'
            },
            FETCHDEFAULTSBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'FETCH',
                reject: 'FETCHERROR'
            },
            FETCHERROR: {
                stateType: 'CHOICE',
                choices: []
            },
            FRESH: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'DIRTY']
            },
            DIRTY: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'SAVE']
            },
            SAVE: {
                stateType: 'ATTEMPT',
                action: saveAction,
                resolve: 'FRESH',
                reject: 'SAVEBACKOFF'
            },
            SAVEBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'SAVE',
                reject: 'SAVEERROR'
            },
            SAVEERROR: {
                stateType: 'CHOICE',
                choices: []
            },
            CLEAR: {
                stateType: 'ATTEMPT',
                action: clearAction,
                resolve: 'INACTIVE',
                reject: 'INACTIVE'
            }
        }
    }
})

export const { addItem } = personalAssetsSlice.actions
export const {
    setCurrentWML,
    setDraftWML
} = publicActions
export const {
    getStatus,
    getCurrentWML,
    getNormalized,
    getWMLQuery,
    getDefaultAppearances
} = selectors

// type PersonalAssetsSlice = multipleSSMSlice<PersonalAssetsNodes>

export default personalAssetsSlice.reducer
