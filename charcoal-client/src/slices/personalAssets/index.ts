import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsData, PersonalAssetsNodes } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    wmlDataSourceReadyCondition,
    subscribeAction,
    clearAction,
    backoffAction,
    initializeNewAction,
    fetchImports,
    fetchImportsStateAction
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import {
    setLoadedImage as setLoadedImageReducer,
    updateStandard as updateStandardReducer,
    clearPendingEditsByRequestIds as clearPendingEditsByRequestIdsReducer,
    clearLastUpdateDiff as clearLastUpdateDiffReducer,
    saveEdit as saveEditReducer,
    UpdateStandardPayload
} from './reducers'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { socketDispatchPromise } from '../lifeLine'
import { isStandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import type { WMLStreamingEventHeader, WMLContentEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { push } from '../UI/feedback'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import Debounce from '../../lib/keyedDebounce'
import { isSchemaImport } from '@tonylb/mtw-base/ts/schema/metaData'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { deepEqual } from '../../lib/objects'
import { AssetUUID, ComponentUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import type { ScopedInstrumentationOptions } from '../../testing/scopedInstrumentation'
import { getWMLBase } from '../wmlDataSource/selectors'
import { createSelector } from '@reduxjs/toolkit'
import { derivePerspectiveForRoom } from '../../lib/perspectiveFromOrigins'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import {
    assureDefaultSituationFromPrimitives,
    DEFAULT_SITUATION_ID
} from './assureDefaultSituationFromPrimitives'
import {
    SituationRoomFacetPayload,
    SituationRoomFacetList,
    StandardSituationRoomFacet
} from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

const autoSaveDebounce = new Debounce()

const EMPTY_BASE: StandardFormData = { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }

const personalAssetsPromiseCache = new PromiseCache<PersonalAssetsData>()

/**
 * Descriptor for a reference list and how to replace it.
 * Used for add (e.g. import, reference existing) and remove; parent in SchemaOrganization
 * is inferred from reference list membership (implicit parent).
 */
export interface ReferenceListDescriptor {
    referenceList: ReferenceList
    setReferenceList: (list: ReferenceList) => void
}

/** Returns the top-level reference list descriptor (_topLevel). */
export function getTopLevelAddToReferenceList(draft: StandardForm): ReferenceListDescriptor {
    return {
        referenceList: draft._topLevel ?? new ReferenceList([]),
        setReferenceList: (list: ReferenceList) => {
            draft._topLevel = list
        }
    }
}

export const {
    slice: personalAssetsSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = multipleSSM<PersonalAssetsNodes, PublicSelectors>({
    name: 'personalAssets',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['FRESH', 'SCHEMADIRTY'],
    promiseCache: personalAssetsPromiseCache,
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {
            importData: {},
            properties: {},
            loadedImages: {},
            pendingEdits: [],
            edit: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
            inherited: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
            instrumentationOptionsForCurrentEdit: undefined,
            lastUpdateDiff: undefined
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    augmentPublicDataForSelect: (state, key, publicData) => ({ ...publicData, base: getWMLBase(state, key) ?? EMPTY_BASE }),
    publicReducers: {
        setLoadedImage: setLoadedImageReducer,
        updateStandard: updateStandardReducer,
        clearPendingEditsByRequestIds: clearPendingEditsByRequestIdsReducer,
        clearLastUpdateDiff: clearLastUpdateDiffReducer,
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
                pendingEdits: [],
                edit: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
                inherited: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
                lastUpdateDiff: undefined
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
                choices: ['WAIT_WML_READY']
            },
            WAIT_WML_READY: {
                stateType: 'HOLD',
                next: 'SUBSCRIBE',
                condition: wmlDataSourceReadyCondition
            },
            SUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: subscribeAction,
                resolve: 'SUBSCRIBED',
                reject: 'SUBSCRIBEBACKOFF'
            },
            SUBSCRIBEBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'SUBSCRIBE',
                reject: 'FETCHERROR'
            },
            SUBSCRIBED: {
                stateType: 'HOLD',
                next: 'FETCHIMPORTS',
                condition: ({ internalData: { id } }, getState) => !!(id && getWMLBase(getState(), id))
            },
            FETCHIMPORTS: {
                stateType: 'ATTEMPT',
                action: fetchImportsStateAction,
                resolve: 'FRESH',
                reject: 'FRESH'
            },
            FETCHERROR: {
                stateType: 'CHOICE',
                choices: []
            },
            FRESH: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'SCHEMADIRTY']
            },
            NEW: {
                stateType: 'ATTEMPT',
                action: initializeNewAction,
                resolve: 'SCHEMADIRTY',
                reject: 'WMLERROR',
            },
            SCHEMADIRTY: {
                stateType: 'HOLD',
                next: 'FRESH',
                condition: () => true
            },
            WMLERROR: {
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

export const { addItem, setIntent, clear } = personalAssetsSlice.actions
export const {
    setLoadedImage,
    onEnter
} = publicActions
export const {
    getStatus,
    getBase,
    getEdit,
    getLocalStandardForm,
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

/**
 * Selector that derives room-scoped Perspective for (assetId, roomId) from standardForm
 * (no perspective stored in Redux). Memoization is handled by createSelector.
 * Use with useSelector: useSelector(state => getPerspective(state, assetId, roomId))
 */
export const getPerspective = createSelector(
    [
        (state: any, assetId: string) => selectors.getStandardForm(assetId)(state),
        (_state: any, _assetId: string, roomId: string) => roomId,
        (_state: any, assetId: string) => assetId
    ],
    (standardFormData: StandardFormData | undefined, roomId: string, assetId: string) => {
        if (standardFormData === undefined) return null
        return derivePerspectiveForRoom(new StandardForm(standardFormData), roomId as ComponentUUID, assetId as AssetUUID)
    }
)

export const newAsset = (assetId: AssetUUID) => (dispatch: any) => {
    dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
}

export const receiveWMLEvent = (key: string) => (args: { header: WMLStreamingEventHeader; content: WMLContentEvent }) => (dispatch: any, getState: any) => {
    const { header, content } = args
    if (header.dataSourceKey !== 'mtw.wml') return
    const RequestIds = header.RequestIds
    if (!RequestIds || RequestIds.length === 0) return
    const pendingEdits = getPendingEdits(key)(getState())
    dispatch(publicActions.clearPendingEditsByRequestIds(key)({ assetKey: key, RequestIds }))
    if (header.type === 'Merge Conflict' && RequestIds.some(id => pendingEdits.some((p) => p.meta.key === id))) {
        push('Merge conflict prevented saving your changes')
    }
}

export const updateStandard = (key: string) => (payload: UpdateStandardPayload, options?: ScopedInstrumentationOptions) => async (dispatch: any, getState: any) => {
    if (!isSchemaAssetUUID(key)) {
        return
    }
    const base = getWMLBase(getState(), key) ?? EMPTY_BASE
    const previousImports = selectors.getLocalStandardForm(key)(getState()).metaData.filter(treeNodeTypeguard(isSchemaImport))
    dispatch(publicActions.updateStandard(key)({ ...payload, base, options }))
    const newImports = selectors.getLocalStandardForm(key)(getState()).metaData.filter(treeNodeTypeguard(isSchemaImport))
    if (!deepEqual(previousImports, newImports)) {
        dispatch(fetchImports(key))
    }
    autoSaveDebounce.set(
        key,
        () => {
            dispatch(saveEdit(key))
        },
        5000
    )
}

export const saveEdit = (key: string) => async (dispatch: any, getState: any) => {
    if (!isSchemaAssetUUID(key)) {
        return
    }
    const state = getState()
    const edit = selectors.getEdit(key)(state)
    const standardForm = new StandardForm(edit)
    if (!standardForm.isEmpty()) {
        // Ensure the universalKey is set to the correct asset key
        // (it may be 'ASSET#uninitialized' if the edit was never properly initialized)
        if (standardForm.universalKey !== key) {
            standardForm._universalKey = key as AssetUUID
        }
        const schema = schemaToWML([standardForm.schema])
        const requestId = uuidv4()
        await dispatch(socketDispatchPromise({
            message: 'applyEdit',
            RequestId: requestId,
            AssetId: key,
            schema
        }, { service: 'wml' }))
        dispatch(publicActions.saveEdit(key)({ requestId }))
    }
}

export {
    assureDefaultSituationFromPrimitives,
    DEFAULT_SITUATION_ID
} from './assureDefaultSituationFromPrimitives'

export { addImportToDraft } from './addImportToDraft'
export type { AddImportToDraftParams } from './addImportToDraft'

export const requestLLMGeneration = ({ assetId, roomId }: { assetId: AssetUUID, roomId: ComponentUUID }) => async (dispatch: any, getState: any) => {
    const standardSelector = getStandardForm(assetId)
    const standard = standardSelector(getState())

    const roomComponent = standard.components.find((component) => component.universalKey === roomId)

    if (roomComponent && isStandardRoomData(roomComponent)) {
        const name = typeof roomComponent.shortName === 'string' ? roomComponent.shortName : ''
        if (name) {
            dispatch(socketDispatchPromise({
                message: 'llmGenerate',
                name
            }, { service: 'asset' })).then((results: { description: string; summary: string; }) => {
                const { description, summary } = results
                dispatch(
                    updateStandard(assetId)({
                        type: 'update',
                        update: (draft: StandardForm) => {
                            const room = draft.byUniversalId[roomId]
                            if (room instanceof StandardRoom) {
                                assureDefaultSituationFromPrimitives(draft)
                                const currentFacet = room.situations.items.find(
                                    ({ reference }) => reference?.universalKey === DEFAULT_SITUATION_ID
                                )
                                const currentPayload = currentFacet?.payload instanceof SituationRoomFacetPayload
                                    ? currentFacet.payload
                                    : currentFacet?.payload
                                        ? new SituationRoomFacetPayload(currentFacet.payload)
                                        : new SituationRoomFacetPayload({})
                                const updatedPayload = new SituationRoomFacetPayload({
                                    displayName: currentPayload._displayName?.toJSON(),
                                    summary: summary ? new StandardRender([summary.trim()]).toJSON() : currentPayload._summary?.toJSON(),
                                    description: description ? new StandardRender([description.trim()]).toJSON() : currentPayload._description?.toJSON()
                                })
                                if (!SituationRoomFacetPayload.isEmpty(updatedPayload)) {
                                    const updatedFacet = new StandardSituationRoomFacet({
                                        reference: currentFacet?.reference?.clone() ?? {
                                            tag: 'Situation',
                                            universalKey: DEFAULT_SITUATION_ID
                                        },
                                        payload: updatedPayload.toJSON()
                                    })
                                    const remainingFacets = room.situations.items.filter(
                                        ({ reference }) => reference?.universalKey !== DEFAULT_SITUATION_ID
                                    )
                                    room._payload._situations = new SituationRoomFacetList([
                                        ...remainingFacets,
                                        updatedFacet
                                    ])
                                }
                            }
                            return draft
                        }
                    })
                )
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
