import './index'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { sendAffordanceOrchestrationPublish } from '../affordanceOrchestration/publishedEvents'
import {
    affordancePassThroughFixtureRouting,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'
import { AFFORDANCE_CACHE_DATA_SOURCE_KEY } from './publishedEvents'
import { ephemeraAffordanceCacheDataSource } from './index'

const originalMessageBusPublish = messageBus.publish.bind(messageBus)

describe('mtw.ephemera.affordanceCache DataSource', () => {
    const { roomId, perspective, perspectiveKey } = affordancePassThroughFixtureRouting
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
        jest.clearAllMocks()
        internalCache.AffordanceCache.clear()
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(affordanceRow)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    function spyPublish() {
        return jest.spyOn(messageBus, 'publish').mockImplementation((payload) => {
            originalMessageBusPublish(payload)
        })
    }

    it('uses publish outbound bus delivery', () => {
        expect(ephemeraAffordanceCacheDataSource.outboundBusDelivery).toBe('publish')
    })

    it('publishes Affordances Pertain StreamingEvent on Slice Ready pass-through path', async () => {
        const publishSpy = spyPublish()

        sendAffordanceOrchestrationPublish(messageBus, passThroughFixtureRoomId, {
            type: 'Slice Ready',
            ...affordancePassThroughFixtureRouting,
        })
        await messageBus.flushAndSettle()

        expect(
            publishSpy.mock.calls.some(
                (call) =>
                    call[0]?.type === 'StreamingEvent'
                    && call[0]?.dataSourceKey === AFFORDANCE_CACHE_DATA_SOURCE_KEY
                    && call[0]?.header?.type === 'Affordances Pertain'
            )
        ).toBe(true)
        publishSpy.mockRestore()
    })
})
