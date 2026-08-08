import { 
    DiagnosticsEventSerializer,
    DiagnosticsEventUpdate,
    isS3StructureFindingEvent,
    isCacheConsistencyFindingEvent,
    isEphemeraRenderCacheFindingEvent,
    isStaleSessionIdFindingEvent,
    isRoomOccupancyDriftFindingEvent,
    isOrphanedImprovisedObjectFindingEvent,
    isPlayerMisalignmentFindingEvent,
    isComponentVerticalMisalignedFindingEvent,
    isDiagnosticsEventUpdate
} from './index'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const diagnosticsHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.diagnostics',
    streamKey: 'global',
    timestamp: 0,
    type
})

describe('DiagnosticsEventSerializer', () => {
    const testEnv: DataSourceEnvironment = {
        fetch: jest.fn() as any
    }
    const serializer = new DiagnosticsEventSerializer(testEnv)

    describe('serialize', () => {
        it('should serialize S3 Structure Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'S3 Structure Finding',
                source: 'primitives.wml',
                status: 'missing',
                diagnosticRunId: 'test-run-123',
                timestamp: '2025-10-18T12:00:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('S3 Structure Finding')
            })

            expect(external).toEqual({
                type: 'S3 Structure Finding',
                source: 'primitives.wml',
                status: 'missing',
                diagnosticRunId: 'test-run-123',
                timestamp: '2025-10-18T12:00:00.000Z'
            })
        })

        it('should handle all status types', () => {
            const statuses: Array<'missing' | 'present' | 'corrupted' | 'unexpected'> = [
                'missing', 'present', 'corrupted', 'unexpected'
            ]

            statuses.forEach(status => {
                const internalEvent: DiagnosticsEventUpdate = {
                    type: 'S3 Structure Finding',
                    source: 'test.wml',
                    status,
                    diagnosticRunId: 'test-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }

                const external = serializer.serialize({
                    content: internalEvent,
                    header: diagnosticsHeader('S3 Structure Finding')
                })
                expect(external.type).toBe('S3 Structure Finding')
                if (external.type === 'S3 Structure Finding') {
                    expect(external.status).toBe(status)
                }
            })
        })
    })

    describe('Snapshot handling (defensive)', () => {
        it('should serialize Cache Consistency Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#primitives',
                status: 'stale',
                diagnosticRunId: 'run-789',
                timestamp: '2025-10-18T14:00:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Cache Consistency Finding')
            })

            expect(external).toEqual({
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#primitives',
                status: 'stale',
                diagnosticRunId: 'run-789',
                timestamp: '2025-10-18T14:00:00.000Z'
            })
        })

        it('should throw when serialize receives Snapshot header', () => {
            expect(() => serializer.serialize({
                content: {
                    type: 'S3 Structure Finding',
                    source: 'test.wml',
                    status: 'missing',
                    diagnosticRunId: 'test',
                    timestamp: '2025-01-01T00:00:00Z'
                },
                header: diagnosticsHeader('Snapshot')
            })).toThrow('DiagnosticsEventSerializer does not support snapshot serialization')
        })

        it('should return null when deserialize receives Snapshot header', async () => {
            const result = await serializer.deserialize({
                content: {},
                header: diagnosticsHeader('Snapshot')
            })
            expect(result).toBeNull()
        })

        it('should serialize Ephemera RenderCache Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#one', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                    { ephemeraId: 'ROOM#two', perspectiveKey: 'PERSPECTIVE#v1#def' },
                ],
                status: 'missing',
                diagnosticRunId: 'run-rc-1',
                timestamp: '2025-10-18T14:30:00.000Z',
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(external).toEqual({
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#one', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                    { ephemeraId: 'ROOM#two', perspectiveKey: 'PERSPECTIVE#v1#def' },
                ],
                status: 'missing',
                diagnosticRunId: 'run-rc-1',
                timestamp: '2025-10-18T14:30:00.000Z',
            })
        })

        it('should serialize Stale SessionId Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Stale SessionId Finding',
                player: 'alice',
                diagnosticRunId: 'run-stale-1',
                timestamp: '2025-10-18T17:00:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Stale SessionId Finding')
            })

            expect(external).toEqual({
                type: 'Stale SessionId Finding',
                player: 'alice',
                diagnosticRunId: 'run-stale-1',
                timestamp: '2025-10-18T17:00:00.000Z'
            })
        })

        it('should serialize Room Occupancy Drift Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Room Occupancy Drift Finding',
                roomId: 'ROOM#alpha',
                diagnosticRunId: 'run-room-1',
                timestamp: '2025-10-18T17:10:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Room Occupancy Drift Finding')
            })

            expect(external).toEqual({
                type: 'Room Occupancy Drift Finding',
                roomId: 'ROOM#alpha',
                diagnosticRunId: 'run-room-1',
                timestamp: '2025-10-18T17:10:00.000Z'
            })
        })

        it('should serialize Orphaned Improvised Object Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates',
                diagnosticRunId: 'run-orphan-1',
                timestamp: '2025-10-18T17:12:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Orphaned Improvised Object Finding')
            })

            expect(external).toEqual({
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates',
                diagnosticRunId: 'run-orphan-1',
                timestamp: '2025-10-18T17:12:00.000Z'
            })
        })

        it('should serialize Player Misalignment Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Player Misalignment Finding',
                player: 'alice',
                diagnosticRunId: 'run-player-1',
                timestamp: '2025-10-18T17:20:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Player Misalignment Finding')
            })

            expect(external).toEqual({
                type: 'Player Misalignment Finding',
                player: 'alice',
                diagnosticRunId: 'run-player-1',
                timestamp: '2025-10-18T17:20:00.000Z'
            })
        })

        it('should serialize Component Vertical Misaligned Finding event', () => {
            const internalEvent: DiagnosticsEventUpdate = {
                type: 'Component Vertical Misaligned Finding',
                assetId: 'ASSET#primitives',
                status: 'missing',
                diagnosticRunId: 'run-cv-ser',
                timestamp: '2025-10-18T17:30:00.000Z'
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Component Vertical Misaligned Finding')
            })

            expect(external).toEqual({
                type: 'Component Vertical Misaligned Finding',
                assetId: 'ASSET#primitives',
                status: 'missing',
                diagnosticRunId: 'run-cv-ser',
                timestamp: '2025-10-18T17:30:00.000Z'
            })
        })
    })

    describe('deserialize', () => {
        it('should deserialize S3 Structure Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'S3 Structure Finding',
                source: 'primitives.wml',
                status: 'missing',
                diagnosticRunId: 'test-run-123',
                timestamp: '2025-10-18T12:00:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('S3 Structure Finding')
            })

            expect(internal).toEqual({
                type: 'S3 Structure Finding',
                source: 'primitives.wml',
                status: 'missing',
                diagnosticRunId: 'test-run-123',
                timestamp: '2025-10-18T12:00:00.000Z'
            })
        })

        it('should provide defaults for missing optional fields', async () => {
            const externalEvent: any = {
                type: 'S3 Structure Finding',
                source: 'test.wml',
                status: 'present'
                // diagnosticRunId and timestamp omitted
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('S3 Structure Finding')
            })

            expect(internal).toBeDefined()
            expect(isS3StructureFindingEvent(internal)).toBe(true)
            if (internal && isS3StructureFindingEvent(internal)) {
                expect(internal.diagnosticRunId).toBe('unknown')
                expect(internal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        })

        it('should return null for missing required fields', async () => {
            const invalidEvents = [
                { type: 'S3 Structure Finding', status: 'missing' },  // missing source
                { type: 'S3 Structure Finding', source: 'test.wml' }, // missing status
                { type: 'S3 Structure Finding' }                      // missing both
            ]

            for (const event of invalidEvents) {
                const internal = await serializer.deserialize({
                    content: event,
                    header: diagnosticsHeader('S3 Structure Finding')
                })

                expect(internal).toBeNull()
            }
        })

        it('should deserialize Cache Consistency Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#primitives',
                status: 'stale',
                diagnosticRunId: 'run-456',
                timestamp: '2025-10-18T14:00:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Cache Consistency Finding')
            })

            expect(internal).toEqual({
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#primitives',
                status: 'stale',
                diagnosticRunId: 'run-456',
                timestamp: '2025-10-18T14:00:00.000Z'
            })
        })

        it('should deserialize Cache Consistency Finding with defaults for optional fields', async () => {
            const externalEvent: any = {
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#test-asset',
                status: 'missing'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Cache Consistency Finding')
            })

            expect(internal).toBeDefined()
            expect(internal).toMatchObject({
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#test-asset',
                status: 'missing'
            })
            if (internal && internal.type === 'Cache Consistency Finding') {
                expect(internal.diagnosticRunId).toBe('unknown')
                expect(internal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        })

        it('should return null for Cache Consistency Finding with missing required fields', async () => {
            const invalidEvents = [
                { type: 'Cache Consistency Finding', status: 'stale' },
                { type: 'Cache Consistency Finding', assetId: 'ASSET#x' },
                { type: 'Cache Consistency Finding', assetId: 'x', status: 'invalid' }
            ]

            for (const event of invalidEvents) {
                const internal = await serializer.deserialize({
                    content: event,
                    header: diagnosticsHeader('Cache Consistency Finding')
                })
                expect(internal).toBeNull()
            }
        })

        it('should deserialize Heal Global Values for assets lambda', async () => {
            const externalEvent: any = {
                type: 'Heal Global Values',
                assets: true
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Heal Global Values')
            })

            expect(internal).toEqual({
                type: 'Heal Global Values',
                assets: true
            })
        })

        it('should deserialize Ephemera RenderCache Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#alpha', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                ],
                status: 'corrupted',
                diagnosticRunId: 'run-rc-2',
                timestamp: '2025-10-18T14:35:00.000Z',
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(internal).toEqual({
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#alpha', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                ],
                status: 'corrupted',
                diagnosticRunId: 'run-rc-2',
                timestamp: '2025-10-18T14:35:00.000Z',
            })
        })

        it('should deserialize Ephemera RenderCache Finding with defaults for optional fields', async () => {
            const externalEvent: any = {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [],
                status: 'missing',
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(internal).toBeDefined()
            expect(internal).toMatchObject({
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [],
                status: 'missing',
            })
            if (internal && internal.type === 'Ephemera RenderCache Finding') {
                expect(internal.diagnosticRunId).toBe('unknown')
                expect(internal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        })

        it('should dedupe targetCatalogs on deserialize', async () => {
            const externalEvent: any = {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#hall', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                    { ephemeraId: 'ROOM#hall', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                ],
                status: 'missing',
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(internal).toMatchObject({
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#hall', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                ],
            })
        })

        it('should return null for Ephemera RenderCache Finding invalid payloads', async () => {
            const invalidEvents = [
                { type: 'Ephemera RenderCache Finding', status: 'missing' },
                { type: 'Ephemera RenderCache Finding', targetCatalogs: 'not-array', status: 'missing' },
                { type: 'Ephemera RenderCache Finding', targetCatalogs: [], status: 'stale' },
                {
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [{ ephemeraId: 'NOT-ROOM#x', perspectiveKey: 'PERSPECTIVE#v1#abc' }],
                    status: 'missing',
                },
                {
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [{ ephemeraId: 'ROOM#x', perspectiveKey: 'bad-key' }],
                    status: 'missing',
                },
            ]

            for (const event of invalidEvents) {
                const internal = await serializer.deserialize({
                    content: event,
                    header: diagnosticsHeader('Ephemera RenderCache Finding')
                })
                expect(internal).toBeNull()
            }
        })

        it('should return null for unknown event types', async () => {
            const unknownEvent: any = {
                type: 'Unknown Event Type',
                someField: 'someValue'
            }

            const internal = await serializer.deserialize({
                content: unknownEvent,
                header: diagnosticsHeader('Unknown Event Type')
            })

            expect(internal).toBeNull()
        })

        it('should deserialize Stale SessionId Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Stale SessionId Finding',
                player: 'bob',
                diagnosticRunId: 'run-stale-2',
                timestamp: '2025-10-18T17:05:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Stale SessionId Finding')
            })

            expect(internal).toEqual({
                type: 'Stale SessionId Finding',
                player: 'bob',
                diagnosticRunId: 'run-stale-2',
                timestamp: '2025-10-18T17:05:00.000Z'
            })
        })

        it('should deserialize Stale SessionId Finding with defaults for optional fields', async () => {
            const externalEvent: any = {
                type: 'Stale SessionId Finding',
                player: 'carol'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Stale SessionId Finding')
            })

            expect(internal).toBeDefined()
            expect(internal).toMatchObject({
                type: 'Stale SessionId Finding',
                player: 'carol'
            })
            if (internal && internal.type === 'Stale SessionId Finding') {
                expect(internal.diagnosticRunId).toBe('unknown')
                expect(internal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        })

        it('should return null for Stale SessionId Finding with empty or missing player', async () => {
            const invalidEvents = [
                { type: 'Stale SessionId Finding', player: '' },
                { type: 'Stale SessionId Finding' }
            ]

            for (const event of invalidEvents) {
                const internal = await serializer.deserialize({
                    content: event,
                    header: diagnosticsHeader('Stale SessionId Finding')
                })
                expect(internal).toBeNull()
            }
        })

        it('should deserialize Room Occupancy Drift Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Room Occupancy Drift Finding',
                roomId: 'ROOM#beta',
                diagnosticRunId: 'run-room-2',
                timestamp: '2025-10-18T17:15:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Room Occupancy Drift Finding')
            })

            expect(internal).toEqual({
                type: 'Room Occupancy Drift Finding',
                roomId: 'ROOM#beta',
                diagnosticRunId: 'run-room-2',
                timestamp: '2025-10-18T17:15:00.000Z'
            })
        })

        it('should return null for Room Occupancy Drift Finding with invalid roomId', async () => {
            const invalidEvents = [
                { type: 'Room Occupancy Drift Finding', roomId: '' },
                { type: 'Room Occupancy Drift Finding', roomId: 'NOT-ROOM' },
                { type: 'Room Occupancy Drift Finding' }
            ]

            for (const event of invalidEvents) {
                const internal = await serializer.deserialize({
                    content: event,
                    header: diagnosticsHeader('Room Occupancy Drift Finding')
                })
                expect(internal).toBeNull()
            }
        })

        it('should deserialize Orphaned Improvised Object Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates',
                diagnosticRunId: 'run-orphan-2',
                timestamp: '2025-10-18T17:18:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Orphaned Improvised Object Finding')
            })

            expect(internal).toEqual({
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates',
                diagnosticRunId: 'run-orphan-2',
                timestamp: '2025-10-18T17:18:00.000Z'
            })
        })

        it('should deserialize Orphaned Improvised Object Finding with defaults for optional fields', async () => {
            const externalEvent: any = {
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Orphaned Improvised Object Finding')
            })

            expect(internal).toBeDefined()
            expect(internal).toMatchObject({
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates'
            })
            if (internal && internal.type === 'Orphaned Improvised Object Finding') {
                expect(internal.diagnosticRunId).toBe('unknown')
                expect(internal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        })

        it('should return null for Orphaned Improvised Object Finding with invalid objectId', async () => {
            const invalidEvents = [
                { type: 'Orphaned Improvised Object Finding', objectId: '' },
                { type: 'Orphaned Improvised Object Finding', objectId: 'NOT-OBJECT' },
                { type: 'Orphaned Improvised Object Finding' }
            ]

            for (const event of invalidEvents) {
                const internal = await serializer.deserialize({
                    content: event,
                    header: diagnosticsHeader('Orphaned Improvised Object Finding')
                })
                expect(internal).toBeNull()
            }
        })

        it('should deserialize Player Misalignment Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Player Misalignment Finding',
                player: 'bob',
                diagnosticRunId: 'run-player-2',
                timestamp: '2025-10-18T17:25:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Player Misalignment Finding')
            })

            expect(internal).toEqual({
                type: 'Player Misalignment Finding',
                player: 'bob',
                diagnosticRunId: 'run-player-2',
                timestamp: '2025-10-18T17:25:00.000Z'
            })
        })

        it('should deserialize Component Vertical Misaligned Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Component Vertical Misaligned Finding',
                assetId: 'ASSET#one',
                status: 'orphan',
                diagnosticRunId: 'run-cv-des',
                timestamp: '2025-10-18T17:35:00.000Z'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Component Vertical Misaligned Finding')
            })

            expect(internal).toEqual({
                type: 'Component Vertical Misaligned Finding',
                assetId: 'ASSET#one',
                status: 'orphan',
                diagnosticRunId: 'run-cv-des',
                timestamp: '2025-10-18T17:35:00.000Z'
            })
        })

        it('should return null for Component Vertical Misaligned Finding with invalid status', async () => {
            const internal = await serializer.deserialize({
                content: {
                    type: 'Component Vertical Misaligned Finding',
                    assetId: 'ASSET#x',
                    status: 'invalid',
                },
                header: diagnosticsHeader('Component Vertical Misaligned Finding')
            })
            expect(internal).toBeNull()
        })
    })

    describe('type guards', () => {
        describe('isS3StructureFindingEvent', () => {
            it('should return true for valid S3 Structure Finding event', () => {
                const event: DiagnosticsEventUpdate = {
                    type: 'S3 Structure Finding',
                    source: 'primitives.wml',
                    status: 'missing',
                    diagnosticRunId: 'test-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }

                expect(isS3StructureFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                const invalidEvents = [
                    null,
                    undefined,
                    {},
                    { type: 'Wrong Type' },
                    { type: 'S3 Structure Finding' }, // missing required fields
                    { type: 'S3 Structure Finding', source: 'test', status: 'invalid-status' }
                ]

                invalidEvents.forEach(event => {
                    expect(isS3StructureFindingEvent(event)).toBe(false)
                })
            })
        })

        describe('isDiagnosticsEventUpdate', () => {
            it('should return true for any valid diagnostics event', () => {
                const event: DiagnosticsEventUpdate = {
                    type: 'S3 Structure Finding',
                    source: 'test.wml',
                    status: 'present',
                    diagnosticRunId: 'test-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }

                expect(isDiagnosticsEventUpdate(event)).toBe(true)
                expect(isDiagnosticsEventUpdate({
                    type: 'Stale SessionId Finding',
                    player: 'test-player',
                    diagnosticRunId: 'test-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                })).toBe(true)
                expect(isDiagnosticsEventUpdate({
                    type: 'Component Vertical Misaligned Finding',
                    assetId: 'ASSET#a',
                    status: 'missing',
                    diagnosticRunId: 'test-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                })).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isDiagnosticsEventUpdate(null)).toBe(false)
                expect(isDiagnosticsEventUpdate(undefined)).toBe(false)
                expect(isDiagnosticsEventUpdate({})).toBe(false)
            })
        })

        describe('isCacheConsistencyFindingEvent', () => {
            it('should return true for valid Cache Consistency Finding event', () => {
                const event = {
                    type: 'Cache Consistency Finding',
                    assetId: 'ASSET#primitives',
                    status: 'stale',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
                expect(isCacheConsistencyFindingEvent(event)).toBe(true)
            })

            it('should return true for status missing', () => {
                const event = {
                    type: 'Cache Consistency Finding',
                    assetId: 'ASSET#x',
                    status: 'missing',
                    diagnosticRunId: 'r',
                    timestamp: '2025-01-01T00:00:00Z'
                }
                expect(isCacheConsistencyFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isCacheConsistencyFindingEvent(null)).toBe(false)
                expect(isCacheConsistencyFindingEvent(undefined)).toBe(false)
                expect(isCacheConsistencyFindingEvent({})).toBe(false)
                expect(isCacheConsistencyFindingEvent({ type: 'Cache Consistency Finding' })).toBe(false)
                expect(isCacheConsistencyFindingEvent({ type: 'Cache Consistency Finding', assetId: 'x', status: 'repaired' })).toBe(false)
            })
        })

        describe('isEphemeraRenderCacheFindingEvent', () => {
            it('should return true for valid Ephemera RenderCache Finding event', () => {
                const event = {
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [
                        { ephemeraId: 'ROOM#one', perspectiveKey: 'PERSPECTIVE#v1#abc' },
                    ],
                    status: 'missing',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z',
                }
                expect(isEphemeraRenderCacheFindingEvent(event)).toBe(true)
            })

            it('should return true for empty targetCatalogs', () => {
                expect(isEphemeraRenderCacheFindingEvent({
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [],
                    status: 'missing',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z',
                })).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isEphemeraRenderCacheFindingEvent(null)).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent(undefined)).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({})).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [{ ephemeraId: 'ROOM#x', perspectiveKey: 'PERSPECTIVE#v1#abc' }],
                    status: 'invalid',
                })).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [{ ephemeraId: 'NOT-ROOM#x', perspectiveKey: 'PERSPECTIVE#v1#abc' }],
                    status: 'missing',
                })).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({
                    type: 'Ephemera RenderCache Finding',
                    targetCatalogs: [{ ephemeraId: 'ROOM#x', perspectiveKey: 'bad' }],
                    status: 'missing',
                })).toBe(false)
            })
        })

        describe('isStaleSessionIdFindingEvent', () => {
            it('should return true for valid Stale SessionId Finding event', () => {
                const event = {
                    type: 'Stale SessionId Finding',
                    player: 'alice',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
                expect(isStaleSessionIdFindingEvent(event)).toBe(true)
            })

            it('should return false for empty player or invalid payloads', () => {
                expect(isStaleSessionIdFindingEvent(null)).toBe(false)
                expect(isStaleSessionIdFindingEvent({ type: 'Stale SessionId Finding', player: '' })).toBe(false)
                expect(isStaleSessionIdFindingEvent({ type: 'Stale SessionId Finding' })).toBe(false)
            })
        })

        describe('isRoomOccupancyDriftFindingEvent', () => {
            it('should return true for valid Room Occupancy Drift Finding event', () => {
                const event = {
                    type: 'Room Occupancy Drift Finding',
                    roomId: 'ROOM#one',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
                expect(isRoomOccupancyDriftFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid roomId or payloads', () => {
                expect(isRoomOccupancyDriftFindingEvent(null)).toBe(false)
                expect(isRoomOccupancyDriftFindingEvent({ type: 'Room Occupancy Drift Finding', roomId: '' })).toBe(false)
                expect(isRoomOccupancyDriftFindingEvent({ type: 'Room Occupancy Drift Finding', roomId: 'one' })).toBe(false)
                expect(isRoomOccupancyDriftFindingEvent({ type: 'Room Occupancy Drift Finding' })).toBe(false)
            })
        })

        describe('isOrphanedImprovisedObjectFindingEvent', () => {
            it('should return true for valid Orphaned Improvised Object Finding event', () => {
                const event = {
                    type: 'Orphaned Improvised Object Finding',
                    objectId: 'OBJECT#Skates',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
                expect(isOrphanedImprovisedObjectFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid objectId or payloads', () => {
                expect(isOrphanedImprovisedObjectFindingEvent(null)).toBe(false)
                expect(isOrphanedImprovisedObjectFindingEvent({ type: 'Orphaned Improvised Object Finding', objectId: '' })).toBe(false)
                expect(isOrphanedImprovisedObjectFindingEvent({ type: 'Orphaned Improvised Object Finding', objectId: 'Skates' })).toBe(false)
                expect(isOrphanedImprovisedObjectFindingEvent({ type: 'Orphaned Improvised Object Finding' })).toBe(false)
            })
        })

        describe('isComponentVerticalMisalignedFindingEvent', () => {
            it('should return true for valid Component Vertical Misaligned Finding event', () => {
                const event = {
                    type: 'Component Vertical Misaligned Finding',
                    assetId: 'ASSET#x',
                    status: 'stale',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
                expect(isComponentVerticalMisalignedFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid payloads', () => {
                expect(isComponentVerticalMisalignedFindingEvent(null)).toBe(false)
                expect(isComponentVerticalMisalignedFindingEvent({ type: 'Component Vertical Misaligned Finding', assetId: 'x' })).toBe(false)
                expect(isComponentVerticalMisalignedFindingEvent({ type: 'Component Vertical Misaligned Finding', assetId: 'x', status: 'nope' })).toBe(false)
            })
        })

        describe('isPlayerMisalignmentFindingEvent', () => {
            it('should return true for valid Player Misalignment Finding event', () => {
                const event = {
                    type: 'Player Misalignment Finding',
                    player: 'alice',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
                expect(isPlayerMisalignmentFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid payloads', () => {
                expect(isPlayerMisalignmentFindingEvent(null)).toBe(false)
                expect(isPlayerMisalignmentFindingEvent({ type: 'Player Misalignment Finding', player: '' })).toBe(false)
                expect(isPlayerMisalignmentFindingEvent({ type: 'Player Misalignment Finding' })).toBe(false)
            })
        })
    })

    describe('round-trip serialization', () => {
        it('should maintain data integrity through serialize → deserialize', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'S3 Structure Finding',
                source: 'primitives.wml',
                status: 'corrupted',
                diagnosticRunId: 'run-456',
                timestamp: '2025-10-18T15:30:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('S3 Structure Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('S3 Structure Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Cache Consistency Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Cache Consistency Finding',
                assetId: 'ASSET#primitives',
                status: 'missing',
                diagnosticRunId: 'run-999',
                timestamp: '2025-10-18T16:00:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Cache Consistency Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Cache Consistency Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Ephemera RenderCache Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Ephemera RenderCache Finding',
                targetCatalogs: [
                    { ephemeraId: 'ROOM#abc', perspectiveKey: 'PERSPECTIVE#v1#abc123' },
                ],
                status: 'missing',
                diagnosticRunId: 'run-rc-3',
                timestamp: '2025-10-18T16:10:00.000Z',
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Stale SessionId Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Stale SessionId Finding',
                player: 'dana',
                diagnosticRunId: 'run-stale-rt',
                timestamp: '2025-10-18T18:00:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Stale SessionId Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Stale SessionId Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Room Occupancy Drift Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Room Occupancy Drift Finding',
                roomId: 'ROOM#gamma',
                diagnosticRunId: 'run-room-rt',
                timestamp: '2025-10-18T18:10:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Room Occupancy Drift Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Room Occupancy Drift Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Orphaned Improvised Object Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Orphaned Improvised Object Finding',
                objectId: 'OBJECT#Skates',
                diagnosticRunId: 'run-orphan-rt',
                timestamp: '2025-10-18T18:12:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Orphaned Improvised Object Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Orphaned Improvised Object Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Player Misalignment Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Player Misalignment Finding',
                player: 'eve',
                diagnosticRunId: 'run-player-rt',
                timestamp: '2025-10-18T18:20:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Player Misalignment Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Player Misalignment Finding')
            })

            expect(deserialized).toEqual(original)
        })

        it('should round-trip Component Vertical Misaligned Finding', async () => {
            const original: DiagnosticsEventUpdate = {
                type: 'Component Vertical Misaligned Finding',
                assetId: 'ASSET#round',
                status: 'missing',
                diagnosticRunId: 'run-cv-rt',
                timestamp: '2025-10-18T18:25:00.000Z'
            }

            const external = serializer.serialize({
                content: original,
                header: diagnosticsHeader('Component Vertical Misaligned Finding')
            })
            const deserialized = await serializer.deserialize({
                content: external,
                header: diagnosticsHeader('Component Vertical Misaligned Finding')
            })

            expect(deserialized).toEqual(original)
        })
    })
})

