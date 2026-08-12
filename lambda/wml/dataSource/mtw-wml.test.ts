import { wmlDataSource } from './index'
import { WMLEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { moveAsset } from './moveAsset'
import { MoveAssetRequest, isApplyEditRequest } from './localApiEvents'
import { initializePrimitives } from './initializePrimitives'
import { createManualSnapshot } from '../s3Storage/manifest/orchestration'
import AssetWorkspace from '../s3Storage/AssetWorkspace'
import { applyEdit } from './applyEdit'
import { ApplyEditResult } from './applyEdit'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'

// Mock the moveAsset, initializePrimitives, and createManualSnapshot functions
jest.mock('./moveAsset', () => ({
    moveAsset: jest.fn()
}))

jest.mock('./initializePrimitives', () => ({
    initializePrimitives: jest.fn()
}))

jest.mock('../s3Storage/manifest/orchestration', () => ({
    createManualSnapshot: jest.fn()
}))

jest.mock('../s3Storage/AssetWorkspace', () => ({
    __esModule: true,
    default: {
        fromUUID: jest.fn()
    }
}))

// Mock applyEdit function
jest.mock('./applyEdit', () => ({
    applyEdit: jest.fn()
}))

// Mock singleFlight factory to simply execute the computation as a passthrough
jest.mock('@tonylb/mtw-lambda-patterns/ts/singleFlight', () => ({
    singleFlightFactory: jest.fn(() => {
        return jest.fn(async (params: any) => {
            // Simple passthrough - just execute the computation function
            return await params.computation()
        })
    })
}))

// No need to mock messageBus baseClasses since we're testing behavior, not implementation

const moveAssetMock = moveAsset as jest.MockedFunction<typeof moveAsset>
const initializePrimitivesMock = initializePrimitives as jest.MockedFunction<typeof initializePrimitives>
const createManualSnapshotMock = createManualSnapshot as jest.MockedFunction<typeof createManualSnapshot>
const AssetWorkspaceMock = AssetWorkspace as jest.Mocked<typeof AssetWorkspace>
const applyEditMock = applyEdit as jest.MockedFunction<typeof applyEdit>

describe('WML DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Basic Configuration', () => {
    it('should create wmlDataSource instance', () => {
        expect(wmlDataSource).toBeDefined()
        expect(wmlDataSource.dataSourceKey).toBe('mtw.wml')
        expect(wmlDataSource.replayable).toBe(true)
    })

    it('should have event serializer configured', () => {
        const serializer = wmlDataSource.getSerializer()
        expect(serializer).toBeInstanceOf(WMLEventSerializer)
    })

        it('should have correct data source configuration', () => {
            expect(wmlDataSource.dataSourceKey).toBe('mtw.wml')
            expect(wmlDataSource.replayable).toBe(true)
            expect(wmlDataSource.getSerializer()).toBeDefined()
        })
    })

    describe('Event Type Guard', () => {
        it('should recognize valid Move Asset events', () => {
            const validEnvelope = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve({})
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(validEnvelope)
            expect(isRecognized).toBe(true)
        })

        it('should reject events with wrong dataSourceKey', () => {
            const invalidEnvelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve({})
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(invalidEnvelope)
            expect(isRecognized).toBe(false)
        })

        it('should reject events with non-coordination type', () => {
            const invalidEnvelope = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'test-asset',
                    timestamp: 0,
                    type: 'UnknownType'
                },
                getContent: () => Promise.resolve({})
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(invalidEnvelope)
            expect(isRecognized).toBe(false)
        })
    })

    describe('MoveAsset Event Processing', () => {
        it('should process successful moveAsset events', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: true,
                message: 'Successfully moved asset',
                newLocation: 'Canon/test-asset'
            })

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve(mockMoveRequest)
            }

            // Simulate the receiveEvents processing
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    fromZone: 'Library',
                    toZone: 'Canon'
                },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Zone Changed' }
            })
        })

        it('should process failed moveAsset events without streaming', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: false,
                message: 'Move failed'
            })

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve(mockMoveRequest)
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle moveAsset events with optional fields', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                fromZone: 'Personal',
                toZone: 'Library',
                player: 'alice',
                subFolder: 'test-folder'
            }

            moveAssetMock.mockResolvedValue({
                success: true,
                message: 'Successfully moved asset',
                newLocation: 'Library/test-asset'
            })

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve(mockMoveRequest)
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    fromZone: 'Personal',
                    toZone: 'Library',
                    player: 'alice',
                    subFolder: 'test-folder'
                },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Zone Changed' }
            })
        })

        it('should handle moveAsset processing errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockRejectedValue(new Error('S3 operation failed'))

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve(mockMoveRequest)
            }

            // Should not throw - errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle streaming errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockRejectedValue(new Error('Streaming failed'))
            const mockMoveRequest: MoveAssetRequest = {
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: true,
                message: 'Successfully moved asset',
                newLocation: 'Canon/test-asset'
            })

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Move Asset'
                },
                getContent: () => Promise.resolve(mockMoveRequest)
            }

            // Should not throw - streaming errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalled()
        })
    })

    describe('Apply Edit Event Processing', () => {
        const validEditWML = '<Asset uuid=(test-asset) />'

        it('should process successful applyEdit events', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                RequestId: 'test-request-123',
                schema: validEditWML
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Apply Edit' as const
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            // Simulate the receiveEvents processing
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify applyEdit was called with correct parameters
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-123',
                schema: validEditWML
            })

            // Verify Content Update event was streamed with delta (edit WML); RequestIds in header
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { schema: expect.any(StandardForm) },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Content Update', RequestIds: ['test-request-123'] }
            })
            const streamedSchema = mockStreamEvent.mock.calls[0][0].update.schema
            expect(schemaToWML([streamedSchema.schema])).toBe(validEditWML)
        })

        it('should stream Merge Conflict event when applyEdit fails', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                RequestId: 'test-request-456',
                schema: '<Asset uuid=(x)></Asset>'
            }

            const mockFailureResult: ApplyEditResult = {
                success: false,
                error: 'Parse error'
            }

            applyEditMock.mockResolvedValue(mockFailureResult)

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Apply Edit' as const
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify applyEdit was called
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-456',
                schema: '<Asset uuid=(x)></Asset>'
            })

            // Verify Merge Conflict event was streamed so client knows the edit failed; RequestIds in header
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'ASSET#test-asset',
                update: { error: 'Parse error' },
                header: { type: 'Merge Conflict', RequestIds: ['test-request-456'] }
            })
        })

        it('should handle applyEdit processing errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                RequestId: 'test-request-789',
                schema: validEditWML
            }

            applyEditMock.mockRejectedValue(new Error('WML processing failed'))

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Apply Edit' as const
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            // Should not throw - errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            // Verify applyEdit was called
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-789',
                schema: validEditWML
            })

            // Verify Merge Conflict event was streamed so client knows the edit failed; RequestIds in header
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'ASSET#test-asset',
                update: { error: 'WML processing failed' },
                header: { type: 'Merge Conflict', RequestIds: ['test-request-789'] }
            })
        })

        it('should handle streaming errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockRejectedValue(new Error('Streaming failed'))
            const mockApplyEditRequest = {
                RequestId: 'test-request-999',
                schema: validEditWML
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Apply Edit' as const
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            // Should not throw - streaming errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            // Verify applyEdit was called
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-999',
                schema: validEditWML
            })

            // Verify streaming was attempted
            expect(mockStreamEvent).toHaveBeenCalled()
        })

        it('should only process Apply Edit events for valid asset UUIDs', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                RequestId: 'test-request-000',
                schema: validEditWML
            }

            // Test with invalid streamKey (not a valid asset UUID)
            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'invalid!stream!key',
                    timestamp: 0,
                    type: 'Apply Edit' as const
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify applyEdit was NOT called for invalid streamKey
            expect(applyEditMock).not.toHaveBeenCalled()
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should use singleFlight wrapper for applyEdit calls', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                RequestId: 'test-request-singleflight',
                schema: validEditWML
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Apply Edit' as const
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Verify that singleFlight was used (the mock passthrough should have called applyEdit)
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-singleflight',
                schema: validEditWML
            })

            // Verify the result was processed correctly (Content Update carries delta); RequestIds in header
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { schema: expect.any(StandardForm) },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Content Update', RequestIds: ['test-request-singleflight'] }
            })
            const streamedSchema = mockStreamEvent.mock.calls[0][0].update.schema
            expect(schemaToWML([streamedSchema.schema])).toBe(validEditWML)
        })

        it('should stream RequestIds empty array when Apply Edit payload has no RequestId', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                schema: validEditWML
                // No RequestId
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Apply Edit' 
                },
                getContent: () => Promise.resolve(mockApplyEditRequest)
            }

            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { schema: expect.any(StandardForm) },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Content Update', RequestIds: [] }
            })
            const streamedSchema = mockStreamEvent.mock.calls[0][0].update.schema
            expect(schemaToWML([streamedSchema.schema])).toBe(validEditWML)
        })
    })

    describe('Diagnostics Event Type Guard', () => {
        it('should recognize valid S3 Structure Finding events', () => {
            const validEnvelope = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: 0,
                    type: 'S3 Structure Finding'
                },
                getContent: () => Promise.resolve({})
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(validEnvelope)
            expect(isRecognized).toBe(true)
        })

        it('should accept diagnostics events with any event structure', () => {
            const unknownDiagnosticsEnvelope = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: 0,
                    type: 'Future Event Type'
                },
                getContent: () => Promise.resolve({})
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(unknownDiagnosticsEnvelope)
            expect(isRecognized).toBe(true)
        })
    })

    describe('S3 Structure Finding Event Processing', () => {
        it('should call initializePrimitives for missing primitives.wml', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockSchema = new StandardForm('<Asset uuid=(primitives)><Room uuid=(VORTEX) /><Knowledge uuid=(knowledgeRoot) /><Situation uuid=(DEFAULT)><ShortName>Default</ShortName></Situation></Asset>')

            initializePrimitivesMock.mockResolvedValue({
                success: true,
                action: 'created',
                message: 'Primitives asset created',
                schema: mockSchema
            })

            const event = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: 0,
                    type: 'S3 Structure Finding' as const
                },
                getContent: () => Promise.resolve({
                    type: 'S3 Structure Finding' as const,
                    source: 'primitives.wml',
                    status: 'missing' as const,
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                })
            }

            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(initializePrimitivesMock).toHaveBeenCalled()
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { schema: mockSchema },
                streamKey: 'ASSET#primitives',
                header: { type: 'Content Update', RequestIds: [] }
            })
        })

        it('should not call initializePrimitives for present primitives.wml', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            const event = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: 0,
                    type: 'S3 Structure Finding' as const
                },
                getContent: () => Promise.resolve({
                    type: 'S3 Structure Finding' as const,
                    source: 'primitives.wml',
                    status: 'present' as const,  // Not missing
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                })
            }

            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(initializePrimitivesMock).not.toHaveBeenCalled()
        })

        it('should not call initializePrimitives for other S3 findings', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            const event = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: 0,
                    type: 'S3 Structure Finding' as const
                },
                getContent: () => Promise.resolve({
                    type: 'S3 Structure Finding' as const,
                    source: 'other-asset.wml',  // Different source
                    status: 'missing' as const,
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                })
            }

            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(initializePrimitivesMock).not.toHaveBeenCalled()
        })

        it('should handle initializePrimitives errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            initializePrimitivesMock.mockRejectedValue(new Error('Initialization failed'))

            const event = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: 0,
                    type: 'S3 Structure Finding' as const
                },
                getContent: () => Promise.resolve({
                    type: 'S3 Structure Finding' as const,
                    source: 'primitives.wml',
                    status: 'missing' as const,
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                })
            }

            // Should not throw - errors should be caught and logged
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(initializePrimitivesMock).toHaveBeenCalled()
        })
    })

    describe('WML Materialized View Finding Event Processing', () => {
        const makeEvent = (assetId: string) => ({
            header: {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                timestamp: 0,
                type: 'WML Materialized View Finding' as const
            },
            getContent: () => Promise.resolve({
                type: 'WML Materialized View Finding' as const,
                assetId,
                diagnosticRunId: 'test-run-456',
                timestamp: '2025-10-18T12:00:00.000Z'
            })
        })

        it('should reparse .wml, rewrite .ndjson, and publish Content Update', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStandardForm = new StandardForm('<Asset uuid=(test-asset)><Room uuid=(VORTEX) /></Asset>')

            const workspace: any = {
                standard: undefined,
                loadWML: jest.fn().mockImplementation(async function (this: any) {
                    this.standard = mockStandardForm
                }),
                pushJSON: jest.fn().mockResolvedValue(undefined)
            }
            AssetWorkspaceMock.fromUUID.mockResolvedValue(workspace)

            await wmlDataSource.receiveEvents!({
                events: [makeEvent('ASSET#test-asset')],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(AssetWorkspaceMock.fromUUID).toHaveBeenCalledWith('ASSET#test-asset', { preferDynamo: false, allowS3Fallback: true })
            expect(workspace.loadWML).toHaveBeenCalled()
            expect(workspace.pushJSON).toHaveBeenCalled()
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: { schema: mockStandardForm },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Content Update', RequestIds: [] }
            })
        })

        it('should be idempotent when run twice against the same asset', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStandardForm = new StandardForm('<Asset uuid=(test-asset)><Room uuid=(VORTEX) /></Asset>')

            const workspace: any = {
                standard: undefined,
                loadWML: jest.fn().mockImplementation(async function (this: any) {
                    this.standard = mockStandardForm
                }),
                pushJSON: jest.fn().mockResolvedValue(undefined)
            }
            AssetWorkspaceMock.fromUUID.mockResolvedValue(workspace)

            const event = makeEvent('ASSET#test-asset')
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(workspace.pushJSON).toHaveBeenCalledTimes(2)
            expect(mockStreamEvent).toHaveBeenCalledTimes(2)
        })

        it('should no-op when the asset workspace is not found', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            AssetWorkspaceMock.fromUUID.mockResolvedValue(undefined)

            await wmlDataSource.receiveEvents!({
                events: [makeEvent('ASSET#missing-asset')],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should skip pushJSON and streamEvent when the .wml load fails, to avoid overwriting .ndjson with empty content', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            const workspace: any = {
                standard: undefined,
                status: { wml: 'Clean' },
                loadWML: jest.fn().mockImplementation(async function (this: any) {
                    this.status.wml = 'Error'
                }),
                pushJSON: jest.fn().mockResolvedValue(undefined)
            }
            AssetWorkspaceMock.fromUUID.mockResolvedValue(workspace)

            await wmlDataSource.receiveEvents!({
                events: [makeEvent('ASSET#test-asset')],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(workspace.loadWML).toHaveBeenCalled()
            expect(workspace.pushJSON).not.toHaveBeenCalled()
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should normalize a bare assetId to ASSET#-prefixed form', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockStandardForm = new StandardForm('<Asset uuid=(test-asset)><Room uuid=(VORTEX) /></Asset>')

            const workspace: any = {
                standard: undefined,
                loadWML: jest.fn().mockImplementation(async function (this: any) {
                    this.standard = mockStandardForm
                }),
                pushJSON: jest.fn().mockResolvedValue(undefined)
            }
            AssetWorkspaceMock.fromUUID.mockResolvedValue(workspace)

            await wmlDataSource.receiveEvents!({
                events: [makeEvent('test-asset')],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            expect(AssetWorkspaceMock.fromUUID).toHaveBeenCalledWith('ASSET#test-asset', { preferDynamo: false, allowS3Fallback: true })
        })
    })

    describe('Create Snapshot Event Processing', () => {
        it('should process successful snapshot creation', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock AssetWorkspace.fromUUID to return a workspace with zone
            AssetWorkspaceMock.fromUUID.mockResolvedValue({
                zone: 'Library'
            } as any)
            
            // Mock createManualSnapshot to return success for both content and auth
            createManualSnapshotMock.mockResolvedValue({
                success: true,
                snapshotReference: {
                    s3Key: 'test.wml/snapshots/1729260000000.wml',
                    snapshotSize: 5000
                },
                chunksBeforeSnapshot: 10
            })

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Create Snapshot' as const
                },
                getContent: () => Promise.resolve({})
            }

            await wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })

            // Should load asset workspace
            expect(AssetWorkspaceMock.fromUUID).toHaveBeenCalledWith('ASSET#test-asset')
            
            // Should create snapshots for both content and auth
            expect(createManualSnapshotMock).toHaveBeenCalledTimes(2)
            expect(createManualSnapshotMock).toHaveBeenCalledWith({
                prefix: 'test-asset.wml/',
                zone: 'Library'
            })
            expect(createManualSnapshotMock).toHaveBeenCalledWith({
                prefix: 'test-asset.auth.wml/',
                zone: 'Library'
            })
            
            // Should stream Snapshot Created event
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    chunksBeforeSnapshot: 10,
                    snapshotSize: 10000  // 5000 + 5000
                },
                streamKey: 'ASSET#test-asset',
                header: { type: 'Snapshot Created' }
            })
        })

        it('should handle asset not found', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock AssetWorkspace.fromUUID to return undefined (asset not found)
            AssetWorkspaceMock.fromUUID.mockResolvedValue(undefined)

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#missing-asset',
                    timestamp: 0,
                    type: 'Create Snapshot' as const
                },
                getContent: () => Promise.resolve({})
            }

            // Should not throw - errors should be caught and logged
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(AssetWorkspaceMock.fromUUID).toHaveBeenCalledWith('ASSET#missing-asset')
            expect(createManualSnapshotMock).not.toHaveBeenCalled()
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle snapshot creation errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            AssetWorkspaceMock.fromUUID.mockResolvedValue({
                zone: 'Canon'
            } as any)
            
            // Mock createManualSnapshot to throw error
            createManualSnapshotMock.mockRejectedValue(new Error('S3 error'))

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Create Snapshot' as const
                },
                getContent: () => Promise.resolve({})
            }

            // Should not throw - errors should be caught and logged
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(createManualSnapshotMock).toHaveBeenCalled()
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle streaming errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockRejectedValue(new Error('Streaming failed'))
            
            AssetWorkspaceMock.fromUUID.mockResolvedValue({
                zone: 'Personal'
            } as any)
            
            createManualSnapshotMock.mockResolvedValue({
                success: true,
                snapshotReference: {
                    s3Key: 'test.wml/snapshots/1729260000000.wml',
                    snapshotSize: 3000
                },
                chunksBeforeSnapshot: 5
            })

            const event = {
                header: {
                    dataSourceKey: 'api.wml',
                    streamKey: 'ASSET#test-asset',
                    timestamp: 0,
                    type: 'Create Snapshot' as const
                },
                getContent: () => Promise.resolve({})
            }

            // Should not throw - streaming errors should be caught
            await expect(wmlDataSource.receiveEvents!({
                events: [event],
                streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
            })).resolves.not.toThrow()

            expect(createManualSnapshotMock).toHaveBeenCalled()
            expect(mockStreamEvent).toHaveBeenCalled()
        })

        it('should work with different zones', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const zones = ['Personal', 'Draft', 'Library', 'Canon'] as const

            for (const zone of zones) {
                jest.clearAllMocks()
                
                AssetWorkspaceMock.fromUUID.mockResolvedValue({
                    zone
                } as any)
                
                createManualSnapshotMock.mockResolvedValue({
                    success: true,
                    snapshotReference: {
                        s3Key: `test.wml/snapshots/${Date.now()}.wml`,
                        snapshotSize: 1000
                    },
                    chunksBeforeSnapshot: 0
                })

                const event = {
                    header: {
                        dataSourceKey: 'api.wml',
                        streamKey: 'ASSET#test-asset',
                        timestamp: 0,
                        type: 'Create Snapshot' as const
                    },
                    getContent: () => Promise.resolve({})
                }

                await wmlDataSource.receiveEvents!({
                    events: [event],
                    streamEvent: mockStreamEvent,
                streamEnvelope: jest.fn().mockResolvedValue(undefined)
                })

                // Should pass the correct zone to createManualSnapshot
                expect(createManualSnapshotMock).toHaveBeenCalledWith(
                    expect.objectContaining({ zone })
                )
            }
        })
    })
})
