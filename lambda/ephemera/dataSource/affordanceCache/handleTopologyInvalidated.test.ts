jest.mock('./catalogRow')

import { handleTopologyInvalidated } from './handleTopologyInvalidated'
import {
    conditionalInvalidateAffordanceRow,
    queryAffordanceRowsForRoom,
} from './catalogRow'
import type { AffordanceCacheRow } from './baseClasses'

const queryRowsMock = queryAffordanceRowsForRoom as jest.MockedFunction<typeof queryAffordanceRowsForRoom>
const invalidateMock = conditionalInvalidateAffordanceRow as jest.MockedFunction<typeof conditionalInvalidateAffordanceRow>

const roomId = 'ROOM#one' as const

const row = (assetStack: string[]): AffordanceCacheRow => ({
    EphemeraId: roomId,
    DataCategory: 'Affordance::PERSPECTIVE#v1#a',
    assetStack: assetStack as `ASSET#${string}`[],
    catalogVersion: 1,
    hydratedCatalogVersion: 1,
    topology: { roomUniversalKey: roomId, exits: [] },
})

describe('handleTopologyInvalidated', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        invalidateMock.mockResolvedValue(undefined)
    })

    it('no-ops for area-scoped events without roomIds', async () => {
        await handleTopologyInvalidated({
            type: 'TopologyInvalidated',
            areaId: 'AREA#x',
            editAssetId: 'ASSET#edit',
        })

        expect(queryRowsMock).not.toHaveBeenCalled()
    })

    it('bumps only rows whose assetStack includes editAssetId (D35)', async () => {
        queryRowsMock.mockResolvedValue([
            row(['ASSET#edit', 'ASSET#other']),
            row(['ASSET#unrelated']),
        ])

        await handleTopologyInvalidated({
            type: 'TopologyInvalidated',
            roomIds: [roomId],
            editAssetId: 'ASSET#edit',
        })

        expect(invalidateMock).toHaveBeenCalledTimes(1)
        expect(invalidateMock.mock.calls[0][0].assetStack).toContain('ASSET#edit')
    })
})
