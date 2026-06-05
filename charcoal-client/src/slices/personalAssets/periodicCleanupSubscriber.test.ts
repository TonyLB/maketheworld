import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import thunk from 'redux-thunk'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { StandardFormData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes'
import { CONFIRMED_TTL_MS, PENDING_TTL_MS } from '../dataSource'
import { LifeLinePubSub } from '../lifeLine'
import {
    startPeriodicTickPublisher,
    stopPeriodicTickPublisher,
    PERIODIC_TICK_DEFAULT_INTERVAL_MS
} from '../lifeLine/periodicTick'
import personalAssetsReducer, {
    getPendingEdits,
    getEffectivePendingEdits,
    registerPeriodicCleanupSubscriber
} from './index'
import type { PersonalAssetsPublic } from './baseClasses'
import { wmlDataSourceSlice } from '../wmlDataSource'
import { getWMLConfirmedRequestIds } from '../wmlDataSource/selectors'

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

const createStore = (preloadedState: TestRootState) =>
    configureStore({
        reducer: {
            personalAssets: personalAssetsReducer,
            wmlDataSource: wmlDataSourceSlice.reducer
        },
        middleware: [thunk],
        preloadedState
    })

const fullCleanupFixture = () =>
    stateWithBoth(
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

describe('periodicCleanupSubscriber', () => {
    beforeEach(() => {
        vi.setSystemTime(NOW)
    })

    afterEach(() => {
        stopPeriodicTickPublisher()
        vi.useRealTimers()
    })

    it('prunes storage when LifeLinePubSub publishes PeriodicTick', () => {
        const store = createStore(fullCleanupFixture())
        registerPeriodicCleanupSubscriber(store.dispatch)

        LifeLinePubSub.publish({ messageType: 'PeriodicTick', now: NOW })

        const state = store.getState()
        expect(getPendingEdits(ASSET_ID)(state)?.map((row) => row.meta.key)).toEqual(['fresh'])
        expect(
            state.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
        ).toEqual([
            { id: 'confirmed', seenAt: NOW - 1 },
            { id: 'fresh-confirmed', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
        ])
    })

    it('preserves active-row selector semantics before and after tick', () => {
        const store = createStore(fullCleanupFixture())
        registerPeriodicCleanupSubscriber(store.dispatch)

        const effectiveBefore = getEffectivePendingEdits(ASSET_ID)(store.getState())
        const confirmedBefore = getWMLConfirmedRequestIds(store.getState(), ASSET_ID)

        LifeLinePubSub.publish({ messageType: 'PeriodicTick', now: NOW })

        const effectiveAfter = getEffectivePendingEdits(ASSET_ID)(store.getState())
        const confirmedAfter = getWMLConfirmedRequestIds(store.getState(), ASSET_ID)

        expect(effectiveAfter?.map((row) => row.meta.key)).toEqual(
            effectiveBefore?.map((row) => row.meta.key)
        )
        expect(confirmedAfter).toEqual(confirmedBefore)
        expect(effectiveAfter?.map((row) => row.meta.key)).toEqual(['fresh'])
    })

    describe('periodic tick publisher path', () => {
        beforeEach(() => {
            vi.useRealTimers()
            vi.useFakeTimers()
            vi.setSystemTime(NOW)
        })

        it('prunes storage when publisher fires on interval', () => {
            const store = createStore(fullCleanupFixture())
            registerPeriodicCleanupSubscriber(store.dispatch)

            startPeriodicTickPublisher({
                intervalMs: PERIODIC_TICK_DEFAULT_INTERVAL_MS,
                getNow: () => NOW
            })
            vi.advanceTimersByTime(PERIODIC_TICK_DEFAULT_INTERVAL_MS)

            const state = store.getState()
            expect(getPendingEdits(ASSET_ID)(state)?.map((row) => row.meta.key)).toEqual(['fresh'])
            expect(
                state.wmlDataSource.publicData.subscribedStreams[ASSET_ID].confirmedRequestIds
            ).toEqual([
                { id: 'confirmed', seenAt: NOW - 1 },
                { id: 'fresh-confirmed', seenAt: NOW - CONFIRMED_TTL_MS + 1 }
            ])
        })
    })
})
