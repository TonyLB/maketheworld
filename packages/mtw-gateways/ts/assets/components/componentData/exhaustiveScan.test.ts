import { exhaustiveComponentPartitionScan } from './exhaustiveScan'

describe('exhaustiveComponentPartitionScan', () => {
    it('returns empty byAssets when partition query is empty', async () => {
        const assetDB = {
            query: jest.fn().mockResolvedValue([]),
        }
        const id = 'ROOM#onlyDefault' as const
        const row = await exhaustiveComponentPartitionScan(assetDB, id)
        expect(row.ComponentId).toBe(id)
        expect(row.byAssets).toEqual([])
        expect(assetDB.query).toHaveBeenCalledWith({
            Key: { AssetId: id },
            allFields: true,
        })
    })
})
