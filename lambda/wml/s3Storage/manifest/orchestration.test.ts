import { createManualSnapshot, CreateManualSnapshotOptions } from './orchestration'
import { loadManifest } from './operations'
import { appendManifestEvents } from './operations'
import { writeSnapshot } from './snapshots'
import { ManifestEvent } from './baseClasses'

// Mock dependencies
jest.mock('./operations')
jest.mock('./snapshots')

const mockLoadManifest = loadManifest as jest.MockedFunction<typeof loadManifest>
const mockAppendManifestEvents = appendManifestEvents as jest.MockedFunction<typeof appendManifestEvents>
const mockWriteSnapshot = writeSnapshot as jest.MockedFunction<typeof writeSnapshot>

describe('Orchestration Operations', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('createManualSnapshot', () => {
        it('should create snapshot with no prior snapshots (counts all chunks)', async () => {
            // Mock manifest with 3 chunks, no snapshots
            const manifestEvents: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729249200000-abc123.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729252800000-def456.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/chunks/1729256400000-ghi789.wml'
                }
            ]
            mockLoadManifest.mockResolvedValue(manifestEvents)
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729260000000.wml',
                snapshotSize: 5000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const options: CreateManualSnapshotOptions = {
                prefix: 'test.wml/',
                zone: 'Library'
            }

            const result = await createManualSnapshot(options)

            expect(result.success).toBe(true)
            expect(result.chunksBeforeSnapshot).toBe(3)
            expect(mockWriteSnapshot).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'test.wml/',
                    zone: 'Library',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 3
                })
            )
        })

        it('should count only chunks after last snapshot', async () => {
            // Mock manifest: 2 chunks, 1 snapshot, then 3 more chunks
            const manifestEvents: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729249200000-abc123.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/chunks/1729252800000-def456.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/snapshots/1729256400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 2
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T13:00:00.000Z',
                    eventId: 'e4',
                    s3Key: 'test.wml/chunks/1729260000000-ghi789.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T14:00:00.000Z',
                    eventId: 'e5',
                    s3Key: 'test.wml/chunks/1729263600000-jkl012.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T15:00:00.000Z',
                    eventId: 'e6',
                    s3Key: 'test.wml/chunks/1729267200000-mno345.wml'
                }
            ]
            mockLoadManifest.mockResolvedValue(manifestEvents)
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729270800000.wml',
                snapshotSize: 6000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const result = await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Canon'
            })

            expect(result.success).toBe(true)
            expect(result.chunksBeforeSnapshot).toBe(3)  // Only chunks after snapshot
        })

        it('should handle manifest with zone change events (non-chunk events)', async () => {
            // Mock manifest with mixed event types
            const manifestEvents: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1729249200000-abc123.wml'
                },
                {
                    type: 'zoneChange',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'e2',
                    fromZone: 'Library',
                    toZone: 'Canon'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/chunks/1729256400000-def456.wml'
                }
            ]
            mockLoadManifest.mockResolvedValue(manifestEvents)
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729260000000.wml',
                snapshotSize: 4000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const result = await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Canon'
            })

            expect(result.success).toBe(true)
            expect(result.chunksBeforeSnapshot).toBe(2)  // Only count chunks, not zone changes
        })

        it('should work with empty manifest (new asset)', async () => {
            mockLoadManifest.mockResolvedValue([])
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729260000000.wml',
                snapshotSize: 1000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const result = await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Personal'
            })

            expect(result.success).toBe(true)
            expect(result.chunksBeforeSnapshot).toBe(0)
        })

        it('should work with authorization prefix', async () => {
            const manifestEvents: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.auth.wml/chunks/1729249200000-abc123.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.auth.wml/chunks/1729252800000-def456.wml'
                }
            ]
            mockLoadManifest.mockResolvedValue(manifestEvents)
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.auth.wml/snapshots/1729260000000.wml',
                snapshotSize: 2000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const result = await createManualSnapshot({
                prefix: 'test.auth.wml/',
                zone: 'Library'
            })

            expect(result.success).toBe(true)
            expect(result.chunksBeforeSnapshot).toBe(2)
            expect(mockLoadManifest).toHaveBeenCalledWith('test.auth.wml/')
        })

        it('should append snapshot event to manifest with correct metadata', async () => {
            mockLoadManifest.mockResolvedValue([])
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729260000000.wml',
                snapshotSize: 3500
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Canon'
            })

            expect(mockAppendManifestEvents).toHaveBeenCalledWith(
                'test.wml/',
                expect.arrayContaining([
                    expect.objectContaining({
                        type: 'snapshot',
                        s3Key: 'test.wml/snapshots/1729260000000.wml',
                        snapshotType: 'manual',
                        chunksBeforeSnapshot: 0,
                        snapshotSize: 3500
                    })
                ])
            )
        })

        it('should include ISO timestamp and UUID eventId in snapshot event', async () => {
            mockLoadManifest.mockResolvedValue([])
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729260000000.wml',
                snapshotSize: 4000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Library'
            })

            expect(mockAppendManifestEvents).toHaveBeenCalledWith(
                'test.wml/',
                expect.arrayContaining([
                    expect.objectContaining({
                        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
                        eventId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
                    })
                ])
            )
        })

        it('should return snapshot reference with all metadata', async () => {
            mockLoadManifest.mockResolvedValue([])
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/1729260000000.wml',
                snapshotSize: 5500
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const result = await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Canon'
            })

            expect(result).toEqual({
                success: true,
                snapshotReference: {
                    s3Key: 'test.wml/snapshots/1729260000000.wml',
                    snapshotSize: 5500
                },
                chunksBeforeSnapshot: 0
            })
        })

        it('should handle multiple prior snapshots (uses most recent)', async () => {
            // Mock manifest with multiple snapshots
            const manifestEvents: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'e1',
                    s3Key: 'test.wml/chunks/1.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'e2',
                    s3Key: 'test.wml/snapshots/1.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 1
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'e3',
                    s3Key: 'test.wml/chunks/2.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T13:00:00.000Z',
                    eventId: 'e4',
                    s3Key: 'test.wml/snapshots/2.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 1
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T14:00:00.000Z',
                    eventId: 'e5',
                    s3Key: 'test.wml/chunks/3.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T15:00:00.000Z',
                    eventId: 'e6',
                    s3Key: 'test.wml/chunks/4.wml'
                }
            ]
            mockLoadManifest.mockResolvedValue(manifestEvents)
            mockWriteSnapshot.mockResolvedValue({
                s3Key: 'test.wml/snapshots/3.wml',
                snapshotSize: 7000
            })
            mockAppendManifestEvents.mockResolvedValue(undefined)

            const result = await createManualSnapshot({
                prefix: 'test.wml/',
                zone: 'Canon'
            })

            expect(result.chunksBeforeSnapshot).toBe(2)  // Only chunks after most recent snapshot
        })

        it('should work with all supported zones', async () => {
            const zones = ['Personal', 'Draft', 'Library', 'Canon'] as const

            for (const zone of zones) {
                jest.clearAllMocks()
                mockLoadManifest.mockResolvedValue([])
                mockWriteSnapshot.mockResolvedValue({
                    s3Key: `test.wml/snapshots/${Date.now()}.wml`,
                    snapshotSize: 1000
                })
                mockAppendManifestEvents.mockResolvedValue(undefined)

                const result = await createManualSnapshot({
                    prefix: 'test.wml/',
                    zone
                })

                expect(result.success).toBe(true)
                expect(mockWriteSnapshot).toHaveBeenCalledWith(
                    expect.objectContaining({ zone })
                )
            }
        })
    })
})

