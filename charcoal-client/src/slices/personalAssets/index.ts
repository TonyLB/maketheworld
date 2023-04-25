import { PersonalAssetsNodes } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    getFetchURL,
    fetchAction,
    getSaveURL,
    saveWML,
    clearAction,
    backoffAction,
    parseWML,
    locallyParseWMLAction,
    regenerateWMLAction,
    initializeNewAction,
    fetchImports
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import { setCurrentWML as setCurrentWMLReducer, setDraftWML as setDraftWMLReducer, revertDraftWML as revertDraftWMLReducer, setLoadedImage as setLoadedImageReducer, updateNormal as updateNormalReducer, setImport as setImportReducer } from './reducers'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { addAsset } from '../player'
import { isNormalAsset, isNormalCharacter, isNormalImport } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { SchemaImportMapping, SchemaImportTag } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import Normalizer from '@tonylb/mtw-wml/dist/normalize'

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
                resolve: 'FRESH',
                reject: 'FETCHBACKOFF'
            },
            FETCHBACKOFF: {
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
    getImportData,
    getProperties,
    getLoadedImages,
    getSerialized,
    getError
} = selectors

export const newAsset = (assetId: EphemeraAssetId | EphemeraCharacterId) => (dispatch: any) => {
    dispatch(addAsset(assetId))
    dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
}

export const addImport = ({ assetId, fromAsset, as, key, type }: {
    assetId: EphemeraAssetId | EphemeraCharacterId,
    fromAsset: string,
    key: string;
    as?: string;
    type: SchemaImportMapping["type"];
}, options?: { overrideGetNormalized?: typeof getNormalized, overrideUpdateNormal?: typeof updateNormal }) => (dispatch: any, getState: any) => {
    const normalSelector = (options?.overrideGetNormalized || getNormalized)(assetId)
    const normal = normalSelector(getState())
    const normalizer = new Normalizer()
    normalizer.loadNormal(normal)
    const topLevelItem = normal[assetId.split('#')[1]]
    if (!(topLevelItem && (isNormalAsset(topLevelItem) || isNormalCharacter(topLevelItem)))) {
        return
    }
    const importIndex = topLevelItem.appearances[0].contents.findIndex(({ key, tag }) => {
        if (tag !== 'Import') {
            return false
        }
        const importItem = normal[key]
        if (!isNormalImport(importItem)) {
            return false
        }
        return importItem.from === fromAsset
    })
    if (importIndex !== -1) {
        const importRef = topLevelItem.appearances[0].contents[importIndex]
        const importItem = normal[importRef.key]
        if (!isNormalImport(importItem)) {
            throw new Error('addImport error')
        }
        const newItem: SchemaImportTag = {
            tag: 'Import',
            key: importItem.key,
            from: fromAsset,
            mapping: {
                ...Object.entries(importItem.mapping)
                    .map(([outerKey, { key, type }]): [string, SchemaImportMapping] | undefined => (['Room', 'Feature', 'Variable', 'Computed', 'Action', 'Map'].includes(type) ? [outerKey, { key, type: type as SchemaImportMapping["type"] }] : undefined))
                    .filter((value): value is [string, SchemaImportMapping] => (Boolean(value)))
                    .reduce<Record<string, SchemaImportMapping>>((previous, [key, value]) => ({ ...previous, [key]: value }), {}),
                [as || key]: { key, type }
            }
        }
        const position = { ...normalizer._referenceToInsertPosition(importRef), replace: true }
        dispatch((options?.overrideUpdateNormal ?? updateNormal)(assetId)({
            type: 'put',
            item: newItem,
            position
        }))
    }
    else {
        let nextSyntheticKey = 0
        while(`Import-${nextSyntheticKey}` in normal) {
            nextSyntheticKey++
        }
        const newItem: SchemaImportTag = {
            tag: 'Import',
            key: `Import-${nextSyntheticKey}`,
            from: fromAsset,
            mapping: {
                [as || key]: { key, type }
            }
        }
        dispatch((options?.overrideUpdateNormal ?? updateNormal)(assetId)({
            type: 'put',
            item: newItem,
            position: { contextStack: [{ key: assetId.split('#')[1], tag: 'Asset', index: 0 }] }
        }))
    }
    dispatch(fetchImports(assetId))
}

// type PersonalAssetsSlice = multipleSSMSlice<PersonalAssetsNodes>

export default personalAssetsSlice.reducer
