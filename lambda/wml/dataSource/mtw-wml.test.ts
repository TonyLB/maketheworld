import { wmlDataSource } from './index'
import { WMLEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { moveAsset } from './moveAsset'
import { MoveAssetRequest } from './coordinationSerializer'
import { initializePrimitives } from './initializePrimitives'

// Mock the moveAsset and initializePrimitives functions
jest.mock('./moveAsset', () => ({
    moveAsset: jest.fn()
}))

jest.mock('./initializePrimitives', () => ({
    initializePrimitives: jest.fn()
}))

// No need to mock messageBus baseClasses since we're testing behavior, not implementation

const moveAssetMock = moveAsset as jest.MockedFunction<typeof moveAsset>
const initializePrimitivesMock = initializePrimitives as jest.MockedFunction<typeof initializePrimitives>

describe('WML DataSource', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('Basic Configuration', () => {
    it('should create wmlDataSource instance', () => {
        expect(wmlDataSource).toBeDefined()
        expect(wmlDataSource.dataSourceKey).toBe('mtw.wml')
        expect(wmlDataSource.replayable).toBe(false)
    })

    it('should have event serializer configured', () => {
        const serializer = wmlDataSource.getSerializer()
        expect(serializer).toBeInstanceOf(WMLEventSerializer)
    })

        it('should have correct data source configuration', () => {
            expect(wmlDataSource.dataSourceKey).toBe('mtw.wml')
            expect(wmlDataSource.replayable).toBe(false)
            expect(wmlDataSource.getSerializer()).toBeDefined()
        })
    })

    describe('Event Type Guard', () => {
        it('should recognize valid Move Asset events', () => {
            const validEvent = {
                dataSourceKey: 'internal',
                streamKey: 'test-asset',
                event: {
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
                event: {
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
                event: null
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
                event: mockMoveRequest
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
                event: mockMoveRequest
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
                event: mockMoveRequest
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
                event: mockMoveRequest
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
                event: mockMoveRequest
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

    describe('Diagnostics Event Type Guard', () => {
        it('should recognize valid S3 Structure Finding events', () => {
            const validEvent = {
                dataSourceKey: 'mtw.diagnostics',
                streamKey: 'global',
                event: {
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
                event: {
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
                event: {
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
                event: {
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
                event: {
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
                event: {
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
})
