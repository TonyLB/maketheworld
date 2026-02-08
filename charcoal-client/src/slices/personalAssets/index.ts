import { v4 as uuidv4 } from 'uuid'
import { PersonalAssetsData, PersonalAssetsNodes } from './baseClasses'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import {
    lifelineCondition,
    getFetchURL,
    fetchAction,
    clearAction,
    backoffAction,
    locallyParseWMLAction,
    regenerateWMLAction,
    initializeNewAction,
    fetchImports,
    fetchImportsStateAction
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'
import {
    setDraftWML as setDraftWMLReducer,
    revertDraftWML as revertDraftWMLReducer,
    setLoadedImage as setLoadedImageReducer,
    updateStandard as updateStandardReducer,
    receiveWMLEvent as receiveWMLEventReducer,
    saveEdit as saveEditReducer,
    UpdateStandardPayload
} from './reducers'
import { PromiseCache } from '../promiseCache'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { socketDispatchPromise } from '../lifeLine'
import { isStandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { treeNodeTypeguard } from '@tonylb/mtw-base/ts/genericTree'
import { SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { push } from '../UI/feedback'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import Debounce from '../../lib/keyedDebounce'
import { isSchemaImport, SchemaImportMapping } from '@tonylb/mtw-base/ts/schema/metaData'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardRender } from '@tonylb/mtw-wml/ts/standardize/render'
import { deepEqual } from '../../lib/objects'
import StandardExample from '@tonylb/mtw-wml/ts/standardize/components/example'
import { AssetUUID, ComponentUUID, isSchemaComponentUUID, isSchemaAssetUUID } from '@tonylb/mtw-base/ts/schema'
import { standardComponentFactory } from '@tonylb/mtw-wml/ts/standardize/componentFactory'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import type { ScopedInstrumentationOptions } from '../../testing/scopedInstrumentation'

const autoSaveDebounce = new Debounce()

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
            base: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
            pendingEdits: [],
            edit: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
            inherited: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }
        }
    },
    sliceSelector: ({ personalAssets }) => (personalAssets),
    publicReducers: {
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
                base: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
                pendingEdits: [],
                edit: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] },
                inherited: { universalKey: 'ASSET#uninitialized', components: [], metaData: [] }
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
                choices: ['CLEAR', 'WMLDIRTY', 'SCHEMADIRTY']
            },
            WMLDIRTY: {
                stateType: 'CHOICE',
                choices: ['CLEAR', 'SCHEMADIRTY', 'NEEDPARSE']
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
    setDraftWML,
    revertDraftWML,
    setLoadedImage,
    onEnter
} = publicActions
export const {
    getStatus,
    getCurrentWML,
    getDraftWML,
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

export const newAsset = (assetId: AssetUUID) => (dispatch: any) => {
    dispatch(addItem({ key: assetId, options: { initialState: 'NEW' }}))
}

export const receiveWMLEvent = (key: string) => (args: { event: SubscriptionClientMessage }) => (dispatch: any, getState: any) => {
    const pendingEdits = getPendingEdits(key)(getState())
    dispatch(publicActions.receiveWMLEvent(key)(args))
    if (args.event.update.type === 'Merge Conflict' && args.event.RequestIds?.some(id => pendingEdits.some(p => p.meta.key === id))) {
        push('Merge conflict prevented saving your changes')
    }
}

export const updateStandard = (key: string) => (payload: UpdateStandardPayload, options?: ScopedInstrumentationOptions) => async (dispatch: any, getState: any) => {
    if (!isSchemaAssetUUID(key)) {
        return
    }
    const previousImports = selectors.getLocalStandardForm(key)(getState()).metaData.filter(treeNodeTypeguard(isSchemaImport))
    dispatch(publicActions.updateStandard(key)(payload))
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

export const addImport = ({
    assetId,
    fromAsset,
    uuid,
    tag,
    addToReferenceList
}: {
    assetId: AssetUUID
    fromAsset: AssetUUID
    tag: SchemaImportMapping['type']
    uuid: ComponentUUID
    addToReferenceList: (draft: StandardForm) => ReferenceListDescriptor | null
}, options?: { overrideUpdateStandard?: typeof updateStandard }) => (dispatch: any, getState: any) => {
    dispatch((options?.overrideUpdateStandard ?? publicActions.updateStandard)(assetId)({
        type: 'update',
        update: (draft: StandardForm) => {
            let component: StandardComponent

            if (uuid in draft.byUniversalId) {
                const existingComponent = draft.byUniversalId[uuid]
                component = existingComponent.clone().withImport(fromAsset)
                draft.byUniversalId[uuid] = component
            } else {
                const { component: newComponent } = standardComponentFactory({ tag, universalKey: uuid })
                if (!newComponent) {
                    throw new Error(`Could not create component for tag ${tag}`)
                }
                component = newComponent.withImport(fromAsset)
                draft.byUniversalId[uuid] = component
            }

            const descriptor = addToReferenceList(draft)
            if (descriptor != null) {
                const componentReference = component.reference
                if (componentReference) {
                    descriptor.setReferenceList(
                        descriptor.referenceList.assureItem(componentReference)
                    )
                }
            }

            return draft
        }
    }))
    dispatch(fetchImports(assetId))
    dispatch(setIntent({ key: assetId, intent: ['SCHEMADIRTY', 'WMLDIRTY'] }))
    dispatch(heartbeat)
}

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
                            const room = draft.byId[roomId]
                            if (room instanceof StandardRoom) {
                                const exampleKey = room.examples.payload[0].universalKey
                                const example = exampleKey && isSchemaComponentUUID(exampleKey) ? draft.byUniversalId[exampleKey] : undefined
                                if (example instanceof StandardExample) {
                                    if (description) {
                                        example._payload._description = new StandardRender([description.trim()])
                                    }
                                    if (summary) {
                                        example._payload._summary = new StandardRender([summary.trim()])
                                    }
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
