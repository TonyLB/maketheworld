import { PersonalAssetsNodes } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    getFetchURL,
    fetchAction,
    fetchDefaultsAction,
    getSaveURL,
    saveWML,
    clearAction,
    backoffAction,
    parseWML,
    regenerateWMLAction
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import { setCurrentWML as setCurrentWMLReducer, setDraftWML as setDraftWMLReducer, setLoadedImage as setLoadedImageReducer, updateSchema as updateSchemaReducer } from './reducers'

export const {
    slice: personalAssetsSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = multipleSSM<PersonalAssetsNodes, PublicSelectors>({
    name: 'personalAssets',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['FRESH', 'WMLDIRTY', 'NORMALDIRTY'],
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            importDefaults: {},
            properties: {},
            loadedImages: {},
            normal: {}
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
        setCurrentWML: setCurrentWMLReducer,
        setDraftWML: setDraftWMLReducer,
        setLoadedImage: setLoadedImageReducer,
        updateSchema: updateSchemaReducer
    },
    publicSelectors,
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {
                importDefaults: {},
                properties: {},
                loadedImages: {},
                normal: {}
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
                choices: ['CLEAR', 'WMLDIRTY', 'NORMALDIRTY', 'NEEDSAVE']
            },
            WMLDIRTY: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'NORMALDIRTY', 'NEEDSAVE']
            },
            NORMALDIRTY: {
                stateType: 'CHOICE',
                choices: ['REGENERATEWML']
            },
            REGENERATEWML: {
                stateType: 'ATTEMPT',
                action: regenerateWMLAction,
                resolve: 'WMLDIRTY',
                reject: 'WMLERROR'
            },
            WMLERROR: {
                stateType: 'CHOICE',
                choices: []
            },
            NEEDSAVE: {
                stateType: 'REDIRECT',
                newIntent: ['WMLDIRTY', 'FRESH'],
                choices: ['GETSAVEURL']
            },
            GETSAVEURL: {
                stateType: 'ATTEMPT',
                action: getSaveURL,
                resolve: 'SAVE',
                reject: 'SAVEBACKOFF'
            },
            SAVE: {
                stateType: 'ATTEMPT',
                action: saveWML,
                resolve: 'PARSE',
                reject: 'SAVEBACKOFF'
            },
            PARSE: {
                stateType: 'ATTEMPT',
                action: parseWML,
                resolve: 'FRESH',
                reject: 'SAVEBACKOFF'
            },
            SAVEBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'GETSAVEURL',
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

export const { addItem, setIntent } = personalAssetsSlice.actions
export const {
    setCurrentWML,
    setDraftWML,
    setLoadedImage,
    updateSchema
} = publicActions
export const {
    getStatus,
    getCurrentWML,
    getNormalized,
    getWMLQuery,
    getImportDefaults,
    getProperties,
    getLoadedImages
} = selectors

// type PersonalAssetsSlice = multipleSSMSlice<PersonalAssetsNodes>

export default personalAssetsSlice.reducer
