import { wmlDataSource } from './index'
import { WMLEventSerializer } from './serializers'
import { moveAsset } from './moveAsset'
import { MoveAssetRequest } from '../messageBus/baseClasses'

// Mock the moveAsset function
jest.mock('./moveAsset', () => ({
    moveAsset: jest.fn()
}))

// No need to mock messageBus baseClasses since we're testing behavior, not implementation

const moveAssetMock = moveAsset as jest.MockedFunction<typeof moveAsset>

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
        it('should recognize valid moveAsset events', () => {
            const validEvent = {
                dataSourceKey: 'internal',
                event: {
                    update: {
                        type: 'moveAsset',
                        assetId: 'test-asset',
                        fromZone: 'Library',
                        toZone: 'Canon'
                    }
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
                    update: {
                        type: 'moveAsset',
                        assetId: 'test-asset',
                        fromZone: 'Library',
                        toZone: 'Canon'
                    }
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
                type: 'moveAsset',
                assetId: 'test-asset',
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
                detailType: 'moveAssets',
                event: {
                    update: mockMoveRequest
                }
            }

            // Simulate the receiveEvents processing
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(moveAssetMock).toHaveBeenCalledWith(mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Changed',
                    AssetId: 'ASSET#test-asset',
                    fromZone: 'Library',
                    toZone: 'Canon'
                },
                streamKey: 'ASSET#test-asset',
                detailType: 'Zone Changed'
            })
        })

        it('should process failed moveAsset events without streaming', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'moveAsset',
                assetId: 'test-asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockResolvedValue({
                success: false,
                message: 'Move failed'
            })

            const event = {
                dataSourceKey: 'internal',
                detailType: 'moveAssets',
                event: {
                    update: mockMoveRequest
                }
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(moveAssetMock).toHaveBeenCalledWith(mockMoveRequest)
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle moveAsset events with optional fields', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'moveAsset',
                assetId: 'test-asset',
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
                detailType: 'moveAssets',
                event: {
                    update: mockMoveRequest
                }
            }

            // Simulate the receiveEvents processing
            await wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })

            expect(moveAssetMock).toHaveBeenCalledWith(mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalledWith({
                update: {
                    type: 'Zone Changed',
                    AssetId: 'ASSET#test-asset',
                    fromZone: 'Personal',
                    toZone: 'Library',
                    player: 'alice',
                    subFolder: 'test-folder'
                },
                streamKey: 'ASSET#test-asset',
                detailType: 'Zone Changed'
            })
        })

        it('should handle moveAsset processing errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            const mockMoveRequest: MoveAssetRequest = {
                type: 'moveAsset',
                assetId: 'test-asset',
                fromZone: 'Library',
                toZone: 'Canon'
            }

            moveAssetMock.mockRejectedValue(new Error('S3 operation failed'))

            const event = {
                dataSourceKey: 'internal',
                detailType: 'moveAssets',
                event: {
                    update: mockMoveRequest
                }
            }

            // Should not throw - errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })).resolves.not.toThrow()

            expect(moveAssetMock).toHaveBeenCalledWith(mockMoveRequest)
            expect(mockStreamEvent).not.toHaveBeenCalled()
        })

        it('should handle streaming errors gracefully', async () => {
            const mockStreamEvent = jest.fn().mockRejectedValue(new Error('Streaming failed'))
            const mockMoveRequest: MoveAssetRequest = {
                type: 'moveAsset',
                assetId: 'test-asset',
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
                detailType: 'moveAssets',
                event: {
                    update: mockMoveRequest
                }
            }

            // Should not throw - streaming errors should be caught and logged
            expect(wmlDataSource.receiveEvents).toBeDefined()
            await expect(wmlDataSource.receiveEvents!({
                events: [event as any],
                streamEvent: mockStreamEvent
            })).resolves.not.toThrow()

            expect(moveAssetMock).toHaveBeenCalledWith(mockMoveRequest)
            expect(mockStreamEvent).toHaveBeenCalled()
        })
    })
})
