import { generateWmlSnapshotContent } from './snapshotContent'
import { getLatestSnapshotTimestamp, getPresignedSnapshotUrl } from '../s3Storage/snapshotPresign'
import assetDB from '../utilities/mockableAssetDB'

jest.mock('../s3Storage/snapshotPresign', () => ({
    getLatestSnapshotTimestamp: jest.fn(),
    getPresignedSnapshotUrl: jest.fn()
}))
jest.mock('../utilities/mockableAssetDB', () => ({
    __esModule: true,
    default: { query: jest.fn() }
}))

const mockGetLatestSnapshotTimestamp = getLatestSnapshotTimestamp as jest.MockedFunction<typeof getLatestSnapshotTimestamp>
const mockGetPresignedSnapshotUrl = getPresignedSnapshotUrl as jest.MockedFunction<typeof getPresignedSnapshotUrl>
const mockAssetDBQuery = assetDB.query as jest.MockedFunction<typeof assetDB.query>

describe('generateWmlSnapshotContent', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetLatestSnapshotTimestamp.mockResolvedValue(1729252800000)
        mockGetPresignedSnapshotUrl.mockResolvedValue({
            wml: { sidecarUrl: 'https://bucket.s3.amazonaws.com/snapshot?X-Amz-Signature=xyz' }
        })
        mockAssetDBQuery.mockResolvedValue([])
    })

    it('returns domain-shaped payload with sidecarUrl', async () => {
        const result = await generateWmlSnapshotContent('ASSET#room')

        expect(result).toEqual({ wml: { sidecarUrl: expect.stringContaining('https://') } })
    })

    it('passes createSnapshotFirst false when no Dynamo events after snapshot', async () => {
        mockAssetDBQuery.mockResolvedValue([])

        await generateWmlSnapshotContent('ASSET#room')

        expect(mockGetPresignedSnapshotUrl).toHaveBeenCalledWith('ASSET#room', false)
    })

    it('passes createSnapshotFirst true when Dynamo has events after snapshot', async () => {
        mockAssetDBQuery.mockResolvedValue([
            { DataCategory: 'EVENT#1729252900000::uuid-1', type: 'Content Update', update: {} }
        ])

        await generateWmlSnapshotContent('ASSET#room')

        expect(mockGetPresignedSnapshotUrl).toHaveBeenCalledWith('ASSET#room', true)
    })

    it('queries Dynamo with correct sinceTimestamp from S3 manifest', async () => {
        mockGetLatestSnapshotTimestamp.mockResolvedValue(1000)

        await generateWmlSnapshotContent('ASSET#room')

        expect(mockAssetDBQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                ExpressionAttributeValues: expect.objectContaining({
                    ':timestampPrefix': 'EVENT#1000'
                })
            })
        )
    })
})
