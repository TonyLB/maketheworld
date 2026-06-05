import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { CONFIRMED_TTL_MS, PENDING_TTL_MS } from '../dataSource'
import personalAssetsReducer, {
    getPendingEdits,
    pruneStaleRequestCorrelation
} from './index'
import type { PersonalAssetsPublic } from './baseClasses'
import { wmlDataSourceSlice } from '../wmlDataSource'

const ASSET_ID = 'ASSET#assetC' as AssetUUID
const NOW = 1_000_000

const emptyForm = (): StandardFormData => ({
    universalKey: ASSET_ID,
    components: [],
    metaData: []
})

const pendingRow = (requestId: string, time: number) => ({
    meta: { key: requestId, time },
    edit: emptyForm()
})

type TestRootState = {
    personalAssets: ReturnType<typeof personalAssetsReducer>
    wmlDataSource: ReturnType<typeof wmlDataSourceSlice.reducer>
}

const personalAssetsItem = (publicData: Partial<PersonalAssetsPublic>) => ({
    meta: {
        currentState: 'FRESH' as const,
        desiredStates: ['FRESH' as const],
        inProgress: null,
        onEnterPromises: {}
    },
    internalData: { incrementalBackoff: 0.5, id: ASSET_ID },
    publicData: {
        importData: {},
        properties: {},
        loadedImages: {},
        edit: emptyForm(),
        inherited: emptyForm(),
        pendingEdits: [],
        ...publicData
    }
})

const wmlStream = (
    confirmedRequestIds: Array<{ id: string; seenAt: number }> = []
) => ({
    materializedView: emptyForm(),
    recentEvents: [],
    confirmedRequestIds
})

type TestDispatch = (action: unknown) => unknown

const rootReducer = (state: TestRootState, action: unknown): TestRootState => ({
    personalAssets: personalAssetsReducer(state.personalAssets, action as never),
    wmlDataSource: wmlDataSourceSlice.reducer(state.wmlDataSource, action as never)
})

const runThunkOnState = (
    initialState: TestRootState,
    thunk: (dispatch: TestDispatch, getState: () => TestRootState) => unknown
) => {
    let state = initialState
    const dispatch: TestDispatch = (action: unknown): unknown => {
        if (typeof action === 'function') {
            return (action as (d: TestDispatch, getState: () => TestRootState) => unknown)(dispatch, () => state)
        }
        state = rootReducer(state, action)
        return action
    }
    dispatch(thunk)
    return state
}

const stateWithBoth = (
    pendingEdits: PersonalAssetsPublic['pendingEdits'],
    confirmedRequestIds: Array<{ id: string; seenAt: number }>
): TestRootState => ({
    personalAssets: {
        byId: {
            [ASSET_ID]: personalAssetsItem({ pendingEdits })
        }
    } as ReturnType<typeof personalAssetsReducer>,
    wmlDataSource: {
        ...wmlDataSourceSlice.getInitialState(),
        publicData: {
            ...wmlDataSourceSlice.getInitialState().publicData,
            subscribedStreams: {
                [ASSET_ID]: wmlStream(confirmedRequestIds)
            }
        }
    }
})

describe('pruneStaleRequestCorrelation', () => {
    beforeEach(() => {
        vi.setSystemTime(NOW)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('runs full cleanup order: confirmed pending clear, stale pending trim, stale confirmed prune', () => {
        const initial = stateWithBoth(
            [
                pendingRow('confirmed', NOW - 1),
                pendingRow('stale-pending', NOW - PENDING_TTL_MS),
                pendingRow('fresh', NOW - 1)
            ],
            [
                { id: 'confirmed', seenAt: NOW - 1 },
                { id: 'stale-confirmed', seenAt: NOW - CONFIRMED_TTL_MS },
                { id: 'fresh-confirmed', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
            ]
        )
        const next = runThunkOnState(initial, pruneStaleRequestCorrelation({ now: NOW }))
        expect(getPendingEdits(ASSET_ID)(next as any)?.map((row) => row.meta.key)).toEqual(['fresh'])
        expect(
            next.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([
            { id: 'confirmed', seenAt: NOW - 1 },
            { id: 'fresh-confirmed', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
        ])
    })

    it('removes stale confirmed after pending cleared by stored confirmed ids', () => {
        const staleConfirmed = { id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }
        const initial = stateWithBoth(
            [pendingRow('req-a', NOW - 1)],
            [staleConfirmed]
        )
        const next = runThunkOnState(initial, pruneStaleRequestCorrelation({ now: NOW }))
        expect(getPendingEdits(ASSET_ID)(next as any)).toHaveLength(0)
        expect(
            next.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([])
    })

    it('retains stale confirmed when pending with same key survives steps 1-2 (oscillation invariant)', () => {
        const staleConfirmed = { id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }
        let state = stateWithBoth(
            [pendingRow('req-a', NOW - 1)],
            [staleConfirmed, { id: 'other-id', seenAt: NOW - 1 }]
        )
        const dispatch: TestDispatch = (action: unknown): unknown => {
            if (typeof action === 'function') {
                return (action as (d: TestDispatch, g: () => TestRootState) => unknown)(dispatch, () => state)
            }
            state = rootReducer(state, action)
            return action
        }
        dispatch({
            type: 'wmlDataSource/pruneStaleConfirmedRequestIds',
            payload: {
                streamKey: ASSET_ID,
                now: NOW,
                pendingKeys: ['req-a']
            }
        })
        expect(
            state.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([staleConfirmed, { id: 'other-id', seenAt: NOW - 1 }])
    })

    it('prunes stale confirmed while unrelated pending rows remain', () => {
        const initial = stateWithBoth(
            [pendingRow('req-b', NOW - 1)],
            [{ id: 'req-a', seenAt: NOW - CONFIRMED_TTL_MS }]
        )
        const next = runThunkOnState(initial, pruneStaleRequestCorrelation({ now: NOW }))
        expect(getPendingEdits(ASSET_ID)(next as any)?.map((row) => row.meta.key)).toEqual(['req-b'])
        expect(
            next.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([])
    })

    it('prunes wml confirmed rows when personalAssets slice is absent', () => {
        const initial: TestRootState = {
            personalAssets: { byId: {} },
            wmlDataSource: {
                ...wmlDataSourceSlice.getInitialState(),
                publicData: {
                    ...wmlDataSourceSlice.getInitialState().publicData,
                    subscribedStreams: {
                        [ASSET_ID]: wmlStream([
                            { id: 'stale', seenAt: NOW - CONFIRMED_TTL_MS },
                            { id: 'fresh', seenAt: NOW - 1 }
                        ])
                    }
                }
            }
        }
        const next = runThunkOnState(initial, pruneStaleRequestCorrelation({ now: NOW }))
        expect(
            next.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([{ id: 'fresh', seenAt: NOW - 1 }])
    })

    it('trims pending only when wml stream is absent', () => {
        const initial: TestRootState = {
            personalAssets: {
                byId: {
                    [ASSET_ID]: personalAssetsItem({
                        pendingEdits: [
                            pendingRow('stale', NOW - PENDING_TTL_MS),
                            pendingRow('fresh', NOW - 1)
                        ]
                    })
                }
            } as ReturnType<typeof personalAssetsReducer>,
            wmlDataSource: wmlDataSourceSlice.getInitialState()
        }
        const next = runThunkOnState(initial, pruneStaleRequestCorrelation({ now: NOW }))
        expect(getPendingEdits(ASSET_ID)(next as any)?.map((row) => row.meta.key)).toEqual(['fresh'])
    })

    it('uses injectable now from options', () => {
        const customNow = NOW + 50_000
        const initial = stateWithBoth(
            [pendingRow('stale', customNow - PENDING_TTL_MS)],
            [{ id: 'stale-confirmed', seenAt: customNow - CONFIRMED_TTL_MS }]
        )
        const next = runThunkOnState(initial, pruneStaleRequestCorrelation({ now: customNow }))
        expect(getPendingEdits(ASSET_ID)(next as any)).toHaveLength(0)
        expect(
            next.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([])
    })
})
