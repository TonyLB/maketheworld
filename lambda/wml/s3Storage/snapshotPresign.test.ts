import { getLatestSnapshotTimestamp, getPresignedSnapshotUrl } from './snapshotPresign'
import { loadManifest } from './manifest'
import { createManualSnapshot } from './manifest/orchestration'
import AssetWorkspace from './AssetWorkspace'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ManifestSnapshotEvent } from './manifest/baseClasses'

jest.mock('./manifest', () => ({
    loadManifest: jest.fn()
}))
jest.mock('./manifest/orchestration', () => ({
    createManualSnapshot: jest.fn()
}))
jest.mock('./AssetWorkspace', () => ({
    __esModule: true,
    default: { fromUUID: jest.fn() }
}))
jest.mock('@tonylb/mtw-asset-workspace/ts/clients', () => ({
    s3Client: {
        check: jest.fn(),
        internalClient: {}
    }
}))
jest.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: jest.fn()
}))

const mockLoadManifest = loadManifest as jest.MockedFunction<typeof loadManifest>
const mockCreateManualSnapshot = createManualSnapshot as jest.MockedFunction<typeof createManualSnapshot>
const mockAssetWorkspaceFromUUID = AssetWorkspace.fromUUID as jest.MockedFunction<typeof AssetWorkspace.fromUUID>
const mockCheck = s3Client.check as jest.MockedFunction<typeof s3Client.check>
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>

describe('getLatestSnapshotTimestamp', () => {
    const snapshotEvent: ManifestSnapshotEvent = {
        type: 'snapshot',
        timestamp: '2025-10-18T12:00:00.000Z',
        eventId: 'snap-1',
        s3Key: 'room.wml/snapshots/1729252800000.wml',
        snapshotType: 'manual',
        chunksBeforeSnapshot: 2
    }

    it('returns latest snapshot timestamp in ms', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent])

        const result = await getLatestSnapshotTimestamp('ASSET#room')

        expect(result).toBe(Date.parse('2025-10-18T12:00:00.000Z'))
    })

    it('returns 0 when no snapshot in manifest', async () => {
        mockLoadManifest.mockResolvedValue([])

        const result = await getLatestSnapshotTimestamp('ASSET#room')

        expect(result).toBe(0)
    })
})

describe('getPresignedSnapshotUrl', () => {
    const snapshotEvent: ManifestSnapshotEvent = {
        type: 'snapshot',
        timestamp: '2025-10-18T12:00:00.000Z',
        eventId: 'snap-1',
        s3Key: 'room.wml/snapshots/1729252800000.wml',
        snapshotType: 'manual',
        chunksBeforeSnapshot: 2
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockGetSignedUrl.mockResolvedValue('https://bucket.s3.amazonaws.com/snapshot?X-Amz-Signature=xyz')
        mockCheck.mockResolvedValue(true)
    })

    it('returns domain-shaped payload with sidecarUrl when createSnapshotFirst is false', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent])

        const result = await getPresignedSnapshotUrl('ASSET#room', false)

        expect(result).toEqual({
            wml: { sidecarUrl: expect.stringContaining('https://') },
            snapshotTimestamp: Date.parse('2025-10-18T12:00:00.000Z')
        })
        expect(mockCreateManualSnapshot).not.toHaveBeenCalled()
    })

    it('calls createManualSnapshot when createSnapshotFirst is true', async () => {
        mockLoadManifest
            .mockResolvedValueOnce([snapshotEvent])
            .mockResolvedValueOnce([
                snapshotEvent,
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:10:00.000Z',
                    eventId: 'snap-2',
                    s3Key: 'room.wml/snapshots/1729253000000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 1
                }
            ])
        mockAssetWorkspaceFromUUID.mockResolvedValue({ zone: 'Draft' } as any)

        const result = await getPresignedSnapshotUrl('ASSET#room', true)

        expect(mockCreateManualSnapshot).toHaveBeenCalledWith({
            prefix: 'room.wml/',
            zone: 'Draft'
        })
        expect(result.snapshotTimestamp).toBe(Date.parse('2025-10-18T12:10:00.000Z'))
        expect(result.wml.sidecarUrl).toContain('https://')
    })

    it('uses 30-minute presign expiry', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent])

        await getPresignedSnapshotUrl('ASSET#room', false)

        expect(mockGetSignedUrl).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ expiresIn: 1800 })
        )
    })

    it('throws when no snapshot exists in manifest', async () => {
        mockLoadManifest.mockResolvedValue([])

        await expect(getPresignedSnapshotUrl('ASSET#room', false)).rejects.toThrow(
            /No snapshot found for asset/
        )
    })

    it('throws when S3 object does not exist', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent])
        mockCheck.mockResolvedValue(false)

        await expect(getPresignedSnapshotUrl('ASSET#room', false)).rejects.toThrow(
            /Sidecar snapshot object not found/
        )
    })

    it('returns 0 snapshotTimestamp when manifest snapshot timestamp is unparseable', async () => {
        const badTimestampEvent: ManifestSnapshotEvent = {
            ...snapshotEvent,
            timestamp: 'not-a-date'
        }
        mockLoadManifest.mockResolvedValue([badTimestampEvent])

        const result = await getPresignedSnapshotUrl('ASSET#room', false)

        expect(result.snapshotTimestamp).toBe(0)
        expect(result.wml.sidecarUrl).toContain('https://')
    })
})
