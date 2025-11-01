import {
    ManifestChunkEvent,
    ManifestSnapshotEvent,
    ManifestZoneChangeEvent,
    ManifestEvent,
    isManifestChunkEvent,
    isManifestSnapshotEvent,
    isManifestZoneChangeEvent,
    isManifestEvent,
    ManifestReconstructionState
} from './baseClasses'

describe('Manifest Event Types', () => {
    describe('Type Guards', () => {
        describe('isManifestChunkEvent', () => {
            it('should validate valid chunk events', () => {
                const validEvent: ManifestChunkEvent = {
                    type: 'chunk',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-123',
                    s3Key: 'asset-uuid.wml/chunks/1729252800000-abc123.wml',  // timestamp-uuid format
                    authoringPlayer: 'alice',
                    chunkSize: 1024
                }

                expect(isManifestChunkEvent(validEvent)).toBe(true)
            })

            it('should validate chunk events without optional fields', () => {
                const minimalEvent: ManifestChunkEvent = {
                    type: 'chunk',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-123',
                    s3Key: 'asset-uuid.wml/chunks/1729252800000-def456.wml'  // timestamp-uuid format
                }

                expect(isManifestChunkEvent(minimalEvent)).toBe(true)
            })

            it('should reject events with missing required fields', () => {
                const invalidEvents = [
                    { type: 'chunk', timestamp: '2025-10-18T12:00:00.000Z', eventId: 'event-123' }, // missing s3Key
                    { type: 'chunk', s3Key: 'key', eventId: 'event-123' },                          // missing timestamp
                    { type: 'chunk', timestamp: '2025-10-18T12:00:00.000Z', s3Key: 'key' },         // missing eventId
                    null,
                    undefined,
                    {}
                ]

                invalidEvents.forEach(event => {
                    expect(isManifestChunkEvent(event)).toBe(false)
                })
            })
        })

        describe('isManifestSnapshotEvent', () => {
            it('should validate valid snapshot events', () => {
                const validEvent: ManifestSnapshotEvent = {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-789',
                    s3Key: 'asset-uuid.wml/snapshots/1729252800000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 50
                }

                expect(isManifestSnapshotEvent(validEvent)).toBe(true)
            })

            it('should validate automatic snapshots', () => {
                const autoEvent: ManifestSnapshotEvent = {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-789',
                    s3Key: 'asset-uuid.wml/snapshots/1729252800000.wml',
                    snapshotType: 'automatic',
                    chunksBeforeSnapshot: 100,
                    snapshotSize: 50000
                }

                expect(isManifestSnapshotEvent(autoEvent)).toBe(true)
            })

            it('should reject invalid snapshot types', () => {
                const invalidEvent = {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-789',
                    s3Key: 'asset-uuid.wml/snapshots/1729252800000.wml',
                    snapshotType: 'invalid-type',  // Not 'manual' or 'automatic'
                    chunksBeforeSnapshot: 50
                }

                expect(isManifestSnapshotEvent(invalidEvent)).toBe(false)
            })

            it('should reject missing required fields', () => {
                const invalidEvents = [
                    { type: 'snapshot', timestamp: '2025-10-18T12:00:00.000Z' }, // missing required fields
                    { type: 'snapshot', s3Key: 'key', snapshotType: 'manual' },  // missing timestamp
                    null,
                    undefined
                ]

                invalidEvents.forEach(event => {
                    expect(isManifestSnapshotEvent(event)).toBe(false)
                })
            })
        })

        describe('isManifestZoneChangeEvent', () => {
            it('should validate valid zone change events', () => {
                const validEvent: ManifestZoneChangeEvent = {
                    type: 'zoneChange',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-abc',
                    fromZone: 'Library',
                    toZone: 'Canon'
                }

                expect(isManifestZoneChangeEvent(validEvent)).toBe(true)
            })

            it('should validate initial zone establishment with fromZone null', () => {
                const initialEvent: ManifestZoneChangeEvent = {
                    type: 'zoneChange',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-initial',
                    fromZone: null,  // null indicates initial zone establishment
                    toZone: 'Canon'
                }

                expect(isManifestZoneChangeEvent(initialEvent)).toBe(true)
            })

            it('should validate all zone transitions', () => {
                const zones: Zone[] = ['Canon', 'Library', 'Personal', 'Draft', 'Archive']
                
                zones.forEach(fromZone => {
                    zones.forEach(toZone => {
                        const event: ManifestZoneChangeEvent = {
                            type: 'zoneChange',
                            timestamp: '2025-10-18T12:00:00.000Z',
                            eventId: 'event-abc',
                            fromZone,
                            toZone
                        }
                        
                        expect(isManifestZoneChangeEvent(event)).toBe(true)
                    })
                })
            })

            it('should reject missing required fields', () => {
                const invalidEvents = [
                    { type: 'zoneChange', timestamp: '2025-10-18T12:00:00.000Z' }, // missing zones
                    { type: 'zoneChange', fromZone: 'Library', toZone: 'Canon' },  // missing timestamp
                    null,
                    undefined
                ]

                invalidEvents.forEach(event => {
                    expect(isManifestZoneChangeEvent(event)).toBe(false)
                })
            })
        })

        describe('isManifestEvent', () => {
            it('should accept all valid event types', () => {
                const events: ManifestEvent[] = [
                    {
                        type: 'chunk',
                        timestamp: '2025-10-18T12:00:00.000Z',
                        eventId: 'event-1',
                        s3Key: 'test.wml/chunks/123.wml',
                        requestId: 'req-1'
                    },
                    {
                        type: 'snapshot',
                        timestamp: '2025-10-18T12:00:00.000Z',
                        eventId: 'event-2',
                        s3Key: 'test.wml/snapshots/123.wml',
                        snapshotType: 'manual',
                        chunksBeforeSnapshot: 10
                    },
                    {
                        type: 'zoneChange',
                        timestamp: '2025-10-18T12:00:00.000Z',
                        eventId: 'event-3',
                        fromZone: 'Library',
                        toZone: 'Canon'
                    }
                ]

                events.forEach(event => {
                    expect(isManifestEvent(event)).toBe(true)
                })
            })

            it('should reject invalid events', () => {
                const invalidEvents = [
                    { type: 'unknown' },
                    null,
                    undefined,
                    {},
                    { type: 'chunk' } // missing required fields
                ]

                invalidEvents.forEach(event => {
                    expect(isManifestEvent(event)).toBe(false)
                })
            })
        })
    })

    describe('ManifestReconstructionState', () => {
        it('should represent reconstruction state with snapshot', () => {
            const state: ManifestReconstructionState = {
                latestSnapshot: {
                    timestamp: '2025-10-18T10:00:00.000Z',
                    s3Key: 'test.wml/snapshots/1729249200000.wml'
                },
                chunks: [
                    {
                        timestamp: '2025-10-18T11:00:00.000Z',
                        s3Key: 'test.wml/chunks/1729252800000-abc123.wml'
                    },
                    {
                        timestamp: '2025-10-18T12:00:00.000Z',
                        s3Key: 'test.wml/chunks/1729256400000-def456.wml'
                    }
                ],
                currentZone: 'Library',
                metadata: {
                    totalEvents: 53,
                    totalChunks: 50,
                    totalSnapshots: 1,
                    lastModified: '2025-10-18T12:00:00.000Z'
                }
            }

            expect(state.latestSnapshot).toBeDefined()
            expect(state.chunks).toHaveLength(2)
            expect(state.metadata.totalChunks).toBe(50)
        })

        it('should represent reconstruction state without snapshot', () => {
            const state: ManifestReconstructionState = {
                chunks: [
                    {
                        timestamp: '2025-10-18T11:00:00.000Z',
                        s3Key: 'test.wml/chunks/1729252800000-abc123.wml'
                    }
                ],
                metadata: {
                    totalEvents: 1,
                    totalChunks: 1,
                    totalSnapshots: 0,
                    lastModified: '2025-10-18T11:00:00.000Z'
                }
            }

            expect(state.latestSnapshot).toBeUndefined()
            expect(state.chunks).toHaveLength(1)
        })
    })

    describe('NDJSON Format Documentation', () => {
        it('should demonstrate expected NDJSON format', () => {
            // This test documents the expected format by example
            const events: ManifestEvent[] = [
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T10:00:00.000Z',
                    eventId: 'event-1',
                    s3Key: 'test.wml/chunks/1729249200000-abc123.wml',  // timestamp-uuid
                    authoringPlayer: 'alice'
                },
                {
                    type: 'chunk',
                    timestamp: '2025-10-18T11:00:00.000Z',
                    eventId: 'event-2',
                    s3Key: 'test.wml/chunks/1729252800000-def456.wml'  // timestamp-uuid
                },
                {
                    type: 'snapshot',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    eventId: 'event-3',
                    s3Key: 'test.wml/snapshots/1729256400000.wml',
                    snapshotType: 'manual',
                    chunksBeforeSnapshot: 2
                }
            ]

            // NDJSON format: one JSON object per line
            const ndjson = events.map(e => JSON.stringify(e)).join('\n')
            
            // Verify we can parse it back
            const parsed = ndjson.split('\n').map(line => JSON.parse(line))
            
            expect(parsed).toEqual(events)
            expect(parsed.every(isManifestEvent)).toBe(true)
        })
    })
})

