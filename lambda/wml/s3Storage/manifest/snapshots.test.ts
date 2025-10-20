import { writeSnapshot, WriteSnapshotOptions, SnapshotReference } from './snapshots'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'

// Mock dependencies
jest.mock('@tonylb/mtw-asset-workspace/ts/clients', () => ({
    s3Client: {
        copyWithTags: jest.fn(),
        getSize: jest.fn()
    }
}))

const mockS3Client = s3Client as jest.Mocked<typeof s3Client>

describe('Snapshot Operations', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('writeSnapshot', () => {
        it('should write snapshot with correct S3 key format', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            const options: WriteSnapshotOptions = {
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 10
            }

            const result = await writeSnapshot(options)

            expect(result.s3Key).toBe('test.wml/snapshots/1729252800000.wml')
        })

        it('should copy from materialized view (prefix without trailing slash)', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                zone: 'Canon',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 5
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    CopySource: 'test.wml'  // Without trailing slash
                })
            )
        })

        it('should include Zone tag for lifecycle management', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Canon',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 0
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Tags: { Zone: 'Canon' }
                })
            )
        })

        it('should include all required metadata', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                zone: 'Library',
                snapshotType: 'automatic',
                chunksBeforeSnapshot: 25
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: {
                        timestamp: '1729252800000',
                        snapshotType: 'automatic',
                        chunksBeforeSnapshot: '25'
                    }
                })
            )
        })

        it('should handle manual snapshot type', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 10
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: expect.objectContaining({
                        snapshotType: 'manual'
                    })
                })
            )
        })

        it('should handle automatic snapshot type', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Library',
                snapshotType: 'automatic',
                chunksBeforeSnapshot: 50
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: expect.objectContaining({
                        snapshotType: 'automatic'
                    })
                })
            )
        })

        it('should return snapshot reference with correct size from source', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(12345)

            const result = await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 10
            })

            expect(result).toEqual({
                s3Key: 'test.wml/snapshots/1729252800000.wml',
                snapshotSize: 12345
            })
        })

        it('should get size from source materialized view', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: 1729252800000,
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 10
            })

            expect(mockS3Client.getSize).toHaveBeenCalledWith({
                Key: 'test.wml'  // Source materialized view
            })
        })

        it('should work with auth prefix', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(2000)

            const result = await writeSnapshot({
                prefix: 'test.auth.wml/',
                timestamp: 1729252800000,
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 5
            })

            expect(result.s3Key).toBe('test.auth.wml/snapshots/1729252800000.wml')
            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    CopySource: 'test.auth.wml',  // Auth materialized view
                    Key: 'test.auth.wml/snapshots/1729252800000.wml'
                })
            )
        })

        it('should handle all zone types', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            const zones: Array<'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'> = [
                'Canon', 'Library', 'Personal', 'Draft', 'Archive'
            ]

            for (const zone of zones) {
                await writeSnapshot({
                    prefix: 'test.wml/',
                    timestamp: Date.now(),
                    zone,
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 0
                })

                expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                    expect.objectContaining({
                        Tags: { Zone: zone }
                    })
                )
            }
        })

        it('should preserve timestamp precision', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            const preciseTimestamp = 1729252800123 // with milliseconds

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: preciseTimestamp,
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 10
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Key: `test.wml/snapshots/${preciseTimestamp}.wml`,
                    Metadata: expect.objectContaining({
                        timestamp: preciseTimestamp.toString()
                    })
                })
            )
        })

        it('should handle zero chunks before snapshot', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 0
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: expect.objectContaining({
                        chunksBeforeSnapshot: '0'
                    })
                })
            )
        })

        it('should handle large chunks count', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Library',
                snapshotType: 'automatic',
                chunksBeforeSnapshot: 999
            })

            expect(mockS3Client.copyWithTags).toHaveBeenCalledWith(
                expect.objectContaining({
                    Metadata: expect.objectContaining({
                        chunksBeforeSnapshot: '999'
                    })
                })
            )
        })

        it('should call copy and getSize in parallel', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5000)

            await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 10
            })

            // Both should be called
            expect(mockS3Client.copyWithTags).toHaveBeenCalledTimes(1)
            expect(mockS3Client.getSize).toHaveBeenCalledTimes(1)
        })

        it('should handle large snapshot size', async () => {
            mockS3Client.copyWithTags.mockResolvedValue(undefined)
            mockS3Client.getSize.mockResolvedValue(5_000_000) // 5MB

            const result = await writeSnapshot({
                prefix: 'test.wml/',
                timestamp: Date.now(),
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 100
            })

            expect(result.snapshotSize).toBe(5_000_000)
        })
    })
})

