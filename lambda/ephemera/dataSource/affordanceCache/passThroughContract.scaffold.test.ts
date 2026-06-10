/**
 * Contract tests: affordanceCache subscribes to mtw.ephemera.affordanceOrchestration;
 * Slice Ready should refetch + emit Affordances Pertain per pass-through contract.
 * Importing ./index registers the DataSource once (ESM module cache; safe with index.test.ts).
 */
import './index'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import { sendAffordanceOrchestrationPublish } from '../affordanceOrchestration/publishedEvents'
import { AFFORDANCE_CACHE_DATA_SOURCE_KEY } from './publishedEvents'
import {
    affordancePassThroughFixtureRouting,
    passThroughFixturePerspectiveKey,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'

describe('affordanceCache receives affordanceOrchestration stream', () => {
    const { roomId, perspective } = affordancePassThroughFixtureRouting
    const affordanceRow = createAffordanceCacheRow({
        roomId,
        perspectiveKey: passThroughFixturePerspectiveKey,
        assetStack: perspective.assetStack,
        catalogVersion: 1,
        hydratedCatalogVersion: 1,
        topology: {
            roomUniversalKey: roomId,
            exits: [
                {
                    reference: { tag: 'Room', universalKey: 'ROOM#east' },
                    payload: 'east',
                },
            ],
        },
    })

    beforeEach(() => {
        messageBus.clear()
        internalCache.AffordanceCache.clear()
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(affordanceRow)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('Slice Ready leads to Affordances Pertain after refetch (lean routing)', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'scaffold-affordances-pertain',
            priority: 20,
            filter: (m: any) =>
                m.type === 'StreamingEvent'
                && m.dataSourceKey === AFFORDANCE_CACHE_DATA_SOURCE_KEY
                && m.header?.type === 'Affordances Pertain',
            callback: async ({ payloads }) => {
                for (const p of payloads) {
                    received.push(await p.getContent())
                }
            },
        })

        sendAffordanceOrchestrationPublish(messageBus, passThroughFixtureRoomId, {
            type: 'Slice Ready',
            ...affordancePassThroughFixtureRouting,
        })
        await messageBus.flushAndSettle()

        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            type: 'Affordances Pertain',
            roomId: passThroughFixtureRoomId,
            perspectiveKey: passThroughFixturePerspectiveKey,
            topology: affordanceRow.topology,
        })
    })
})
