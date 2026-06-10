import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import {
    AFFORDANCE_CACHE_DATA_SOURCE_KEY,
    publishAffordanceCacheStreamEvent,
    sendAffordanceCachePublish,
    streamEventFromMessageBus,
    type AffordanceCacheUpdatePayload,
} from './publishedEvents'
import {
    affordancePassThroughFixtureRouting,
    passThroughFixtureRoomId,
} from '../passThroughContractFixtures'

const routing = affordancePassThroughFixtureRouting

describe('sendAffordanceCachePublish', () => {
    it('publishes StreamingEvent with header.type matching payload.type', () => {
        const bus = { publish: jest.fn() }
        const affordanceRow = createAffordanceCacheRow({
            roomId: routing.roomId,
            perspectiveKey: routing.perspectiveKey,
            assetStack: routing.perspective.assetStack,
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: {
                roomUniversalKey: routing.roomId,
                exits: [],
            },
        })
        const content: AffordanceCacheUpdatePayload = {
            type: 'Affordances Pertain',
            roomId: routing.roomId,
            perspective: routing.perspective,
            perspectiveKey: routing.perspectiveKey,
            affordanceRow,
            topology: affordanceRow.topology,
        }
        sendAffordanceCachePublish(bus, passThroughFixtureRoomId, content)
        expect(bus.publish).toHaveBeenCalledTimes(1)
        const arg = bus.publish.mock.calls[0][0]
        expect(arg.type).toBe('StreamingEvent')
        expect(arg.dataSourceKey).toBe(AFFORDANCE_CACHE_DATA_SOURCE_KEY)
        expect(arg.header.type).toBe('Affordances Pertain')
        expect(arg.header.streamKey).toBe(passThroughFixtureRoomId)
    })
})

describe('publishAffordanceCacheStreamEvent', () => {
    it('invokes streamEvent with update, streamKey, and header.type', async () => {
        const streamEvent = jest.fn().mockResolvedValue(undefined)
        const content: AffordanceCacheUpdatePayload = {
            type: 'Cache Error',
            roomId: routing.roomId,
            perspectiveKey: routing.perspectiveKey,
            errorCode: 'SLICE_NOT_READY',
            errorMessage: 'No row',
        }
        await publishAffordanceCacheStreamEvent(streamEvent, passThroughFixtureRoomId, content)
        expect(streamEvent).toHaveBeenCalledWith({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: 'Cache Error' },
        })
    })
})

describe('streamEventFromMessageBus', () => {
    it('delegates to sendAffordanceCachePublish', async () => {
        const bus = { publish: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const affordanceRow = createAffordanceCacheRow({
            roomId: routing.roomId,
            perspectiveKey: routing.perspectiveKey,
            assetStack: routing.perspective.assetStack,
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: {
                roomUniversalKey: routing.roomId,
                exits: [],
            },
        })
        const content: AffordanceCacheUpdatePayload = {
            type: 'Affordances Pertain',
            roomId: routing.roomId,
            perspective: routing.perspective,
            perspectiveKey: routing.perspectiveKey,
            affordanceRow,
            topology: affordanceRow.topology,
        }
        await streamEvent({
            update: content,
            streamKey: passThroughFixtureRoomId,
            header: { type: content.type },
        })
        expect(bus.publish).toHaveBeenCalledTimes(1)
        const arg = bus.publish.mock.calls[0][0]
        expect(arg.type).toBe('StreamingEvent')
        expect(arg.dataSourceKey).toBe(AFFORDANCE_CACHE_DATA_SOURCE_KEY)
    })
})
