import { 
    DiagnosticsEventSerializer,
    DiagnosticsEventUpdate,
    isS3StructureFindingEvent,
    isCacheConsistencyFindingEvent,
    isEphemeraRenderCacheFindingEvent,
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
                expect(external.status).toBe(status)
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
                perspective: ['ASSET#primitives', 'ASSET#core'],
                status: 'missing',
                diagnosticRunId: 'run-rc-1',
                timestamp: '2025-10-18T14:30:00.000Z',
                roomIds: ['ROOM#one', 'ROOM#two']
            }

            const external = serializer.serialize({
                content: internalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(external).toEqual({
                type: 'Ephemera RenderCache Finding',
                perspective: ['ASSET#primitives', 'ASSET#core'],
                status: 'missing',
                diagnosticRunId: 'run-rc-1',
                timestamp: '2025-10-18T14:30:00.000Z',
                roomIds: ['ROOM#one', 'ROOM#two']
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
                connections: true,
                assets: true
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Heal Global Values')
            })

            expect(internal).toEqual({
                type: 'Heal Global Values',
                connections: true,
                assets: true
            })
        })

        it('should deserialize Ephemera RenderCache Finding event from EventBridge format', async () => {
            const externalEvent: any = {
                type: 'Ephemera RenderCache Finding',
                perspective: ['ASSET#primitives', 'ASSET#core'],
                status: 'corrupted',
                diagnosticRunId: 'run-rc-2',
                timestamp: '2025-10-18T14:35:00.000Z',
                roomIds: ['ROOM#alpha']
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(internal).toEqual({
                type: 'Ephemera RenderCache Finding',
                perspective: ['ASSET#primitives', 'ASSET#core'],
                status: 'corrupted',
                diagnosticRunId: 'run-rc-2',
                timestamp: '2025-10-18T14:35:00.000Z',
                roomIds: ['ROOM#alpha']
            })
        })

        it('should deserialize Ephemera RenderCache Finding with defaults for optional fields', async () => {
            const externalEvent: any = {
                type: 'Ephemera RenderCache Finding',
                perspective: ['ASSET#primitives'],
                status: 'missing'
            }

            const internal = await serializer.deserialize({
                content: externalEvent,
                header: diagnosticsHeader('Ephemera RenderCache Finding')
            })

            expect(internal).toBeDefined()
            expect(internal).toMatchObject({
                type: 'Ephemera RenderCache Finding',
                perspective: ['ASSET#primitives'],
                status: 'missing'
            })
            if (internal && internal.type === 'Ephemera RenderCache Finding') {
                expect(internal.diagnosticRunId).toBe('unknown')
                expect(internal.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
            }
        })

        it('should return null for Ephemera RenderCache Finding invalid payloads', async () => {
            const invalidEvents = [
                { type: 'Ephemera RenderCache Finding', status: 'missing' },
                { type: 'Ephemera RenderCache Finding', perspective: ['ASSET#x'] },
                { type: 'Ephemera RenderCache Finding', perspective: ['NOT-ASSET#x'], status: 'missing' },
                { type: 'Ephemera RenderCache Finding', perspective: ['ASSET#x'], status: 'stale' },
                { type: 'Ephemera RenderCache Finding', perspective: ['ASSET#x'], status: 'missing', roomIds: ['NOT-ROOM#x'] }
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
                    perspective: ['ASSET#primitives'],
                    status: 'missing',
                    diagnosticRunId: 'run-1',
                    timestamp: '2025-10-18T12:00:00.000Z',
                    roomIds: ['ROOM#one']
                }
                expect(isEphemeraRenderCacheFindingEvent(event)).toBe(true)
            })

            it('should return false for invalid events', () => {
                expect(isEphemeraRenderCacheFindingEvent(null)).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent(undefined)).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({})).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({ type: 'Ephemera RenderCache Finding', perspective: ['ASSET#x'], status: 'invalid' })).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({ type: 'Ephemera RenderCache Finding', perspective: ['NOT-ASSET#x'], status: 'missing' })).toBe(false)
                expect(isEphemeraRenderCacheFindingEvent({ type: 'Ephemera RenderCache Finding', perspective: ['ASSET#x'], status: 'missing', roomIds: ['NOT-ROOM#x'] })).toBe(false)
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
                perspective: ['ASSET#primitives', 'ASSET#core'],
                status: 'missing',
                diagnosticRunId: 'run-rc-3',
                timestamp: '2025-10-18T16:10:00.000Z',
                roomIds: ['ROOM#abc']
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
    })
})

