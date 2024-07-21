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
import { SchemaImportMapping, SchemaImportTag, SchemaStringTag, SchemaTag, SchemaWithKey, isImportable, isSchemaAsset, isSchemaCharacter, isSchemaImport, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { socketDispatchPromise } from '../lifeLine'
import { v4 as uuidv4 } from 'uuid'
import { isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTreeNode } from '@tonylb/mtw-wml/dist/tree/baseClasses'

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
            standard: { key: '', tag: 'Asset', byId: {}, metaData: [] },
            inherited: { key: '', tag: 'Asset', byId: {}, metaData: [] },
            baseSchema: [],
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
                standard: { key: '', tag: 'Asset', byId: {}, metaData: [] },
                inherited: { key: '', tag: 'Asset', byId: {}, metaData: [] },
                baseSchema: [],
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
                reject: 'SAVEERROR'
            },
            SAVE: {
                stateType: 'ATTEMPT',
                action: saveWML,
                resolve: 'PARSE',
                reject: 'SAVEERROR'
            },
            PARSE: {
                stateType: 'ATTEMPT',
                action: parseWML,
                resolve: 'FRESH',
                reject: 'SAVEERROR'
            },
            SAVEERROR: {
                stateType: 'REDIRECT',
                newIntent: ['WMLDIRTY', 'FRESH'],
                choices: ['WMLDIRTY']
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

export const { addItem, setIntent, clear } = personalAssetsSlice.actions
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
    getSchema,
    getBaseSchema,
    getStandardForm,
    getInherited,
    getInheritedByAssetId,
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
        const { data, children } = importItem
        if (!isSchemaImport(data)) {
            throw new Error('Type mismatch in addImport')
        }
        if (key && type) {
            const currentImportItem = children.find(({ data }) => (isSchemaWithKey(data) && data.key === key))
            if (currentImportItem) {
                const { data: importItemData } = currentImportItem
                if (!isImportable(importItemData)) {
                    throw new Error('Type mismatch in addImport')
                }
                if (importItemData.as !== as) {
                    dispatch((options?.overrideUpdateSchema ?? updateSchema)(assetId)({
                        type: 'updateNode',
                        id: currentImportItem.id,
                        item: { data: { tag: type, key, as }, children: [], id: currentImportItem.id }
                    }))
                }
            }
            else {
                const newItem: SchemaTag = {
                    tag: type,
                    key,
                    as
                } as SchemaTag
                dispatch((options?.overrideUpdateSchema ?? updateSchema)(assetId)({
                    type: 'addChild',
                    id: importItem.id,
                    item: { data: newItem, children: [] }
                }))
            }
        }
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
            item: { data: newItem, children: key ? [{ data: { tag: type, key, as }, children: [] }] : [] }
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

export const requestLLMGeneration = ({ assetId, roomId }: { assetId: EphemeraAssetId, roomId: string }) => async (dispatch, getState) => {
    const standardSelector = getStandardForm(assetId)
    const standard = standardSelector(getState())

    const roomComponent = standard.byId[roomId]

    if (roomComponent && isStandardRoom(roomComponent)) {
        const name = schemaOutputToString(roomComponent.name?.children ?? []) || schemaOutputToString(roomComponent.shortName?.children ?? [])
        if (name) {
            dispatch(socketDispatchPromise({
                message: 'llmGenerate',
                name
            }, { service: 'asset' })).then((results) => {
                const { description, summary } = results
                if (description) {
                    const stringTag: GenericTreeNode<SchemaStringTag> = { data: { tag: 'String', value: description.trim() }, children: [] }
                    if (roomComponent.description?.id) {
                        dispatch(updateSchema(assetId)({ type: 'replaceChildren', id: roomComponent.description.id, children: [stringTag]}))
                    }
                    else {
                        dispatch(updateSchema(assetId)({ type: 'addChild', id: roomComponent.id, item: { data: { tag: 'Description' }, children: [stringTag] }}))
                    }
                }
                if (summary) {
                    const stringTag: GenericTreeNode<SchemaStringTag> = { data: { tag: 'String', value: summary.trim() }, children: [] }
                    if (roomComponent.summary?.id) {
                        dispatch(updateSchema(assetId)({ type: 'replaceChildren', id: roomComponent.summary.id, children: [stringTag]}))
                    }
                    else {
                        dispatch(updateSchema(assetId)({ type: 'addChild', id: roomComponent.id, item: { data: { tag: 'Summary' }, children: [stringTag] }}))
                    }
                }
                if (description || summary) {
                    dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY']}))
                    dispatch(heartbeat)
                }
            })
        }
    
    }

}

// type PersonalAssetsSlice = multipleSSMSlice<PersonalAssetsNodes>

export default personalAssetsSlice.reducer
