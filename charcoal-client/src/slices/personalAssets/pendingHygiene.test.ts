import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { Schema } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import type { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StreamEventDeserializedPayload } from '../dataSource/streamEventPubSub'
import type { WMLStreamingEventHeader, WMLContentEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { PENDING_TTL_MS } from '../dataSource'
import personalAssetsReducer, {
    pendingHygieneCheck,
    getPendingEdits,
    getLocalStandardForm,
    saveEdit
} from './index'
import type { PersonalAssetsPublic } from './baseClasses'
import { push } from '../UI/feedback'

vi.mock('../UI/feedback', () => ({
    push: vi.fn((message: string) => ({ type: 'feedback/push', payload: message }))
}))

const { socketDispatchPromiseMock } = vi.hoisted(() => ({
    socketDispatchPromiseMock: vi.fn()
}))

vi.mock('../lifeLine', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../lifeLine')>()
    return {
        ...actual,
        socketDispatchPromise: socketDispatchPromiseMock
    }
})

const ASSET_ID = 'ASSET#assetC'
const VORTEX_ID = 'ROOM#vortex' as ComponentUUID
const NOW = 1_000_000

const wmlToJSON = (wml: string): StandardFormData => {
    const schema = new Schema()
    schema.loadWML(deIndentWML(wml))
    return new StandardForm(schema.schema[0]).toJSON()
}

const editWithVortexShortName = wmlToJSON(`
    <Asset uuid=(assetC)>
        <Room uuid=(vortex) ref={0}><ShortName>Cliff Base</ShortName></Room>
    </Asset>
`)

const baseWithShortName = wmlToJSON(`
    <Asset uuid=(assetC)>
        <Room uuid=(vortex) from=(ASSET#primitives) ref={0}>
            <ShortName>Cliff Base</ShortName>
        </Room>
    </Asset>
`)

const baseWithoutShortName = wmlToJSON(`
    <Asset uuid=(assetC)>
        <Room uuid=(vortex) from=(ASSET#primitives) ref={0} />
    </Asset>
`)

const pendingRow = (requestId: string, time: number) => ({
    meta: { key: requestId, time },
    edit: editWithVortexShortName
})

type TestRootState = {
    personalAssets: ReturnType<typeof personalAssetsReducer>
    wmlDataSource: {
        publicData: {
            subscribedStreams: Record<string, {
                materializedView: StandardFormData
                recentEvents: unknown[]
                confirmedRequestIds?: Array<{ id: string; seenAt: number }>
            }>
        }
    }
}

const personalAssetsItem = (publicData: Partial<PersonalAssetsPublic>) => ({
    meta: {
        currentState: 'FRESH',
        desiredStates: ['FRESH'],
        inProgress: null,
        onEnterPromises: {}
    },
    internalData: { incrementalBackoff: 0.5, id: ASSET_ID },
    publicData: {
        importData: {},
        properties: {},
        loadedImages: {},
        edit: { universalKey: ASSET_ID, components: [], metaData: [] },
        inherited: { universalKey: ASSET_ID, components: [], metaData: [] },
        pendingEdits: [],
        ...publicData
    }
})

const stateWithPending = (
    pendingEdits: PersonalAssetsPublic['pendingEdits'],
    materializedView: StandardFormData = baseWithoutShortName,
    confirmedRequestIds: Array<{ id: string; seenAt: number }> = []
): TestRootState => ({
    personalAssets: {
        byId: {
            [ASSET_ID]: personalAssetsItem({ pendingEdits })
        }
    },
    wmlDataSource: {
        publicData: {
            subscribedStreams: {
                [ASSET_ID]: {
                    materializedView,
                    recentEvents: [],
                    confirmedRequestIds
                }
            }
        }
    }
})

const localRoomShortName = (state: TestRootState): string | undefined => {
    const local = new StandardForm(getLocalStandardForm(ASSET_ID)(state)!)
    const room = local.byUniversalId[VORTEX_ID]
    if (!(room instanceof StandardRoom)) {
        return undefined
    }
    const shortNameJson = room.shortName?.toJSON()
    return typeof shortNameJson === 'string' ? shortNameJson : undefined
}

const runThunkOnState = (initialState: TestRootState, thunk: (dispatch: any, getState: () => TestRootState) => unknown) => {
    let state = initialState
    const dispatch = (action: unknown): unknown => {
        if (typeof action === 'function') {
            return (action as (dispatch: typeof dispatch, getState: () => TestRootState) => unknown)(dispatch, () => state)
        }
        state = {
            ...state,
            personalAssets: personalAssetsReducer(state.personalAssets, action as never)
        }
        return action
    }
    dispatch(thunk)
    return state
}

const makeEnvelope = (
    overrides: Partial<StreamEventDeserializedPayload> = {}
): StreamEventDeserializedPayload => ({
    dataSourceKey: 'mtw.wml',
    streamKey: ASSET_ID,
    timestamp: NOW,
    header: {
        dataSourceKey: 'mtw.wml',
        streamKey: ASSET_ID,
        timestamp: NOW,
        type: 'Content Update',
        RequestIds: ['req-a']
    },
    content: { type: 'Content Update', wml: '' },
    ...overrides
})

describe('pendingHygieneCheck', () => {
    beforeEach(() => {
        vi.setSystemTime(NOW)
        vi.mocked(push).mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('clears confirmed pending and drops saving indicator', () => {
        const initial = stateWithPending(
            [pendingRow('req-a', NOW)],
            baseWithoutShortName,
            [{ id: 'req-a', seenAt: NOW - 1 }]
        )
        const next = runThunkOnState(initial, pendingHygieneCheck(ASSET_ID, makeEnvelope()))
        expect(getPendingEdits(ASSET_ID)(next)).toHaveLength(0)
    })

    it('shows Merge Conflict toast when pre-clear pending matched a RequestId', () => {
        const initial = stateWithPending([pendingRow('req-a', NOW)])
        runThunkOnState(
            initial,
            pendingHygieneCheck(ASSET_ID, makeEnvelope({
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: ASSET_ID,
                    timestamp: NOW,
                    type: 'Merge Conflict',
                    RequestIds: ['req-a']
                },
                content: { type: 'Merge Conflict' }
            }))
        )
        expect(push).toHaveBeenCalledWith('Merge conflict prevented saving your changes')
    })

    it('does not toast on Merge Conflict when no pending row matched', () => {
        const initial = stateWithPending([])
        runThunkOnState(
            initial,
            pendingHygieneCheck(ASSET_ID, makeEnvelope({
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: ASSET_ID,
                    timestamp: NOW,
                    type: 'Merge Conflict',
                    RequestIds: ['req-a']
                },
                content: { type: 'Merge Conflict' }
            }))
        )
        expect(push).not.toHaveBeenCalled()
    })

    it('TTL-trims stale pending rows without confirmed ids', () => {
        const initial = stateWithPending([
            pendingRow('stale', NOW - PENDING_TTL_MS),
            pendingRow('fresh', NOW - PENDING_TTL_MS + 1)
        ])
        const next = runThunkOnState(initial, pendingHygieneCheck(ASSET_ID, makeEnvelope({
            header: {
                dataSourceKey: 'mtw.wml',
                streamKey: ASSET_ID,
                timestamp: NOW,
                type: 'Content Update',
                RequestIds: []
            }
        })))
        const pending = getPendingEdits(ASSET_ID)(next)
        expect(pending).toHaveLength(1)
        expect(pending![0].meta.key).toBe('fresh')
    })

    it('no-ops when streamKey is not a valid asset UUID', () => {
        const initial = stateWithPending([pendingRow('req-a', NOW)])
        const next = runThunkOnState(
            initial,
            pendingHygieneCheck('not-an-asset', makeEnvelope({ streamKey: 'not-an-asset' }))
        )
        expect(getPendingEdits(ASSET_ID)(next)).toHaveLength(1)
    })

    it('processEnvelope then hygiene leaves getLocalStandardForm without doubling', () => {
        const postEnvelope = stateWithPending(
            [pendingRow('req-a', NOW)],
            baseWithShortName,
            [{ id: 'req-a', seenAt: NOW - 1 }]
        )
        expect(localRoomShortName(postEnvelope)).toBe('Cliff Base')
        const afterHygiene = runThunkOnState(postEnvelope, pendingHygieneCheck(ASSET_ID, makeEnvelope()))
        expect(getPendingEdits(ASSET_ID)(afterHygiene)).toHaveLength(0)
        expect(localRoomShortName(afterHygiene)).toBe('Cliff Base')
    })
})

describe('saveEdit confirmed guard', () => {
    beforeEach(() => {
        vi.setSystemTime(NOW)
        socketDispatchPromiseMock.mockReset()
        socketDispatchPromiseMock.mockRejectedValue(new Error('applyEdit failed'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('does not revert when requestId is already in confirmed set', async () => {
        const editBefore = editWithVortexShortName
        const initial: TestRootState = {
            personalAssets: {
                byId: {
                    [ASSET_ID]: personalAssetsItem({
                        edit: editBefore,
                        pendingEdits: []
                    })
                }
            },
            wmlDataSource: {
                publicData: {
                    subscribedStreams: {
                        [ASSET_ID]: {
                            materializedView: baseWithoutShortName,
                            recentEvents: [],
                            confirmedRequestIds: []
                        }
                    }
                }
            }
        }

        let state = initial
        const dispatched: unknown[] = []
        const dispatch = (action: unknown): unknown => {
            if (typeof action === 'function') {
                return (action as (dispatch: typeof dispatch, getState: () => TestRootState) => unknown)(dispatch, () => state)
            }
            dispatched.push(action)
            state = {
                ...state,
                personalAssets: personalAssetsReducer(state.personalAssets, action as never)
            }
            if (
                typeof action === 'object' &&
                action !== null &&
                'type' in action &&
                (action as { type: string }).type === 'personalAssets/coresaveEdit'
            ) {
                const requestId = (action as { payload: { requestId: string } }).payload.requestId
                state = {
                    ...state,
                    wmlDataSource: {
                        publicData: {
                            subscribedStreams: {
                                [ASSET_ID]: {
                                    materializedView: baseWithoutShortName,
                                    recentEvents: [],
                                    confirmedRequestIds: [{ id: requestId, seenAt: NOW }]
                                }
                            }
                        }
                    }
                }
            }
            return action
        }

        await dispatch(saveEdit(ASSET_ID))

        const revertActions = dispatched.filter(
            (action) =>
                typeof action === 'object' &&
                action !== null &&
                'type' in action &&
                (action as { type: string }).type === 'personalAssets/corerevertSaveEdit'
        )
        expect(revertActions).toHaveLength(0)
        const publicData = state.personalAssets.byId[ASSET_ID].publicData
        expect(publicData.pendingEdits).toHaveLength(1)
        expect(publicData.edit.components).toEqual([])
    })
})
