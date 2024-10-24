import { v4 as uuidv4 } from 'uuid'
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
import {
    setCurrentWML as setCurrentWMLReducer,
    setDraftWML as setDraftWMLReducer,
    revertDraftWML as revertDraftWMLReducer,
    setLoadedImage as setLoadedImageReducer,
    updateStandard as updateStandardReducer,
    setImport as setImportReducer,
    receiveWMLEvent as receiveWMLEventReducer,
    saveEdit as saveEditReducer,
    UpdateStandardPayload
} from './reducers'
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { addAsset, getPlayer } from '../player'
import { SchemaImportMapping, SchemaStringTag, isSchemaImport, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { socketDispatchPromise } from '../lifeLine'
import { isStandardRoom } from '@tonylb/mtw-wml/dist/standardize/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/dist/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-wml/dist/tree/baseClasses'
import { ignoreWrapped } from '@tonylb/mtw-wml/dist/schema/utils'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/dist/subscriptions'
import { push } from '../UI/feedback'
import { excludeUndefined } from '../../lib/lists'
import { schemaToWML } from '@tonylb/mtw-wml/dist/schema'
import { Standardizer } from '@tonylb/mtw-wml/dist/standardize'
import Debounce from '../../lib/keyedDebounce'

const autoSaveDebounce = new Debounce()

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
            base: { key: '', tag: 'Asset', byId: {}, metaData: [] },
            pendingEdits: [],
            edit: { key: '', tag: 'Asset', byId: {}, metaData: [] },
            inherited: { key: '', tag: 'Asset', byId: {}, metaData: [] }
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
        setCurrentWML: setCurrentWMLReducer,
        setDraftWML: setDraftWMLReducer,
        revertDraftWML: revertDraftWMLReducer,
        setLoadedImage: setLoadedImageReducer,
        updateStandard: updateStandardReducer,
        setImport: setImportReducer,
        receiveWMLEvent: receiveWMLEventReducer,
        saveEdit: saveEditReducer
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
                base: { key: '', tag: 'Asset', byId: {}, metaData: [] },
                pendingEdits: [],
                edit: { key: '', tag: 'Asset', byId: {}, metaData: [] },
                inherited: { key: '', tag: 'Asset', byId: {}, metaData: [] }
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
    setImport,
    onEnter
} = publicActions
export const {
    getStatus,
    getCurrentWML,
    getDraftWML,
    getStandardForm,
    getInherited,
    getInheritedByAssetId,
    getProperties,
    getLoadedImages,
    getSerialized,
    getError,
    getAll,
    getPendingEdits
} = selectors

export const newAsset = (assetId: EphemeraAssetId | EphemeraCharacterId) => (dispatch: any) => {
    dispatch(addAsset(assetId))
    dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
}

export const receiveWMLEvent = (key: string) => (args: { event: SubscriptionClientMessage }) => (dispatch: any, getState: any) => {
    const pendingEdits = getPendingEdits(key)(getState())
    dispatch(publicActions.receiveWMLEvent(key)(args))
    if (args.event.detailType === 'Merge Conflict' && pendingEdits.find(({ meta }) => (meta.key !== args.event.RequestId))) {
        push('Merge conflict prevented saving your changes')
    }
}

export const updateStandard = (key: string) => (payload: UpdateStandardPayload) => async (dispatch: any, getState: any) => {
    dispatch(publicActions.updateStandard(key)(payload))
    autoSaveDebounce.set(
        key,
        () => {
            dispatch(saveEdit(key))
        },
        5000
    )
}

export const saveEdit = (key: string) => async (dispatch: any, getState: any) => {
    const state = getState()
    const edit = selectors.getEdit(key)(state)
    if (Object.values(edit.byId).filter(excludeUndefined).length && (isEphemeraAssetId(key) || isEphemeraCharacterId(key))) {
        const player = getPlayer(state).PlayerName
        const adjustedKey: EphemeraAssetId | EphemeraCharacterId = key === 'ASSET#draft' ? `ASSET#draft[${player}]` : key
        const internalKey = key === 'ASSET#draft' ? 'draft' : key.split('#').slice(1).join('#')
        const standardizer = new Standardizer()
        standardizer.loadStandardForm({ ...edit, key: internalKey })
        const schema = schemaToWML(standardizer.schema)
        const requestId = uuidv4()
        await dispatch(socketDispatchPromise({
            message: 'applyEdit',
            RequestId: requestId,
            AssetId: adjustedKey,
            tag: isEphemeraCharacterId(key) ? 'Character' : 'Asset',
            schema
        }, { service: 'asset'}))
        dispatch(publicActions.saveEdit(key)({ requestId }))
    }
}

//
// TODO: ISS4354: Refactor addImport to use updateStandard
//
export const addImport = ({ assetId, fromAsset, as, key, type }: {
    assetId: EphemeraAssetId | EphemeraCharacterId,
    fromAsset: string,
    key?: string;
    as?: string;
    type?: SchemaImportMapping["type"];
}, options?: { overrideGetStandard?: typeof getStandardForm, overrideUpdateStandard?: typeof updateStandard }) => (dispatch: any, getState: any) => {
    const standardSelector = (options?.overrideGetStandard || getStandardForm)(assetId)
    const standard = standardSelector(getState())
    const importItem = standard.metaData.find((node) => {
        if (!treeNodeTypeguard(isSchemaImport)(node)) {
            return false
        }
        return node.data.from === fromAsset
    })
    if (!importItem) {
        dispatch((options?.overrideUpdateStandard ?? publicActions.updateStandard)(assetId)({
            type: 'replaceMetaData',
            metaData: [
                ...standard.metaData,
                { data: { tag: 'Import', from: fromAsset, mapping: {} }, children: key ? [{ data: { tag: type, key, as }, children: [] }] : [] }
            ]
        }))
    }
    else {
        if (importItem.children.find((child) => (!key || (treeNodeTypeguard(isSchemaWithKey)(child) && (child.data.key === key) && (child.data.tag === type) && ((child.data.as ?? '') === (as ?? '')))))) {
            return
        }
        const newMetaData = standard.metaData.map((node) => {
            if (treeNodeTypeguard(isSchemaImport)(node) && node.data.from === fromAsset) {
                return {
                    ...node,
                    children: [
                        ...node.children.filter((child) => (!(treeNodeTypeguard(isSchemaWithKey)(child) && child.data.key === key))),
                        { data: { tag: type, key, as }, children: [] }
                    ]
                }
            }
            else {
                return node
            }
        })
        dispatch((options?.overrideUpdateStandard ?? publicActions.updateStandard)(assetId)({
            type: 'replaceMetaData',
            metaData: newMetaData
        }))
    }
    dispatch(fetchImports(assetId))
    dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY', 'WMLDIRTY']}))
    dispatch(heartbeat)
}

export const requestLLMGeneration = ({ assetId, roomId }: { assetId: EphemeraAssetId, roomId: string }) => async (dispatch, getState) => {
    const standardSelector = getStandardForm(assetId)
    const standard = standardSelector(getState())

    const roomComponent = standard.byId[roomId]

    if (roomComponent && isStandardRoom(roomComponent)) {
        const name = schemaOutputToString(ignoreWrapped(roomComponent.name)?.children ?? []) || schemaOutputToString(ignoreWrapped(roomComponent.shortName)?.children ?? [])
        if (name) {
            dispatch(socketDispatchPromise({
                message: 'llmGenerate',
                name
            }, { service: 'asset' })).then((results) => {
                const { description, summary } = results
                if (description) {
                    const stringTag: GenericTreeNode<SchemaStringTag> = { data: { tag: 'String', value: description.trim() }, children: [] }
                    dispatch(updateStandard(assetId)({ type: 'replaceItem', componentKey: roomId, itemKey: 'description', item: { data: { tag: 'Description' }, children: [stringTag] } }))
                }
                if (summary) {
                    const stringTag: GenericTreeNode<SchemaStringTag> = { data: { tag: 'String', value: summary.trim() }, children: [] }
                    dispatch(updateStandard(assetId)({ type: 'replaceItem', componentKey: roomId, itemKey: 'summary', item: { data: { tag: 'Summary' }, children: [stringTag] } }))
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
