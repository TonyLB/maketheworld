import { appendManifestEventsWithLazyMigration } from './appendManifestEventsWithLazyMigration'
import AssetWorkspace from '../../s3Storage/AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { ManifestChunkEvent, ManifestZoneChangeEvent } from '../../s3Storage/manifest/baseClasses'

// Mock manifest operations
jest.mock('../../s3Storage/manifest/operations')
jest.mock('../../s3Storage/manifest/snapshots')
jest.mock('../../s3Storage/AssetWorkspace')

import { loadManifest, appendManifestEvents } from '../../s3Storage/manifest/operations'
import { writeSnapshot } from '../../s3Storage/manifest/snapshots'

const mockLoadManifest = loadManifest as jest.MockedFunction<typeof loadManifest>
const mockAppendManifestEvents = appendManifestEvents as jest.MockedFunction<typeof appendManifestEvents>
const mockWriteSnapshot = writeSnapshot as jest.MockedFunction<typeof writeSnapshot>

describe('appendManifestEventsWithLazyMigration', () => {
    let mockAssetWorkspace: AssetWorkspace
    const testPrefix = 'test.wml/'
    const testTimestamp = 1234567890

    beforeEach(() => {
        jest.clearAllMocks()
        
        // Setup default mock implementations
        mockLoadManifest.mockResolvedValue([])
        mockAppendManifestEvents.mockResolvedValue(undefined)
        mockWriteSnapshot.mockResolvedValue({
            s3Key: 'test.wml/snapshots/1234567890.wml',
            snapshotSize: 2000
        })
        
        // Create mock AssetWorkspace
        mockAssetWorkspace = {
            assetId: 'ASSET#test',
            zone: 'Library' as const,
            player: undefined,
            standard: new StandardForm('<Asset uuid=(test)><Room uuid=(lobby) /></Asset>')
        } as unknown as AssetWorkspace
    })

    describe('empty events array', () => {
        it('should return early for empty events array', async () => {
            await appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [])
            
            // Should not call any manifest operations
            expect(mockLoadManifest).not.toHaveBeenCalled()
            expect(mockAppendManifestEvents).not.toHaveBeenCalled()
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
        })
    })

    describe('no lazy migration needed', () => {
        it('should append events directly when manifest already exists', async () => {
            // Mock existing manifest
            mockLoadManifest.mockResolvedValue([
                {
                    type: 'chunk',
                    timestamp: '2025-10-01T10:00:00.000Z',
                    eventId: 'existing-event',
                    s3Key: 'test.wml/chunks/1234567890-existing.wml'
                }
            ])
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-event',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent])
            
            // Should load manifest to check for lazy migration
            expect(mockLoadManifest).toHaveBeenCalledWith(testPrefix)
            
            // Should NOT create snapshot (manifest already exists)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should append only the new chunk event
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(testPrefix, [chunkEvent])
        })

        it('should append events directly when asset has no content', async () => {
            // Mock empty asset (no content to migrate)
            const emptyAssetWorkspace = {
                ...mockAssetWorkspace,
                standard: new StandardForm('<Asset uuid=(test) />') // Empty asset
            } as AssetWorkspace
            
            const zoneChangeEvent: ManifestZoneChangeEvent = {
                type: 'zoneChange',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'zone-change-event',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            await appendManifestEventsWithLazyMigration(testPrefix, emptyAssetWorkspace, testTimestamp, [zoneChangeEvent])
            
            // Should load manifest
            expect(mockLoadManifest).toHaveBeenCalledWith(testPrefix)
            
            // Should NOT create snapshot (no content to migrate)
            expect(mockWriteSnapshot).not.toHaveBeenCalled()
            
            // Should append only the zone change event
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(testPrefix, [zoneChangeEvent])
        })
    })

    describe('lazy migration needed', () => {
        it('should create snapshot and append both snapshot and new events', async () => {
            // Mock empty manifest (triggers lazy migration)
            mockLoadManifest.mockResolvedValue([])
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-chunk',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent])
            
            // Should load manifest to check for lazy migration
            expect(mockLoadManifest).toHaveBeenCalledWith(testPrefix)
            
            // Should create snapshot (lazy migration)
            expect(mockWriteSnapshot).toHaveBeenCalledWith({
                prefix: testPrefix,
                timestamp: testTimestamp,
                zone: 'Library',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 0
            })
            
            // Should append both snapshot and chunk events in single call
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(testPrefix, expect.arrayContaining([
                expect.objectContaining({
                    type: 'snapshot',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 0
                }),
                chunkEvent
            ]))
            
            // Should have exactly 2 events in the batch
            const eventsAppended = mockAppendManifestEvents.mock.calls[0][1]
            expect(eventsAppended).toHaveLength(2)
            expect(eventsAppended[0].type).toBe('snapshot')
            expect(eventsAppended[1].type).toBe('chunk')
        })

        it('should handle multiple events with lazy migration', async () => {
            // Mock empty manifest (triggers lazy migration)
            mockLoadManifest.mockResolvedValue([])
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'chunk-1',
                s3Key: 'test.wml/chunks/1234567890-chunk1.wml',
                chunkSize: 300
            }
            
            const zoneChangeEvent: ManifestZoneChangeEvent = {
                type: 'zoneChange',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'zone-change',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            await appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent, zoneChangeEvent])
            
            // Should create snapshot
            expect(mockWriteSnapshot).toHaveBeenCalled()
            
            // Should append snapshot + both new events in single call
            const eventsAppended = mockAppendManifestEvents.mock.calls[0][1]
            expect(eventsAppended).toHaveLength(3)
            expect(eventsAppended[0].type).toBe('snapshot')
            expect(eventsAppended[1].type).toBe('chunk')
            expect(eventsAppended[2].type).toBe('zoneChange')
        })

        it('should use correct snapshot metadata', async () => {
            // Mock empty manifest (triggers lazy migration)
            mockLoadManifest.mockResolvedValue([])
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-chunk',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent])
            
            // Verify snapshot event metadata
            const eventsAppended = mockAppendManifestEvents.mock.calls[0][1]
            const snapshotEvent = eventsAppended[0] as any
            
            expect(snapshotEvent).toMatchObject({
                type: 'snapshot',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: expect.any(String),
                s3Key: 'test.wml/snapshots/1234567890.wml',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 0,
                snapshotSize: 2000
            })
        })
    })

    describe('error handling', () => {
        it('should propagate errors from loadManifest', async () => {
            const error = new Error('S3 error')
            mockLoadManifest.mockRejectedValue(error)
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-chunk',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await expect(
                appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent])
            ).rejects.toThrow('S3 error')
        })

        it('should propagate errors from writeSnapshot', async () => {
            // Mock empty manifest (triggers lazy migration)
            mockLoadManifest.mockResolvedValue([])
            
            const error = new Error('Snapshot creation failed')
            mockWriteSnapshot.mockRejectedValue(error)
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-chunk',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await expect(
                appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent])
            ).rejects.toThrow('Snapshot creation failed')
        })

        it('should propagate errors from appendManifestEvents', async () => {
            mockLoadManifest.mockResolvedValue([])
            
            const error = new Error('Manifest append failed')
            mockAppendManifestEvents.mockRejectedValue(error)
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-chunk',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await expect(
                appendManifestEventsWithLazyMigration(testPrefix, mockAssetWorkspace, testTimestamp, [chunkEvent])
            ).rejects.toThrow('Manifest append failed')
        })
    })

    describe('different asset types', () => {
        it('should work with auth prefix', async () => {
            const authPrefix = 'test.auth.wml/'
            mockLoadManifest.mockResolvedValue([])
            
            const zoneChangeEvent: ManifestZoneChangeEvent = {
                type: 'zoneChange',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'zone-change',
                fromZone: 'Personal',
                toZone: 'Library'
            }
            
            await appendManifestEventsWithLazyMigration(authPrefix, mockAssetWorkspace, testTimestamp, [zoneChangeEvent])
            
            // Should use auth prefix for all operations
            expect(mockLoadManifest).toHaveBeenCalledWith(authPrefix)
            expect(mockWriteSnapshot).toHaveBeenCalledWith(expect.objectContaining({
                prefix: authPrefix
            }))
            expect(mockAppendManifestEvents).toHaveBeenCalledWith(authPrefix, expect.any(Array))
        })

        it('should work with different zones', async () => {
            const canonAssetWorkspace = {
                ...mockAssetWorkspace,
                zone: 'Canon' as const
            } as AssetWorkspace
            
            mockLoadManifest.mockResolvedValue([])
            
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: new Date(testTimestamp).toISOString(),
                eventId: 'new-chunk',
                s3Key: 'test.wml/chunks/1234567890-new.wml',
                chunkSize: 500
            }
            
            await appendManifestEventsWithLazyMigration(testPrefix, canonAssetWorkspace, testTimestamp, [chunkEvent])
            
            // Should use Canon zone for snapshot
            expect(mockWriteSnapshot).toHaveBeenCalledWith(expect.objectContaining({
                zone: 'Canon'
            }))
        })
    })
})
