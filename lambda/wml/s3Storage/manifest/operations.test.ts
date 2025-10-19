import { loadManifest, appendManifestEvents } from './operations'
import { ManifestEvent, ManifestChunkEvent, ManifestSnapshotEvent, ManifestZoneChangeEvent } from './baseClasses'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'

// Mock the s3Client
jest.mock('@tonylb/mtw-asset-workspace/ts/clients', () => ({
    s3Client: {
        get: jest.fn(),
        put: jest.fn()
    }
}))

const mockS3Client = s3Client as jest.Mocked<typeof s3Client>

describe('Manifest Operations', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('loadManifest', () => {
        it('should return empty array for non-existent manifest', async () => {
            // Simulate NoSuchKey error
            mockS3Client.get.mockRejectedValue({ Code: 'NoSuchKey' })

            const result = await loadManifest('ASSET#test.wml/')

            expect(result).toEqual([])
            expect(mockS3Client.get).toHaveBeenCalledWith({
                Key: 'ASSET#test.wml/manifest-latest.ndjson'
            })
        })

        it('should return empty array for empty manifest file', async () => {
            mockS3Client.get.mockResolvedValue('')

            const result = await loadManifest('ASSET#test.wml/')

            expect(result).toEqual([])
        })

        it('should return empty array for whitespace-only manifest', async () => {
            mockS3Client.get.mockResolvedValue('   \n  \n  ')

            const result = await loadManifest('ASSET#test.wml/')

            expect(result).toEqual([])
        })

        it('should parse single chunk event', async () => {
            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-abc123.wml',
                authoringPlayer: 'alice'
            }

            mockS3Client.get.mockResolvedValue(JSON.stringify(chunkEvent))

            const result = await loadManifest('ASSET#test.wml/')

            expect(result).toEqual([chunkEvent])
        })

        it('should parse multiple events in chronological order', async () => {
            const events: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'event-1',
                    s3Key: 'ASSET#test.wml/chunks/1729249200000-abc123.wml',
                    authoringPlayer: 'alice'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'event-2',
                    s3Key: 'ASSET#test.wml/chunks/1729252800000-def456.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-3',
                    s3Key: 'ASSET#test.wml/snapshots/1729256400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 2
                },
                {
                    type: 'zoneChange',
                    timestamp: '2025-10-18T13:00:00.000Z',
                    eventId: 'event-4',
                    fromZone: 'Library',
                    toZone: 'Canon'
                }
            ]

            const ndjson = events.map(e => JSON.stringify(e)).join('\n')
            mockS3Client.get.mockResolvedValue(ndjson)

            const result = await loadManifest('ASSET#test.wml/')

            expect(result).toEqual(events)
        })

        it('should skip invalid events and continue processing', async () => {
            const validEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-abc123.wml'
            }

            const ndjson = [
                JSON.stringify(validEvent),
                JSON.stringify({ type: 'invalid', foo: 'bar' }), // Invalid event
                JSON.stringify(validEvent)
            ].join('\n')

            mockS3Client.get.mockResolvedValue(ndjson)

            const result = await loadManifest('ASSET#test.wml/')

            // Should have 2 valid events (invalid one skipped)
            expect(result).toEqual([validEvent, validEvent])
        })

        it('should skip unparseable lines and continue processing', async () => {
            const validEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-abc123.wml'
            }

            const ndjson = [
                JSON.stringify(validEvent),
                'this is not valid json {{{',
                JSON.stringify(validEvent)
            ].join('\n')

            mockS3Client.get.mockResolvedValue(ndjson)

            const result = await loadManifest('ASSET#test.wml/')

            expect(result).toEqual([validEvent, validEvent])
        })

        it('should work with auth manifest prefix', async () => {
            const event: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.auth.wml/chunks/1729252800000-abc123.wml'
            }

            mockS3Client.get.mockResolvedValue(JSON.stringify(event))

            const result = await loadManifest('ASSET#test.auth.wml/')

            expect(result).toEqual([event])
            expect(mockS3Client.get).toHaveBeenCalledWith({
                Key: 'ASSET#test.auth.wml/manifest-latest.ndjson'
            })
        })

        it('should propagate non-NoSuchKey S3 errors', async () => {
            const error = new Error('Network error')
            mockS3Client.get.mockRejectedValue(error)

            await expect(loadManifest('ASSET#test.wml/')).rejects.toThrow('Network error')
        })
    })

    describe('appendManifestEvents', () => {
        it('should create new manifest when none exists', async () => {
            // Simulate non-existent manifest
            mockS3Client.get.mockRejectedValue({ Code: 'NoSuchKey' })
            mockS3Client.put.mockResolvedValue(undefined)

            const event: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-abc123.wml',
                authoringPlayer: 'alice'
            }

            await appendManifestEvents('ASSET#test.wml/', [event])

            expect(mockS3Client.put).toHaveBeenCalledWith({
                Key: 'ASSET#test.wml/manifest-latest.ndjson',
                Body: JSON.stringify(event)
            })
        })

        it('should append to existing manifest', async () => {
            const existingEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T10:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729249200000-abc123.wml'
            }

            const newEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-2',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-def456.wml'
            }

            mockS3Client.get.mockResolvedValue(JSON.stringify(existingEvent))
            mockS3Client.put.mockResolvedValue(undefined)

            await appendManifestEvents('ASSET#test.wml/', [newEvent])

            const expectedNdjson = [
                JSON.stringify(existingEvent),
                JSON.stringify(newEvent)
            ].join('\n')

            expect(mockS3Client.put).toHaveBeenCalledWith({
                Key: 'ASSET#test.wml/manifest-latest.ndjson',
                Body: expectedNdjson
            })
        })

        it('should append multiple events in a single batch', async () => {
            const events: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'event-1',
                    s3Key: 'ASSET#test.wml/chunks/1729249200000-abc123.wml'
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'event-2',
                    s3Key: 'ASSET#test.wml/snapshots/1729252800000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 1
                },
                {
                    type: 'zoneChange',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-3',
                    fromZone: 'Library',
                    toZone: 'Canon'
                }
            ]

            // Start with empty manifest
            mockS3Client.get.mockRejectedValue({ Code: 'NoSuchKey' })
            mockS3Client.put.mockResolvedValue(undefined)

            // Append all three events in a single batch
            await appendManifestEvents('ASSET#test.wml/', events)

            // Verify all events written in single operation
            const expectedNdjson = events.map(e => JSON.stringify(e)).join('\n')
            expect(mockS3Client.put).toHaveBeenCalledTimes(1)
            expect(mockS3Client.put).toHaveBeenCalledWith({
                Key: 'ASSET#test.wml/manifest-latest.ndjson',
                Body: expectedNdjson
            })
        })

        it('should work with auth manifest prefix', async () => {
            mockS3Client.get.mockRejectedValue({ Code: 'NoSuchKey' })
            mockS3Client.put.mockResolvedValue(undefined)

            const event: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.auth.wml/chunks/1729252800000-abc123.wml'
            }

            await appendManifestEvents('ASSET#test.auth.wml/', [event])

            expect(mockS3Client.put).toHaveBeenCalledWith({
                Key: 'ASSET#test.auth.wml/manifest-latest.ndjson',
                Body: JSON.stringify(event)
            })
        })

        it('should handle empty array as no-op', async () => {
            await appendManifestEvents('ASSET#test.wml/', [])

            expect(mockS3Client.get).not.toHaveBeenCalled()
            expect(mockS3Client.put).not.toHaveBeenCalled()
        })

        it('should reject invalid events', async () => {
            const invalidEvent = {
                type: 'chunk',
                // Missing required fields
                timestamp: '2025-10-18T12:00:00.000Z'
            } as any

            await expect(
                appendManifestEvents('ASSET#test.wml/', [invalidEvent])
            ).rejects.toThrow('Invalid manifest event at index 0')
        })

        it('should reject batch with invalid event in the middle', async () => {
            const validEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-abc123.wml'
            }

            const invalidEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z'
            } as any

            await expect(
                appendManifestEvents('ASSET#test.wml/', [validEvent, invalidEvent, validEvent])
            ).rejects.toThrow('Invalid manifest event at index 1')
        })

        it('should handle all event types in a batch', async () => {
            mockS3Client.get.mockRejectedValue({ Code: 'NoSuchKey' })
            mockS3Client.put.mockResolvedValue(undefined)

            const chunkEvent: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-abc123.wml',
                authoringPlayer: 'alice',
                chunkSize: 1024
            }

            const snapshotEvent: ManifestSnapshotEvent = {
                type: 'snapshot',
                timestamp: '2025-10-18T13:00:00.000Z',
                eventId: 'event-2',
                s3Key: 'ASSET#test.wml/snapshots/1729256400000.wml',
                snapshotType: 'automatic',
                chunksBeforeSnapshot: 10,
                snapshotSize: 50000
            }

            const zoneChangeEvent: ManifestZoneChangeEvent = {
                type: 'zoneChange',
                timestamp: '2025-10-18T14:00:00.000Z',
                eventId: 'event-3',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            // Append all event types in a single batch
            await appendManifestEvents('ASSET#test.wml/', [chunkEvent, snapshotEvent, zoneChangeEvent])

            const expectedBody = [chunkEvent, snapshotEvent, zoneChangeEvent]
                .map(e => JSON.stringify(e))
                .join('\n')

            expect(mockS3Client.put).toHaveBeenCalledTimes(1)
            expect(mockS3Client.put).toHaveBeenCalledWith({
                Key: 'ASSET#test.wml/manifest-latest.ndjson',
                Body: expectedBody
            })
        })
    })

    describe('Integration: Load and Append', () => {
        it('should maintain chronological order through multiple operations', async () => {
            const events: ManifestEvent[] = []

            // Mock get/put to maintain state
            mockS3Client.get.mockImplementation(async () => {
                if (events.length === 0) {
                    throw { Code: 'NoSuchKey' }
                }
                return events.map(e => JSON.stringify(e)).join('\n')
            })

            mockS3Client.put.mockImplementation(async ({ Body }) => {
                const lines = (Body as string).split('\n')
                events.length = 0
                lines.forEach(line => {
                    if (line.trim()) {
                        events.push(JSON.parse(line))
                    }
                })
            })

            // Add events
            const event1: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T10:00:00.000Z',
                eventId: 'event-1',
                s3Key: 'ASSET#test.wml/chunks/1729249200000-abc123.wml'
            }

            const event2: ManifestChunkEvent = {
                type: 'chunk',
                timestamp: '2025-10-18T11:00:00.000Z',
                eventId: 'event-2',
                s3Key: 'ASSET#test.wml/chunks/1729252800000-def456.wml'
            }

            const event3: ManifestSnapshotEvent = {
                type: 'snapshot',
                timestamp: '2025-10-18T12:00:00.000Z',
                eventId: 'event-3',
                s3Key: 'ASSET#test.wml/snapshots/1729256400000.wml',
                snapshotType: 'manual',
                chunksBeforeSnapshot: 2
            }

            // Append all events in a single batch
            await appendManifestEvents('ASSET#test.wml/', [event1, event2, event3])

            const loaded = await loadManifest('ASSET#test.wml/')

            expect(loaded).toEqual([event1, event2, event3])
            expect(loaded[0].timestamp).toBe('2025-10-18T10:00:00.000Z')
            expect(loaded[2].timestamp).toBe('2025-10-18T12:00:00.000Z')
        })

        it('should support incremental batch appends', async () => {
            const events: ManifestEvent[] = []

            // Mock get/put to maintain state
            mockS3Client.get.mockImplementation(async () => {
                if (events.length === 0) {
                    throw { Code: 'NoSuchKey' }
                }
                return events.map(e => JSON.stringify(e)).join('\n')
            })

            mockS3Client.put.mockImplementation(async ({ Body }) => {
                const lines = (Body as string).split('\n')
                events.length = 0
                lines.forEach(line => {
                    if (line.trim()) {
                        events.push(JSON.parse(line))
                    }
                })
            })

            const batch1: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'event-1',
                    s3Key: 'ASSET#test.wml/chunks/1729249200000-abc123.wml'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'event-2',
                    s3Key: 'ASSET#test.wml/chunks/1729252800000-def456.wml'
                }
            ]

            const batch2: ManifestEvent[] = [
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-3',
                    s3Key: 'ASSET#test.wml/snapshots/1729256400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 2
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T13:00:00.000Z',
                    eventId: 'event-4',
                    s3Key: 'ASSET#test.wml/chunks/1729260000000-ghi789.wml'
                }
            ]

            // Append first batch
            await appendManifestEvents('ASSET#test.wml/', batch1)

            // Append second batch
            await appendManifestEvents('ASSET#test.wml/', batch2)

            const loaded = await loadManifest('ASSET#test.wml/')

            expect(loaded).toHaveLength(4)
            expect(loaded).toEqual([...batch1, ...batch2])
        })
    })
})

