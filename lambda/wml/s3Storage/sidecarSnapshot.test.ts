import { getSidecarSnapshotDescriptor } from './sidecarSnapshot'
import { loadManifest } from './manifest'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ManifestSnapshotEvent, ManifestChunkEvent } from './manifest/baseClasses'

jest.mock('./manifest', () => ({
    loadManifest: jest.fn()
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
const mockCheck = s3Client.check as jest.MockedFunction<typeof s3Client.check>
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>

describe('getSidecarSnapshotDescriptor', () => {
    const snapshotEvent: ManifestSnapshotEvent = {
        type: 'snapshot',
        timestamp: '2025-10-18T12:00:00.000Z',
        eventId: 'snap-1',
        s3Key: 'room.wml/snapshots/1729252800000.wml',
        snapshotType: 'manual',
        chunksBeforeSnapshot: 2
    }

    const chunkAfterSnapshot: ManifestChunkEvent = {
        type: 'chunk',
        timestamp: '2025-10-18T13:00:00.000Z',
        eventId: 'chunk-1',
        s3Key: 'room.wml/chunks/1729256400000-abc.wml'
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockGetSignedUrl.mockResolvedValue('https://bucket.s3.amazonaws.com/key?X-Amz-Signature=xyz')
        mockCheck.mockResolvedValue(true)
    })

    it('uses snapshot key when latest snapshot has no chunks after it', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent])

        const result = await getSidecarSnapshotDescriptor('ASSET#room')

        expect(mockLoadManifest).toHaveBeenCalledWith('room.wml/')
        expect(mockCheck).toHaveBeenCalledWith({ Key: 'room.wml/snapshots/1729252800000.wml' })
        expect(mockGetSignedUrl).toHaveBeenCalled()
        expect(result.sidecarUrl).toContain('https://')
        expect(result.createdAt).toBe(Date.parse('2025-10-18T12:00:00.000Z'))
        expect(result.expiresAt).toBe(result.createdAt + 600 * 1000)
    })

    it('uses materialized view key when there are chunks after latest snapshot', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent, chunkAfterSnapshot])

        const result = await getSidecarSnapshotDescriptor('ASSET#room')

        expect(mockCheck).toHaveBeenCalledWith({ Key: 'room.wml' })
        expect(result.createdAt).toBeGreaterThanOrEqual(Date.now() - 1000)
        expect(result.expiresAt).toBe(result.createdAt + 600 * 1000)
    })

    it('uses materialized view key when manifest is empty', async () => {
        mockLoadManifest.mockResolvedValue([])

        const result = await getSidecarSnapshotDescriptor('ASSET#room')

        expect(mockCheck).toHaveBeenCalledWith({ Key: 'room.wml' })
        expect(result.sidecarUrl).toBeDefined()
        expect(result.createdAt).toBeGreaterThanOrEqual(Date.now() - 1000)
    })

    it('uses materialized view key when manifest has no snapshot', async () => {
        mockLoadManifest.mockResolvedValue([chunkAfterSnapshot])

        const result = await getSidecarSnapshotDescriptor('ASSET#room')

        expect(mockCheck).toHaveBeenCalledWith({ Key: 'room.wml' })
        expect(result.sidecarUrl).toBeDefined()
    })

    it('throws when chosen object does not exist', async () => {
        mockLoadManifest.mockResolvedValue([snapshotEvent])
        mockCheck.mockResolvedValue(false)

        await expect(getSidecarSnapshotDescriptor('ASSET#room')).rejects.toThrow(
            /Sidecar snapshot object not found/
        )
    })

    it('presign uses correct expiry', async () => {
        mockLoadManifest.mockResolvedValue([])

        await getSidecarSnapshotDescriptor('ASSET#room')

        expect(mockGetSignedUrl).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ expiresIn: 600 })
        )
    })
})
