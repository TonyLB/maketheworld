jest.mock('./handlerFramework')
import { subscriptionLibrary } from "./handlerFramework"
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('@tonylb/mtw-utilities/ts/eventBridge')
import { eventBridgeClient } from '@tonylb/mtw-utilities/ts/eventBridge'
jest.mock('./internalCache')
import internalCache from "./internalCache"
import { handler } from './app'
import { isSubscribeAPIMessage } from "@tonylb/mtw-interfaces/ts/subscriptions"

// Mock the subscription library
const subscriptionLibraryMock = jest.mocked(subscriptionLibrary)
const connectionDBMock = jest.mocked(connectionDB)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('subscriptions app handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe('enhanced Subscribe API processing', () => {
        it('should trigger snapshot initialization for replayable DataSources', async () => {
            // Mock subscription match
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.match.mockReturnValue(mockMatch as any)

            // Mock session ID
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            // Mock Subscribe API message for replayable DataSource
            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.assets.contentHeaders',
                type: 'Content Headers Updated',
                streamKey: 'ASSET#123',
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            // Execute handler
            const result = await handler(event)

            // Verify subscription setup
            expect(mockMatch.subscribe).toHaveBeenCalledWith(
                subscribeRequest,
                'SESSION#test-session-id'
            )

            // Verify EventBridge publishing for snapshot initialization
            expect(eventBridgeClientMock.send).toHaveBeenCalledWith([{
                Source: 'mtw.subscriptions',
                DetailType: 'Initialize Subscription - mtw.assets.contentHeaders',
                Detail: {
                    streamKey: 'ASSET#123',
                    sessionId: 'SESSION#test-session-id',
                    requestId: 'test-request-id'
                }
            }])

            // Verify success response
            expect(result.statusCode).toBe(200)
            expect(JSON.parse(result.body)).toEqual({
                messageType: 'Success',
                RequestId: 'test-request-id'
            })
        })

        it('should NOT trigger snapshot initialization for non-replayable DataSources', async () => {
            // Mock subscription match
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.match.mockReturnValue(mockMatch as any)

            // Mock session ID
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            // Mock Subscribe API message for non-replayable DataSource (WML)
            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.wml',
                type: 'Content Update',
                streamKey: 'ASSET#123',
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            // Execute handler
            const result = await handler(event)

            // Verify subscription setup
            expect(mockMatch.subscribe).toHaveBeenCalledWith(
                subscribeRequest,
                'SESSION#test-session-id'
            )

            // Verify EventBridge publishing is NOT called for non-replayable DataSources
            expect(eventBridgeClientMock.send).not.toHaveBeenCalled()

            // Verify success response
            expect(result.statusCode).toBe(200)
            expect(JSON.parse(result.body)).toEqual({
                messageType: 'Success',
                RequestId: 'test-request-id'
            })
        })

        it('should handle Subscribe API with no matching handler gracefully', async () => {
            // Mock no subscription match
            subscriptionLibraryMock.match.mockReturnValue(undefined)

            // Mock Subscribe API message
            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.unknown',
                type: 'Unknown Type',
                streamKey: 'UNKNOWN#123',
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            // Execute handler
            const result = await handler(event)

            // Verify no subscription setup
            expect(subscriptionLibraryMock.match).toHaveBeenCalledWith(subscribeRequest)

            // Verify EventBridge publishing is NOT called
            expect(eventBridgeClientMock.send).not.toHaveBeenCalled()

            // Verify success response (even when no match)
            expect(result.statusCode).toBe(200)
            expect(JSON.parse(result.body)).toEqual({
                messageType: 'Success',
                RequestId: 'test-request-id'
            })
        })
    })

    describe('isReplayableDataSource helper function', () => {
        it('should identify mtw.assets.contentHeaders as replayable', async () => {
            // This test verifies the helper function works by testing the Subscribe API behavior
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.match.mockReturnValue(mockMatch as any)
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.assets.contentHeaders',
                type: 'Content Headers Updated',
                streamKey: 'ASSET#123',
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            await handler(event)

            // Verify EventBridge was called (indicating replayable DataSource)
            expect(eventBridgeClientMock.send).toHaveBeenCalled()
        })

        it('should identify mtw.wml as non-replayable', async () => {
            // This test verifies the helper function works by testing the Subscribe API behavior
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.match.mockReturnValue(mockMatch as any)
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.wml',
                type: 'Content Update',
                streamKey: 'ASSET#123',
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            await handler(event)

            // Verify EventBridge was NOT called (indicating non-replayable DataSource)
            expect(eventBridgeClientMock.send).not.toHaveBeenCalled()
        })
    })
})
