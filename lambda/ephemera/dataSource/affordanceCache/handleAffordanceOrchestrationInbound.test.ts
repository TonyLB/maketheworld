jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        AffordanceCache: {
            getAffordanceRow: jest.fn(),
        },
    },
}))

import internalCache from '../../internalCache'
import { handleAffordanceOrchestrationInbound } from './handleAffordanceOrchestrationInbound'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'

const getAffordanceRow = internalCache.AffordanceCache.getAffordanceRow as jest.Mock

describe('handleAffordanceOrchestrationInbound', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('emits Affordances Pertain on Slice Ready when row is hydrated', async () => {
        const roomId = 'ROOM#one' as const
        const perspectiveKey = 'PERSPECTIVE#v1#abc'
        const perspective = { assetStack: ['ASSET#a'] as `ASSET#${string}`[] }
        const affordanceRow = createAffordanceCacheRow({
            roomId,
            perspectiveKey,
            assetStack: perspective.assetStack,
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: {
                roomUniversalKey: roomId,
                exits: [{ reference: { tag: 'Room', universalKey: 'ROOM#east' }, payload: 'east' }],
            },
        })
        getAffordanceRow.mockResolvedValue(affordanceRow)

        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await handleAffordanceOrchestrationInbound({
            content: {
                type: 'Slice Ready',
                roomId,
                perspective,
                perspectiveKey,
            },
            streamEvent,
        })

        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Affordances Pertain' },
            update: {
                type: 'Affordances Pertain',
                roomId,
                perspective,
                perspectiveKey,
                affordanceRow,
                topology: affordanceRow.topology,
            },
        })
    })

    it('emits Cache Error when slice is not ready', async () => {
        getAffordanceRow.mockResolvedValue(undefined)
        const streamEvent = jest.fn().mockResolvedValue(undefined)

        await handleAffordanceOrchestrationInbound({
            content: {
                type: 'Slice Ready',
                roomId: 'ROOM#one',
                perspective: { assetStack: ['ASSET#a'] },
                perspectiveKey: 'PERSPECTIVE#v1#abc',
            },
            streamEvent,
        })

        expect(streamEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                header: { type: 'Cache Error' },
                update: expect.objectContaining({ type: 'Cache Error', errorCode: 'SLICE_NOT_READY' }),
            })
        )
    })
})
