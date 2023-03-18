import { PersonalAssetsNodes } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    getFetchURL,
    fetchAction,
    fetchImportsAPIAction,
    getSaveURL,
    saveWML,
    clearAction,
    backoffAction,
    parseWML,
    locallyParseWMLAction,
    regenerateWMLAction,
    initializeNewAction
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import { setCurrentWML as setCurrentWMLReducer, setDraftWML as setDraftWMLReducer, revertDraftWML as revertDraftWMLReducer, setLoadedImage as setLoadedImageReducer, updateNormal as updateNormalReducer, setImport as setImportReducer } from './reducers'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { addAsset } from '../player'
import { isNormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { SchemaImportTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'

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
            importData: {},
            properties: {},
            loadedImages: {},
            normal: {}
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
        setCurrentWML: setCurrentWMLReducer,
        setDraftWML: setDraftWMLReducer,
        revertDraftWML: revertDraftWMLReducer,
        setLoadedImage: setLoadedImageReducer,
        updateNormal: updateNormalReducer,
        setImport: setImportReducer,
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
                importData: {},
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
                action: fetchImportsAPIAction,
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
                choices: ['CLEAR', 'NORMALDIRTY', 'NEEDPARSE', 'NEEDSAVE']
            },
            NEEDPARSE: {
                stateType: 'REDIRECT',
                newIntent: ['WMLDIRTY'],
                choices: ['PARSEDRAFT']
            },
            PARSEDRAFT: {
                stateType: 'ATTEMPT',
                action: locallyParseWMLAction,
                resolve: 'WMLDIRTY',
                reject: 'NEEDERROR'
            },
            NEEDERROR: {
                stateType: 'REDIRECT',
                newIntent: ['DRAFTERROR'],
                choices: ['DRAFTERROR']
            },
            DRAFTERROR: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'NEEDPARSE']
            },
            NEW: {
                stateType: 'ATTEMPT',
                action: initializeNewAction,
                resolve: 'NORMALDIRTY',
                reject: 'WMLERROR',
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
    revertDraftWML,
    setLoadedImage,
    updateNormal,
    setImport
} = publicActions
export const {
    getStatus,
    getCurrentWML,
    getDraftWML,
    getNormalized,
    getImportDefaults,
    getProperties,
    getLoadedImages,
    getError
} = selectors

export const newAsset = (assetId: EphemeraAssetId | EphemeraCharacterId) => (dispatch: any) => {
    dispatch(addAsset(assetId))
    dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
}

export const addImport = ({ assetId, fromAsset }: { assetId: EphemeraAssetId | EphemeraCharacterId, fromAsset: string }) => (dispatch: any, getState: any) => {
    const normal = getNormalized(assetId)(getState())
    const importItem = Object.values(normal)
        .filter(isNormalImport)
        .find(({ from: fromMatch }) => (fromMatch === fromAsset))
    //
    // TODO: Add arguments for the import item to be added within the import wrapper
    //
    if (importItem) {

    }
    else {
        let nextSyntheticKey = 0
        while(`Import-${nextSyntheticKey}` in normal) {
            nextSyntheticKey++
        }
        const importItem: SchemaImportTag = {
            tag: 'Import',
            key: `Import-${nextSyntheticKey}`,
            from: fromAsset,
            mapping: {}
        }
        dispatch(updateNormal(assetId)({
            type: 'put',
            item: importItem,
            position: { contextStack: [{ key: assetId.split('#')[1], tag: 'Asset', index: 0 }] }
        }))
    }
}

// type PersonalAssetsSlice = multipleSSMSlice<PersonalAssetsNodes>

export default personalAssetsSlice.reducer
