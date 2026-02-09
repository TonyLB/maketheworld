import { wmlDataSource } from './index'
import { WMLEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { moveAsset } from './moveAsset'
import { MoveAssetRequest, isApplyEditRequest } from './coordinationSerializer'
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
            const validEvent = {
                dataSourceKey: 'internal',
                streamKey: 'test-asset',
                detailEnvelope: {
                    type: 'Move Asset',
                    fromZone: 'Library',
                    toZone: 'Canon'
                }
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(validEvent as any)
            expect(isRecognized).toBe(true)
        })

        it('should reject events with wrong dataSourceKey', () => {
            const invalidEvent = {
                dataSourceKey: 'mtw.assets',
                detailEnvelope: {
                    type: 'Move Asset',
                    assetId: 'test-asset',
                    fromZone: 'Library',
                    toZone: 'Canon'
                }
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(invalidEvent as any)
            expect(isRecognized).toBe(false)
        })

        it('should reject events with missing event structure', () => {
            const invalidEvent = {
                dataSourceKey: 'internal',
                detailEnvelope: null
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(invalidEvent as any)
            expect(isRecognized).toBe(false)
        })
    })

    describe('MoveAsset Event Processing', () => {
        it('should process successful moveAsset events', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: true,
                message: 'Successfully moved asset',
                newLocation: 'Canon/test-asset'
            })

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockMoveRequest
            }

            // Simulate the receiveEvents processing
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Changed',
                    fromZone: 'Library',
                    toZone: 'Canon'
                },
                streamKey: 'ASSET#test-asset'
            })
        })

        it('should process failed moveAsset events without streaming', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: false,
                message: 'Move failed'
            })

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockMoveRequest
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle moveAsset events with optional fields', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'Move Asset',
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
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockMoveRequest
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Changed',
                    fromZone: 'Personal',
                    toZone: 'Library',
                    player: 'alice',
                    subFolder: 'test-folder'
                },
                streamKey: 'ASSET#test-asset'
            })
        })

        it('should handle moveAsset processing errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockRejectedValue(new Error('S3 operation failed'))

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockMoveRequest
            }

            // Should not throw - errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })).resolves.not.toThrow()

            expect(moveAssetMock).toHaveBeenCalledWith('ASSET#test-asset', mockMoveRequest)
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle streaming errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockRejectedValue(new Error('Streaming failed'))
            const mockMoveRequest: MoveAssetRequest = {
                type: 'Move Asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: true,
                message: 'Successfully moved asset',
                newLocation: 'Canon/test-asset'
            })

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockMoveRequest
            }

            // Should not throw - streaming errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
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
                type: 'Apply Edit',
                RequestId: 'test-request-123',
                schema: validEditWML
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockApplyEditRequest
            }

            // Simulate the receiveEvents processing
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            // Verify applyEdit was called with correct parameters
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-123',
                schema: validEditWML
            })

            // Verify Content Update event was streamed with delta (edit WML) and RequestIds
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Content Update',
                    schema: expect.any(StandardForm),
                    RequestIds: ['test-request-123']
                },
                streamKey: 'ASSET#test-asset'
            })
            const streamedSchema = mockStreamEvent.mock.calls[0][0].update.schema
            expect(schemaToWML([streamedSchema.schema])).toBe(validEditWML)
        })

        it('should stream Merge Conflict event when applyEdit fails', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                type: 'Apply Edit',
                RequestId: 'test-request-456',
                schema: '<Asset uuid=(x)></Asset>'
            }

            const mockFailureResult: ApplyEditResult = {
                success: false,
                error: 'Parse error'
            }

            applyEditMock.mockResolvedValue(mockFailureResult)

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockApplyEditRequest
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            // Verify applyEdit was called
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-456',
                schema: '<Asset uuid=(x)></Asset>'
            })

            // Verify Merge Conflict event was streamed so client knows the edit failed
            expect(mockStreamEvent).toHaveBeenCalledWith({
                streamKey: 'ASSET#test-asset',
                update: { type: 'Merge Conflict', error: 'Parse error', RequestIds: ['test-request-456'] }
            })
        })

        it('should handle applyEdit processing errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                type: 'Apply Edit',
                RequestId: 'test-request-789',
                schema: validEditWML
            }

            applyEditMock.mockRejectedValue(new Error('WML processing failed'))

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockApplyEditRequest
            }

            // Should not throw - errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })).resolves.not.toThrow()

            // Verify applyEdit was called
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-789',
                schema: validEditWML
            })

            // Verify no Content Update event was streamed
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle streaming errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockRejectedValue(new Error('Streaming failed'))
            const mockApplyEditRequest = {
                type: 'Apply Edit',
                RequestId: 'test-request-999',
                schema: validEditWML
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockApplyEditRequest
            }

            // Should not throw - streaming errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
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
                type: 'Apply Edit',
                RequestId: 'test-request-000',
                schema: validEditWML
            }

            // Test with invalid streamKey (not a valid asset UUID)
            const event = {
                dataSourceKey: 'internal',
                streamKey: 'invalid!stream!key',
                detailEnvelope: mockApplyEditRequest
            }

            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            // Verify applyEdit was NOT called for invalid streamKey
            expect(applyEditMock).not.toHaveBeenCalled()
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should use singleFlight wrapper for applyEdit calls', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                type: 'Apply Edit',
                RequestId: 'test-request-singleflight',
                schema: validEditWML
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockApplyEditRequest
            }

            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            // Verify that singleFlight was used (the mock passthrough should have called applyEdit)
            expect(applyEditMock).toHaveBeenCalledWith({
                AssetId: 'ASSET#test-asset',
                RequestId: 'test-request-singleflight',
                schema: validEditWML
            })

            // Verify the result was processed correctly (Content Update carries delta)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Content Update',
                    schema: expect.any(StandardForm),
                    RequestIds: ['test-request-singleflight']
                },
                streamKey: 'ASSET#test-asset'
            })
            const streamedSchema = mockStreamEvent.mock.calls[0][0].update.schema
            expect(schemaToWML([streamedSchema.schema])).toBe(validEditWML)
        })

        it('should stream RequestIds empty array when Apply Edit payload has no RequestId', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockApplyEditRequest = {
                type: 'Apply Edit',
                schema: validEditWML
                // No RequestId
            }

            const mockSuccessResult: ApplyEditResult = {
                success: true,
                schema: { type: 'Asset', content: 'test-content' } as any
            }

            applyEditMock.mockResolvedValue(mockSuccessResult)

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: mockApplyEditRequest
            }

            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Content Update',
                    schema: expect.any(StandardForm),
                    RequestIds: []
                },
                streamKey: 'ASSET#test-asset'
            })
            const streamedSchema = mockStreamEvent.mock.calls[0][0].update.schema
            expect(schemaToWML([streamedSchema.schema])).toBe(validEditWML)
        })
    })

    describe('Diagnostics Event Type Guard', () => {
        it('should recognize valid S3 Structure Finding events', () => {
            const validEvent = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                detailEnvelope: {
                    type: 'S3 Structure Finding',
                    source: 'primitives.wml',
                    status: 'missing',
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(validEvent as any)
            expect(isRecognized).toBe(true)
        })

        it('should accept diagnostics events with any event structure', () => {
            // DataSource should accept mtw.diagnostics events even if we don't recognize the specific type yet
            const unknownDiagnosticsEvent = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                detailEnvelope: {
                    type: 'Future Event Type',
                    someField: 'someValue'
                }
            }

            expect(wmlDataSource.subscribedEventTypeGuard).toBeDefined()
            const isRecognized = wmlDataSource.subscribedEventTypeGuard!(unknownDiagnosticsEvent as any)
            expect(isRecognized).toBe(true)
        })
    })

    describe('S3 Structure Finding Event Processing', () => {
        it('should call initializePrimitives for missing primitives.wml', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            initializePrimitivesMock.mockResolvedValue({
                success: true,
                action: 'created',
                message: 'Primitives asset created'
            })

            const event = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                detailEnvelope: {
                    type: 'S3 Structure Finding',
                    source: 'primitives.wml',
                    status: 'missing',
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
            }

            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(initializePrimitivesMock).toHaveBeenCalled()
        })

        it('should not call initializePrimitives for present primitives.wml', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            const event = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                detailEnvelope: {
                    type: 'S3 Structure Finding',
                    source: 'primitives.wml',
                    status: 'present',  // Not missing
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
            }

            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(initializePrimitivesMock).not.toHaveBeenCalled()
        })

        it('should not call initializePrimitives for other S3 findings', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)

            const event = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                detailEnvelope: {
                    type: 'S3 Structure Finding',
                    source: 'other-asset.wml',  // Different source
                    status: 'missing',
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
            }

            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(initializePrimitivesMock).not.toHaveBeenCalled()
        })

        it('should handle initializePrimitives errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            initializePrimitivesMock.mockRejectedValue(new Error('Initialization failed'))

            const event = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                detailEnvelope: {
                    type: 'S3 Structure Finding',
                    source: 'primitives.wml',
                    status: 'missing',
                    diagnosticRunId: 'test-run-123',
                    timestamp: '2025-10-18T12:00:00.000Z'
                }
            }

            // Should not throw - errors should be caught and logged
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })).resolves.not.toThrow()

            expect(initializePrimitivesMock).toHaveBeenCalled()
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
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: {
                    type: 'Create Snapshot'
                }
            }

            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
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
                    type: 'Snapshot Created',
                    chunksBeforeSnapshot: 10,
                    snapshotSize: 10000  // 5000 + 5000
                },
                streamKey: 'ASSET#test-asset'
            })
        })

        it('should handle asset not found', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            
            // Mock AssetWorkspace.fromUUID to return undefined (asset not found)
            AssetWorkspaceMock.fromUUID.mockResolvedValue(undefined)

            const event = {
                dataSourceKey: 'internal',
                streamKey: 'ASSET#missing-asset',
                detailEnvelope: {
                    type: 'Create Snapshot'
                }
            }

            // Should not throw - errors should be caught and logged
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
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
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: {
                    type: 'Create Snapshot'
                }
            }

            // Should not throw - errors should be caught and logged
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
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
                dataSourceKey: 'internal',
                streamKey: 'ASSET#test-asset',
                detailEnvelope: {
                    type: 'Create Snapshot'
                }
            }

            // Should not throw - streaming errors should be caught
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
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
                    dataSourceKey: 'internal',
                    streamKey: 'ASSET#test-asset',
                    detailEnvelope: {
                        type: 'Create Snapshot'
                    }
                }

                await wmlDataSource.receiveEvents!({
                    events: [event as any],
                    streamEvent: mockStreamEvent
                })

                // Should pass the correct zone to createManualSnapshot
                expect(createManualSnapshotMock).toHaveBeenCalledWith(
                    expect.objectContaining({ zone })
                )
            }
        })
    })
})
