/**
 * Cross-layer integration: real orchestrateAffordanceRequest (streamEventFromMessageBus) + real
 * mtw.ephemera.affordanceCache DataSource subscription on the process message bus.
 */
jest.mock('./affordanceCache/ensureAffordanceTopology', () => ({
    ensureAffordanceTopology: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./affordanceCache/catalogRow', () => ({
    ...jest.requireActual('./affordanceCache/catalogRow'),
    getAffordanceRow: jest.fn(),
}))

import './affordanceCache/index'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import messageBus from '../messageBus'
import internalCache from '../internalCache'
import { orchestrateAffordanceRequest } from './affordanceOrchestration/orchestrationHandler'
import { streamEventFromMessageBus } from './affordanceOrchestration/publishedEvents'
import { AFFORDANCE_CACHE_DATA_SOURCE_KEY } from './affordanceCache/publishedEvents'
import { getAffordanceRow } from './affordanceCache/catalogRow'
import {
    affordancePassThroughFixtureRouting,
    passThroughFixtureRoomId,
} from './passThroughContractFixtures'

const getAffordanceRowMock = getAffordanceRow as jest.MockedFunction<typeof getAffordanceRow>

describe('passThrough affordanceOrchestration -> affordanceCache (integration)', () => {
    const { roomId, perspective } = affordancePassThroughFixtureRouting
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    const affordanceRow = createAffordanceCacheRow({
        roomId,
        perspectiveKey,
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
        jest.clearAllMocks()
        getAffordanceRowMock.mockResolvedValue(affordanceRow)
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(affordanceRow)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('Slice Ready from orchestrateAffordanceRequest leads to Affordances Pertain on affordanceCache', async () => {
        const received: unknown[] = []
        messageBus.subscribe({
            tag: 'integration-affordances-pertain',
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

        await orchestrateAffordanceRequest({
            payload: {
                type: 'AffordancesRequested',
                roomId: passThroughFixtureRoomId,
                perspective,
                reason: 'topology',
            },
            messageBus,
            streamEvent: streamEventFromMessageBus(messageBus),
        })
        await messageBus.flush()

        expect(received).toHaveLength(1)
        expect(received[0]).toMatchObject({
            type: 'Affordances Pertain',
            roomId: passThroughFixtureRoomId,
            perspectiveKey,
            topology: affordanceRow.topology,
        })
    })
})
