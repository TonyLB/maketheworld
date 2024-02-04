import { PersonalAssetsData, PersonalAssetsNodes } from './baseClasses'
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
    fetchImports,
    fetchImportsStateAction
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import { setCurrentWML as setCurrentWMLReducer, setDraftWML as setDraftWMLReducer, revertDraftWML as revertDraftWMLReducer, setLoadedImage as setLoadedImageReducer, updateSchema as updateSchemaReducer, setImport as setImportReducer } from './reducers'
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraAssetId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { addAsset } from '../player'
import { SchemaImportMapping, SchemaImportTag, isSchemaAsset, isSchemaCharacter, isSchemaImport } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'

const personalAssetsPromiseCache = new PromiseCache<PersonalAssetsData>()

export const {
    slice: personalAssetsSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = multipleSSM<PersonalAssetsNodes, PublicSelectors>({
    name: 'personalAssets',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['FRESH', 'WMLDIRTY', 'SCHEMADIRTY'],
    promiseCache: personalAssetsPromiseCache,
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            importData: {},
            properties: {},
            loadedImages: {},
            normal: {},
            schema: []
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
        setCurrentWML: setCurrentWMLReducer,
        setDraftWML: setDraftWMLReducer,
        revertDraftWML: revertDraftWMLReducer,
        setLoadedImage: setLoadedImageReducer,
        updateSchema: updateSchemaReducer,
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
                normal: {},
                schema: []
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
                resolve: 'FETCHIMPORTS',
                reject: 'FETCHBACKOFF'
            },
            FETCHIMPORTS: {
                stateType: 'ATTEMPT',
                action: fetchImportsStateAction,
                resolve: 'FRESH',
                reject: 'FRESH'
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
                choices: ['CLEAR', 'WMLDIRTY', 'SCHEMADIRTY', 'NEEDSAVE']
            },
            WMLDIRTY: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'SCHEMADIRTY', 'NEEDPARSE', 'NEEDSAVE']
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
                resolve: 'SCHEMADIRTY',
                reject: 'WMLERROR',
            },
            SCHEMADIRTY: {
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
    updateSchema,
    setImport,
    onEnter
} = publicActions
export const {
    getStatus,
    getCurrentWML,
    getDraftWML,
    getNormalized,
    getSchema,
    getImportData,
    getProperties,
    getLoadedImages,
    getSerialized,
    getError,
    getAll
} = selectors

export const newAsset = (assetId: EphemeraAssetId | EphemeraCharacterId) => (dispatch: any) => {
    dispatch(addAsset(assetId))
    dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
}

export const addImport = ({ assetId, fromAsset, as, key, type }: {
    assetId: EphemeraAssetId | EphemeraCharacterId,
    fromAsset: string,
    key?: string;
    as?: string;
    type?: SchemaImportMapping["type"];
}, options?: { overrideGetSchema?: typeof getSchema, overrideUpdateSchema?: typeof updateSchema }) => (dispatch: any, getState: any) => {
    const schemaSelector = (options?.overrideGetSchema || getSchema)(assetId)
    const schema = schemaSelector(getState())
    const topLevelItem = schema[0]
    if (!(topLevelItem && (isSchemaAsset(topLevelItem.data) || isSchemaCharacter(topLevelItem.data)))) {
        return
    }
    const importItem = topLevelItem.children.find(({ data }) => {
        if (!isSchemaImport(data)) {
            return false
        }
        return data.from === fromAsset
    })
    if (importItem) {
        const { data } = importItem
        if (!isSchemaImport(data)) {
            throw new Error('Type mismatch in addImport')
        }
        const newItem: SchemaImportTag = {
            tag: 'Import',
            key: data.key,
            from: fromAsset,
            mapping: {
                ...Object.entries(data.mapping)
                    .map(([outerKey, { key, type }]): [string, SchemaImportMapping] | undefined => (['Room', 'Feature', 'Variable', 'Computed', 'Action', 'Map'].includes(type) ? [outerKey, { key, type: type as SchemaImportMapping["type"] }] : undefined))
                    .filter((value): value is [string, SchemaImportMapping] => (Boolean(value)))
                    .reduce<Record<string, SchemaImportMapping>>((previous, [key, value]) => ({ ...previous, [key]: value }), {}),
                [as || key]: { key, type }
            }
        }
        dispatch((options?.overrideUpdateSchema ?? updateSchema)(assetId)({
            type: 'replace',
            id: importItem.id,
            item: { data: newItem, children: [] }
        }))
    }
    else {
        const newItem: SchemaImportTag = {
            tag: 'Import',
            from: fromAsset,
            mapping: key
                ? { [as || key]: { key, type } }
                : {}
        }
        dispatch((options?.overrideUpdateSchema ?? updateSchema)(assetId)({
            type: 'addChild',
            id: schema[0].id,
            item: { data: newItem, children: [] }
        }))
}
    dispatch(fetchImports(assetId))
    dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY', 'WMLDIRTY']}))
    dispatch(heartbeat)
}

export const removeImport = ({ assetId, fromAsset }: {
    assetId: EphemeraAssetId | EphemeraCharacterId,
    fromAsset: string,
}, options?: { overrideGetSchema?: typeof getSchema, overrideUpdateSchema?: typeof updateSchema }) => (dispatch: any, getState: any) => {
    const schemaSelector = (options?.overrideGetSchema || getSchema)(assetId)
    const schema = schemaSelector(getState())
    const topLevelItem = schema[0].data
    if (!(topLevelItem && (isSchemaAsset(topLevelItem) || isSchemaCharacter(topLevelItem)))) {
        return
    }
    const importItem = schema[0].children
        .find(({ data }) => (isSchemaImport(data) && data.from === fromAsset))
    if (importItem) {
        dispatch((options?.overrideUpdateSchema ?? updateSchema)(assetId)({
            type: 'delete',
            id: importItem.id
        }))
    }
    if (isEphemeraAssetId(assetId)) {
        dispatch(fetchImports(assetId))
    }
}

//
// assignAssetToCharacterId action loads characterId asset if necessary, and when it has
// been loaded adds the asset as an import
//
export const assignAssetToCharacterId = ({ assetId, characterId }: { assetId: EphemeraAssetId, characterId: EphemeraCharacterId }) => async (dispatch) => {
    const activeStates: (keyof PersonalAssetsNodes)[] = ['WMLDIRTY', 'FRESH', 'SCHEMADIRTY']
    dispatch(addItem({ key: characterId }))
    dispatch(onEnter(characterId)(activeStates)).then(() => {
        dispatch(addImport({ assetId: characterId, fromAsset: assetId.split('#')[1] }))
        dispatch(setIntent({ key: characterId, intent: ['SCHEMADIRTY']}))
        dispatch(onEnter(characterId)(['SCHEMADIRTY'])).then(() => {
            dispatch(setIntent({ key: characterId, intent: ['NEEDSAVE'] }))
            dispatch(heartbeat)
        })
        dispatch(heartbeat)
    })
    dispatch(heartbeat)
}

// type PersonalAssetsSlice = multipleSSMSlice<PersonalAssetsNodes>

export default personalAssetsSlice.reducer
