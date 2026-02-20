import { 
    DiagnosticsEventSerializer,
    DiagnosticsEventUpdate,
    DiagnosticsEventExternal,
    isS3StructureFindingEvent,
    isDiagnosticsEventUpdate
} from './index'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const diagnosticsHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.diagnostics',
    streamKey: 'global',
    timestamp: 0,
    type
})

describe('DiagnosticsEventSerializer', () => {
    const serializer = new DiagnosticsEventSerializer()

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
            expect(internal?.diagnosticRunId).toBe('unknown')
            expect(internal?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)  // ISO 8601 format
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
    })
})

