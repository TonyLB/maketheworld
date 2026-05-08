import { generateWmlSnapshotContent } from './snapshotContent'
import { getPresignedSnapshotUrl } from '../s3Storage/snapshotPresign'
import { getChunksAfterLatestSnapshot } from '../s3Storage/manifest'
import assetDB from '../utilities/mockableAssetDB'

jest.mock('../s3Storage/snapshotPresign', () => ({
    getPresignedSnapshotUrl: jest.fn()
}))
jest.mock('../s3Storage/manifest', () => ({
    getChunksAfterLatestSnapshot: jest.fn()
}))
jest.mock('../utilities/mockableAssetDB', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), query: jest.fn() }
}))

const mockGetPresignedSnapshotUrl = getPresignedSnapshotUrl as jest.MockedFunction<typeof getPresignedSnapshotUrl>
const mockGetChunksAfterLatestSnapshot = getChunksAfterLatestSnapshot as jest.MockedFunction<typeof getChunksAfterLatestSnapshot>
const mockAssetDBQuery = assetDB.query as unknown as jest.MockedFunction<
    (args: Record<string, unknown>) => Promise<Array<{ AssetId: string; DataCategory: string; type?: string; update?: unknown }>>
>
const mockAssetDBGetItem = assetDB.getItem as jest.MockedFunction<typeof assetDB.getItem>

describe('generateWmlSnapshotContent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockAssetDBGetItem.mockResolvedValue(undefined)
        mockGetPresignedSnapshotUrl.mockResolvedValue({
            wml: { sidecarUrl: 'https://bucket.s3.amazonaws.com/snapshot?X-Amz-Signature=xyz' },
            snapshotTimestamp: 4000
        })
        mockAssetDBQuery.mockResolvedValue([])
        mockGetChunksAfterLatestSnapshot.mockResolvedValue(0)
    })

    it('returns domain-shaped payload with sidecarUrl', async () => {
        const result = await generateWmlSnapshotContent('ASSET#room')

        expect(result).toEqual({
            wml: { sidecarUrl: expect.stringContaining('https://') },
            replayAt: 4000
        })
    })

    it('passes createSnapshotFirst false when no Dynamo events and no manifest chunks', async () => {
        mockAssetDBGetItem.mockResolvedValue({ snapshotHeader: { timestamp: 1729252800000 } })
        mockAssetDBQuery.mockResolvedValue([])
        mockGetChunksAfterLatestSnapshot.mockResolvedValue(0)

        await generateWmlSnapshotContent('ASSET#room')

        expect(mockGetPresignedSnapshotUrl).toHaveBeenCalledWith('ASSET#room', false)
    })

    it('passes createSnapshotFirst true when Dynamo has events after snapshot', async () => {
        mockAssetDBGetItem.mockResolvedValue({ snapshotHeader: { timestamp: 1729252800000 } })
        mockGetPresignedSnapshotUrl.mockResolvedValue({
            wml: { sidecarUrl: 'https://bucket.s3.amazonaws.com/snapshot?X-Amz-Signature=xyz' },
            snapshotTimestamp: 1729252900000
        })
        mockAssetDBQuery.mockResolvedValue([
            { AssetId: 'ASSET#room', DataCategory: 'EVENT#1729252900000::uuid-1', type: 'Content Update', update: {} }
        ])

        const result = await generateWmlSnapshotContent('ASSET#room')

        expect(mockGetPresignedSnapshotUrl).toHaveBeenCalledWith('ASSET#room', true)
        expect(mockGetChunksAfterLatestSnapshot).not.toHaveBeenCalled()
        expect(result.replayAt).toBe(1729252900000)
    })

    it('uses sinceTimestamp from Meta::Snapshot when present', async () => {
        mockAssetDBGetItem.mockResolvedValue({ snapshotHeader: { timestamp: 1000 } })

        const result = await generateWmlSnapshotContent('ASSET#room')

        expect(mockAssetDBQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                ExpressionAttributeValues: expect.objectContaining({
                    ':timestampPrefix': 'EVENT#1000'
                })
            })
        )
        expect(result.replayAt).toBe(4000)
    })

    it('uses sinceTimestamp 0 when no Meta::Snapshot exists', async () => {
        mockAssetDBGetItem.mockResolvedValue(undefined)

        const result = await generateWmlSnapshotContent('ASSET#room')

        expect(mockAssetDBQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                ExpressionAttributeValues: expect.objectContaining({
                    ':timestampPrefix': 'EVENT#0'
                })
            })
        )
        expect(result.replayAt).toBe(4000)
    })

    it('manifest fallback: creates snapshot and logs when Dynamo has 0 but manifest has chunks', async () => {
        mockAssetDBGetItem.mockResolvedValue({ snapshotHeader: { timestamp: 1729252800000 } })
        mockAssetDBQuery.mockResolvedValue([])
        mockGetChunksAfterLatestSnapshot.mockResolvedValue(3)
        mockGetPresignedSnapshotUrl.mockResolvedValue({
            wml: { sidecarUrl: 'https://bucket.s3.amazonaws.com/snapshot?X-Amz-Signature=xyz' },
            snapshotTimestamp: 1729253000000
        })

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

        const result = await generateWmlSnapshotContent('ASSET#room')

        expect(mockGetPresignedSnapshotUrl).toHaveBeenCalledWith('ASSET#room', true)
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('mtw.wml snapshot mismatch'))
        expect(warnSpy.mock.calls[0][0]).toContain('3 chunks')
        expect(warnSpy.mock.calls[0][0]).toContain('ASSET#room')
        expect(result.replayAt).toBe(1729253000000)

        warnSpy.mockRestore()
    })
})
