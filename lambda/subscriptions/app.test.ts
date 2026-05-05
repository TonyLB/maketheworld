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
            // Mock subscription match (matchAll returns array of handlers)
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.matchAll.mockReturnValue([mockMatch] as any)

            // Mock session ID
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            // Mock Subscribe API message for replayable DataSource
            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.assets.contentHeaders',
                streamKeys: ['ASSET#123'],
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

        it('should trigger snapshot initialization for mtw.wml (sidecar snapshot on subscribe)', async () => {
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.matchAll.mockReturnValue([mockMatch] as any)
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.wml',
                streamKeys: ['ASSET#123'],
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            const result = await handler(event)

            expect(mockMatch.subscribe).toHaveBeenCalledWith(
                subscribeRequest,
                'SESSION#test-session-id'
            )

            expect(eventBridgeClientMock.send).toHaveBeenCalledWith([{
                Source: 'mtw.subscriptions',
                DetailType: 'Initialize Subscription - mtw.wml',
                Detail: {
                    streamKey: 'ASSET#123',
                    sessionId: 'SESSION#test-session-id',
                    requestId: 'test-request-id'
                }
            }])

            expect(result.statusCode).toBe(200)
            expect(JSON.parse(result.body)).toEqual({
                messageType: 'Success',
                RequestId: 'test-request-id'
            })
        })

        it('should handle Subscribe API with no matching handler gracefully', async () => {
            // Mock no subscription match (matchAll returns empty array)
            subscriptionLibraryMock.matchAll.mockReturnValue([])

            // Mock Subscribe API message
            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.unknown',
                streamKeys: ['UNKNOWN#123'],
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            // Execute handler
            const result = await handler(event)

            // Verify no subscription setup
            expect(subscriptionLibraryMock.matchAll).toHaveBeenCalledWith(subscribeRequest)

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
            subscriptionLibraryMock.matchAll.mockReturnValue([mockMatch] as any)
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.assets.contentHeaders',
                streamKeys: ['ASSET#123'],
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

        it('should identify mtw.wml as snapshot-on-subscribe (triggers Initialize Subscription)', async () => {
            const mockMatch = {
                subscribe: jest.fn().mockResolvedValue(undefined)
            }
            subscriptionLibraryMock.matchAll.mockReturnValue([mockMatch] as any)
            internalCacheMock.Global.get.mockResolvedValue('test-session-id')

            const subscribeRequest = {
                message: 'subscribe',
                dataSourceKey: 'mtw.wml',
                streamKeys: ['ASSET#123'],
                RequestId: 'test-request-id'
            }

            const event = {
                requestContext: { connectionId: 'test-connection' },
                body: JSON.stringify(subscribeRequest)
            }

            await handler(event)

            expect(eventBridgeClientMock.send).toHaveBeenCalledWith([{
                Source: 'mtw.subscriptions',
                DetailType: 'Initialize Subscription - mtw.wml',
                Detail: expect.objectContaining({
                    streamKey: 'ASSET#123',
                    sessionId: 'SESSION#test-session-id',
                    requestId: 'test-request-id'
                })
            }])
        })
    })

    describe('Session Disconnect cleanup', () => {
        it('cleans stream rows by session DataCategory without Global/Sessions dependency', async () => {
            connectionDBMock.query.mockResolvedValue([
                {
                    ConnectionId: 'STREAM#mtw.assets.players::player-1',
                    DataCategory: 'SESSION#session-1'
                }
            ] as any)
            connectionDBMock.deleteItem.mockResolvedValue(undefined as any)

            const result = await handler({
                source: 'mtw.connections',
                'detail-type': 'Session Disconnect',
                detail: { sessionId: 'session-1' }
            })

            expect(connectionDBMock.query).toHaveBeenCalledWith({
                IndexName: 'DataCategoryIndex',
                Key: { DataCategory: 'SESSION#session-1' },
                KeyConditionExpression: 'begins_with(ConnectionId, :streamPrefix)',
                ExpressionAttributeValues: { ':streamPrefix': 'STREAM#' },
                ProjectionFields: ['ConnectionId']
            })
            expect(connectionDBMock.deleteItem).toHaveBeenCalledWith({
                ConnectionId: 'STREAM#mtw.assets.players::player-1',
                DataCategory: 'SESSION#session-1'
            })
            expect(internalCacheMock.Global.get).not.toHaveBeenCalledWith('sessions')
            expect(result).toEqual({
                statusCode: 200,
                body: '{}'
            })
        })
    })
})
