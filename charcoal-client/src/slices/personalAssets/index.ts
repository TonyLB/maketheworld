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
    receiveWMLEvent as receiveWMLEventReducer,
    saveEdit as saveEditReducer,
    UpdateStandardPayload
} from './reducers'
import { EphemeraAssetId, EphemeraCharacterId, isEphemeraAssetId, isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { addAsset, getPlayer } from '../player'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { socketDispatchPromise } from '../lifeLine'
import { isStandardRoom } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { schemaOutputToString } from '@tonylb/mtw-wml/ts/schema/utils/schemaOutput/schemaOutputToString'
import { GenericTreeNode, treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { ignoreWrapped } from '@tonylb/mtw-wml/ts/schema/utils'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { push } from '../UI/feedback'
import { excludeUndefined } from '../../lib/lists'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import Debounce from '../../lib/keyedDebounce'
import { isSchemaImport, SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import { isSchemaWithKey } from '@tonylb/mtw-base/ts/schema'
import { SchemaStringTag } from '@tonylb/mtw-base/ts/schema/renderTree'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { standardComponentByTag } from '@tonylb/mtw-wml/ts/standardize/nonEditFactory'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardRender, StandardRenderReplace } from '@tonylb/mtw-wml/ts/standardize/render'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

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
            base: { key: '', byId: {}, metaData: [] },
            pendingEdits: [],
            edit: { key: '', byId: {}, metaData: [] },
            inherited: { key: '', byId: {}, metaData: [] }
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
        setCurrentWML: setCurrentWMLReducer,
        setDraftWML: setDraftWMLReducer,
        revertDraftWML: revertDraftWMLReducer,
        setLoadedImage: setLoadedImageReducer,
        updateStandard: updateStandardReducer,
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
                base: { key: '', byId: {}, metaData: [] },
                pendingEdits: [],
                edit: { key: '', byId: {}, metaData: [] },
                inherited: { key: '', byId: {}, metaData: [] }
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
        const standardForm = new StandardForm({ ...edit, key: internalKey })
        const schema = schemaToWML([standardForm.schema])
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

export const addImport = ({ assetId, fromAsset, as, key, tag }: {
    assetId: EphemeraAssetId | EphemeraCharacterId,
    fromAsset: string,
    tag: SchemaImportMapping["type"];
    key: string;
    as?: string;
}, options?: { overrideGetStandard?: typeof getStandardForm, overrideUpdateStandard?: typeof updateStandard }) => (dispatch: any, getState: any) => {
    dispatch(publicActions.updateStandard(assetId)({
        type: 'addComponent',
        tag,
        componentKey: as ?? key,
        importItem: { from: fromAsset, key }
    }))
    dispatch(fetchImports(assetId))
    dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY', 'WMLDIRTY']}))
    dispatch(heartbeat)
}

export const requestLLMGeneration = ({ assetId, roomId }: { assetId: EphemeraAssetId, roomId: string }) => async (dispatch: any, getState: any) => {
    const standardSelector = getStandardForm(assetId)
    const standard = standardSelector(getState())

    const roomComponent = standard.byId[roomId]

    if (roomComponent && isStandardRoom(roomComponent)) {
        const name = schemaOutputToString(ignoreWrapped(roomComponent.name)?.children ?? []) || schemaOutputToString(ignoreWrapped(roomComponent.shortName)?.children ?? [])
        if (name) {
            dispatch(socketDispatchPromise({
                message: 'llmGenerate',
                name
            }, { service: 'asset' })).then((results: { description: string; summary: string; }) => {
                const { description, summary } = results
                if (description) {
                    dispatch(
                        updateStandard(assetId)({
                            type: 'update',
                            update: (draft: StandardForm) => {
                                const base = draft.byId[roomId]
                                if (base instanceof StandardRoom) {
                                    base._payload._description = new StandardRender([description.trim()])
                                }
                                return draft
                            }
                        })
                    )
                }
                if (summary) {
                    dispatch(
                        updateStandard(assetId)({
                            type: 'update',
                            update: (draft: StandardForm) => {
                                const base = draft.byId[roomId]
                                if (base instanceof StandardRoom) {
                                    base._payload._summary = new StandardRender([summary])
                                }
                                return draft
                            }
                        })
                    )
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
