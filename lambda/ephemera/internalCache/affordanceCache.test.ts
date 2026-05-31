import internalCache from '../internalCache'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'

describe('internalCache.AffordanceCache', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        internalCache.clear()
    })

    it('is registered on InternalCache', () => {
        expect(internalCache.AffordanceCache).toBeDefined()
        expect(typeof internalCache.AffordanceCache.getAffordanceRow).toBe('function')
    })

    it('set patches memo so getAffordanceRow returns hydrated row', async () => {
        const roomId = 'ROOM#memo' as const
        const perspectiveKey = 'PERSPECTIVE#v1#test'
        const row = createAffordanceCacheRow({
            roomId,
            perspectiveKey,
            assetStack: ['ASSET#Base'],
            catalogVersion: 1,
            hydratedCatalogVersion: 1,
            topology: { roomUniversalKey: roomId, exits: [] },
        })

        internalCache.AffordanceCache.set({ row })

        const result = await internalCache.AffordanceCache.getAffordanceRow(roomId, perspectiveKey)
        expect(result).toEqual(row)
    })
})
