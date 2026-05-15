jest.mock('../apiClient')
import { apiClient } from "../apiClient"
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('../internalCache')
import internalCache from "../internalCache"
import { isSubscriptionClientMessage, type SubscriptionClientMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import {
    isWMLContentEventExternal,
    WMLDataSourceEventSerializer,
    isWMLContentUpdateEvent,
    isWMLMergeConflictEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { subscriptionLibrary, subscriptionLibraryConstructor } from '.'
import { toEventBridgeFormat, fromEventBridgeFormat, fromWebSocketFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import { LibraryEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/library'
import { PlayerEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/players'
import {
    isContentHeadersExternal,
    ContentHeadersEventSerializer,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets/contentHeaders'
import {
    ThinkingEventSerializer,
    THINKING_JOB_COMPLETED_HEADER_TYPE,
    THINKING_SCHEMA_VERSION_INITIAL,
    isThinkingJobCompletedEvent,
    isThinkingSchedulingExternal
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

const connectionDBMock = jest.mocked(connectionDB)
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('subscription handlerFramework', () => {
    const testLibrary = subscriptionLibraryConstructor([
        {
            dataSourceKey: 'noDetails',
            transform: (event) => ({
                messageType: 'StreamEvent',
                eventType: 'Content Update',
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#TEST',
                timestamp: event.header?.timestamp,
                update: { type: 'Content Update', RequestId: 'req-no-details', wml: '' }
            })
        },
        {
            dataSourceKey: 'detailsOne',
            type: 'TestOne',
            transform: (event) => ({
                messageType: 'StreamEvent',
                eventType: 'Merge Conflict',
                dataSourceKey: 'mtw.wml',
                streamKey: event.header?.streamKey,
                timestamp: event.header?.timestamp,
                update: {
                    type: 'Merge Conflict',
                    RequestId: event.update?.RequestId
                }
            })
        },
        {
            dataSourceKey: 'mtw.assets.contentHeaders',
            type: 'Headers Updated',
            transform: (event) => ({
                messageType: 'StreamEvent',
                eventType: 'Headers Updated',
                dataSourceKey: 'mtw.assets.contentHeaders',
                streamKey: event.header?.streamKey,
                timestamp: event.header?.timestamp,
                update: {
                    type: 'Headers Updated',
                    assetId: event.update?.assetId || 'ASSET#unknown',
                    zone: event.update?.zone || 'Canon',
                    wml: event.update?.wml || ''
                }
            })
        },
        {
            dataSourceKey: 'mtw.assets.players',
            transform: (event) => ({
                messageType: 'StreamEvent',
                eventType: event.update?.type || '',
                dataSourceKey: 'mtw.assets.players',
                streamKey: event.header?.streamKey,
                timestamp: event.header?.timestamp,
                update: {
                    ...event.update,
                    ...(event.RequestId ? { RequestId: event.RequestId } : {})
                }
            })
        }
    ])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should match an event with no details', () => {
        const coreNoDetails = {
            header: {
                dataSourceKey: 'noDetails',
                streamKey: '',
                timestamp: 0,
                type: 'any'
            },
            update: { type: 'any' }
        }
        const coreNoMatch = {
            header: {
                dataSourceKey: 'noMatch',
                streamKey: '',
                timestamp: 0,
                type: 'any'
            },
            update: { type: 'any' }
        }
        expect(testLibrary.matchEvent(coreNoDetails)?._dataSourceKey).toEqual('noDetails')
        expect(testLibrary.matchEvent(coreNoMatch)).toBeFalsy()
    })

    it('should match an event with type', () => {
        const coreMatch = {
            header: {
                dataSourceKey: 'detailsOne',
                streamKey: 'ASSET#XYZ',
                timestamp: 0,
                type: 'TestOne'
            },
            update: { type: 'TestOne' }
        }
        const coreNoMatch = {
            header: {
                dataSourceKey: 'detailsOne',
                streamKey: 'ASSET#XYZ',
                timestamp: 0,
                type: 'NoMatch'
            },
            update: { type: 'NoMatch' }
        }
        expect(testLibrary.matchEvent(coreMatch)?._dataSourceKey).toEqual('detailsOne')
        expect(testLibrary.matchEvent(coreNoMatch)).toBeFalsy()
    })

    it('should match on header.type when both header and update present (header is authoritative)', () => {
        const eventWithHeader = {
            dataSourceKey: 'detailsOne',
            streamKey: 'ASSET#XYZ',
            timestamp: 1234567890,
            header: { dataSourceKey: 'detailsOne', streamKey: 'ASSET#XYZ', timestamp: 1234567890, type: 'TestOne' },
            update: { type: 'NoMatch' }
        }
        expect(testLibrary.matchEvent(eventWithHeader)?._dataSourceKey).toEqual('detailsOne')
        const eventWithMismatchedHeader = {
            dataSourceKey: 'detailsOne',
            streamKey: 'ASSET#XYZ',
            timestamp: 1234567890,
            header: { dataSourceKey: 'detailsOne', streamKey: 'ASSET#XYZ', timestamp: 1234567890, type: 'NoMatch' },
            update: { type: 'TestOne' }
        }
        expect(testLibrary.matchEvent(eventWithMismatchedHeader)).toBeFalsy()
    })

    describe('default subscription message (no transform, wireFormatsFromCoreFormat adapter)', () => {
        const defaultPathLibrary = subscriptionLibraryConstructor([
            {
                dataSourceKey: 'mtw.assets.players'
            }
        ])

        it('uses webSocketFormat when handler has no transform and sends valid SubscriptionClientMessage', async () => {
            connectionDBMock.query.mockResolvedValue([{
                ConnectionId: 'STREAM#mtw.assets.players::player99',
                DataCategory: 'SESSION#S1'
            }])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#C1'])
            const coreFormat = {
                header: {
                    dataSourceKey: 'mtw.assets.players',
                    streamKey: 'player99',
                    timestamp: 999,
                    type: 'Player Settings Updated',
                    RequestId: 'req-default'
                },
                update: { type: 'Player Settings Updated', settings: { onboardCompleteTags: [] } }
            }
            const match = defaultPathLibrary.matchEvent(coreFormat)
            expect(match).toBeDefined()
            await match!.publish(coreFormat)
            expect(apiClientMock.send).toHaveBeenCalledWith('C1', expect.any(Object))
            const sentMessage = apiClientMock.send.mock.calls[0][1]
            expect(isSubscriptionClientMessage(sentMessage)).toBe(true)
            expect(sentMessage).toMatchObject({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.assets.players',
                streamKey: 'player99',
                timestamp: 999,
                update: { type: 'Player Settings Updated', settings: { onboardCompleteTags: [] } },
                RequestId: 'req-default'
            })
        })

    })

    it('should subscribe with no details', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        await testLibrary.match({ dataSourceKey: 'noDetails', streamKey: '', type: 'any' })?.subscribe({ message: 'subscribe', dataSourceKey: 'noDetails', streamKeys: ['stream1', 'stream2'] }, `SESSION#ABCD`)
        expect(connectionDBMock.putItem).toHaveBeenCalledTimes(2)
        expect(connectionDBMock.putItem).toHaveBeenCalledWith({
            ConnectionId: 'STREAM#noDetails::stream1',
            DataCategory: 'SESSION#ABCD'
        })
        expect(connectionDBMock.putItem).toHaveBeenCalledWith({
            ConnectionId: 'STREAM#noDetails::stream2',
            DataCategory: 'SESSION#ABCD'
        })
    })

    it('should subscribe with streamKey', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        await testLibrary.match({ dataSourceKey: 'detailsOne', streamKey: 'XYZ', type: 'TestOne' })?.subscribe({ message: 'subscribe', dataSourceKey: 'detailsOne', streamKeys: ['XYZ'] }, `SESSION#ABCD`)
        expect(connectionDBMock.putItem).toHaveBeenCalledWith({
            ConnectionId: 'STREAM#detailsOne::TestOne::XYZ',
            DataCategory: 'SESSION#ABCD'
        })
    })

    it('should publish to subscription with no details', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#noDetails::testStream',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        const coreEvent = {
            header: {
                dataSourceKey: 'noDetails',
                streamKey: 'testStream',
                timestamp: 1234567890,
                type: 'any'
            },
            update: { type: 'any' }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#noDetails::testStream' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', {
            messageType: 'StreamEvent',
            eventType: 'Content Update',
            dataSourceKey: 'mtw.wml',
            streamKey: 'ASSET#TEST',
            timestamp: 1234567890,
            update: { type: 'Content Update', RequestId: 'req-no-details', wml: '' }
        })
    })

    it('should publish to subscription with details', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        const coreEvent = {
            header: {
                dataSourceKey: 'detailsOne',
                streamKey: 'ASSET#XYZ',
                timestamp: 1234567890,
                type: 'TestOne'
            },
            update: { type: 'TestOne', RequestId: 'qrstuv' }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', {
            messageType: 'StreamEvent',
            eventType: 'Merge Conflict',
            dataSourceKey: 'mtw.wml',
            streamKey: 'ASSET#XYZ',
            timestamp: 1234567890,
            update: { type: 'Merge Conflict', RequestId: 'qrstuv' }
        })
    })

    it('should handle content headers events', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456',
            DataCategory: 'SESSION#EFGH'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#WXYZ'])
        const coreEvent = {
            header: {
                dataSourceKey: 'mtw.assets.contentHeaders',
                streamKey: 'ASSET#456',
                timestamp: 1234567890,
                type: 'Headers Updated'
            },
            update: { type: 'Headers Updated', assetId: 'ASSET#456', zone: 'Canon', wml: 'test wml' }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('WXYZ', { 
            messageType: 'StreamEvent',
            eventType: 'Headers Updated',
            dataSourceKey: 'mtw.assets.contentHeaders', 
            streamKey: 'ASSET#456', 
            timestamp: 1234567890,
            update: { 
                type: 'Headers Updated', 
                assetId: 'ASSET#456', 
                zone: 'Canon', 
                wml: 'test wml' 
            } 
        })
    })

    it('should send mtw.assets.players events without SessionId enrichment (SessionId sent via SessionInitialized coordination message)', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.players::player123',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const coreEvent = {
            header: {
                dataSourceKey: 'mtw.assets.players',
                streamKey: 'player123',
                timestamp: 1234567890,
                type: 'Player Settings Updated',
                RequestId: 'req-123'
            },
            update: {
                type: 'Player Settings Updated',
                settings: { onboardCompleteTags: [] }
            }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.players::player123' },
            ProjectionFields: ["DataCategory"]
        })
        expect(internalCacheMock.SessionConnections.get).toHaveBeenCalledWith('SESSION123')
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', {
            messageType: 'StreamEvent',
            eventType: 'Player Settings Updated',
            dataSourceKey: 'mtw.assets.players',
            streamKey: 'player123',
            timestamp: 1234567890,
            update: {
                type: 'Player Settings Updated',
                settings: { onboardCompleteTags: [] }
            }
        })
    })

    it('should send mtw.assets.players events to multiple sessions without SessionId enrichment', async () => {
        connectionDBMock.query.mockResolvedValue([
            {
                ConnectionId: 'STREAM#mtw.assets.players::player123',
                DataCategory: 'SESSION#SESSION123'
            },
            {
                ConnectionId: 'STREAM#mtw.assets.players::player123',
                DataCategory: 'SESSION#SESSION456'
            }
        ])
        internalCacheMock.SessionConnections.get
            .mockResolvedValueOnce(['CONNECTION#CONN123'])
            .mockResolvedValueOnce(['CONNECTION#CONN456'])
        const coreEvent = { 
            header: {
                dataSourceKey: 'mtw.assets.players', 
                streamKey: 'player123', 
                timestamp: 1234567890, 
                type: 'Snapshot'
            },
            update: { 
                type: 'Snapshot',
                assets: [],
                characters: [],
                settings: { onboardCompleteTags: [] }
            }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN123', expect.objectContaining({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players'
        }))
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.objectContaining({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players'
        }))
        // SessionId should NOT be present (sent via SessionInitialized coordination message instead)
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN123', expect.not.objectContaining({
            SessionId: expect.anything()
        }))
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.not.objectContaining({
            SessionId: expect.anything()
        }))
    })

    it('should NOT include SessionId in any subscription events (SessionId sent via SessionInitialized coordination message)', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const coreEvent = { 
            header: {
                dataSourceKey: 'mtw.assets.contentHeaders', 
                streamKey: 'ASSET#456', 
                timestamp: 1234567890, 
                type: 'Headers Updated'
            },
            update: { type: 'Headers Updated', assetId: 'ASSET#456', zone: 'Canon', wml: 'test wml' } 
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.not.objectContaining({
            SessionId: expect.anything()
        }))
    })

    it('should handle sessions with multiple connections without SessionId enrichment', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.players::player123',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN123', 'CONNECTION#CONN456'])
        const coreEvent = { 
            header: {
                dataSourceKey: 'mtw.assets.players', 
                streamKey: 'player123', 
                timestamp: 1234567890, 
                type: 'Player Settings Updated'
            },
            update: { 
                type: 'Player Settings Updated',
                settings: { onboardCompleteTags: [] }
            }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(apiClientMock.send).toHaveBeenCalledTimes(2)
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN123', expect.objectContaining({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players'
        }))
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.objectContaining({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players'
        }))
        // SessionId should NOT be present (sent via SessionInitialized coordination message instead)
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN123', expect.not.objectContaining({
            SessionId: expect.anything()
        }))
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.not.objectContaining({
            SessionId: expect.anything()
        }))
    })

    it('should handle session IDs without SESSION# prefix (no SessionId enrichment)', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.players::player123',
            DataCategory: 'SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const coreEvent = { 
            header: {
                dataSourceKey: 'mtw.assets.players', 
                streamKey: 'player123', 
                timestamp: 1234567890, 
                type: 'Player Settings Updated'
            },
            update: { 
                type: 'Player Settings Updated',
                settings: { onboardCompleteTags: [] }
            }
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(internalCacheMock.SessionConnections.get).toHaveBeenCalledWith('SESSION123')
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.objectContaining({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players'
        }))
        // SessionId should NOT be present (sent via SessionInitialized coordination message instead)
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', expect.not.objectContaining({
            SessionId: expect.anything()
        }))
    })

    describe('WML subscription library (Content Update and Merge Conflict)', () => {
        it('should transform Content Update with top-level RequestIds from event.header', async () => {
            connectionDBMock.query.mockResolvedValue([{
                ConnectionId: 'STREAM#mtw.wml::Content Update::ASSET#test',
                DataCategory: 'SESSION#S1'
            }])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#C1'])
            const coreEvent = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                header: { dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test', timestamp: 1234567890, type: 'Content Update', RequestIds: ['req-content-1'] },
                update: {
                    type: 'Content Update',
                    wml: '<Asset uuid=(a)><Room key=(r) uuid=(r)><Name>R1</Name></Room></Asset>'
                }
            }
            const match = subscriptionLibrary.matchEvent(coreEvent)
            expect(match).toBeDefined()
            await match!.publish(coreEvent)
            const sent = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
            expect(isSubscriptionClientMessage(sent)).toBe(true)
            expect(isWMLContentEventExternal(sent.update)).toBe(true)
            expect(sent.eventType).toBe(coreEvent.header.type)
            expect(apiClientMock.send).toHaveBeenCalledWith('C1', {
                messageType: 'StreamEvent',
                eventType: 'Content Update',
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                RequestIds: ['req-content-1'],
                update: {
                    type: 'Content Update',
                    wml: '<Asset uuid=(a)><Room key=(r) uuid=(r)><Name>R1</Name></Room></Asset>'
                }
            })
        })

        it('should transform Merge Conflict with top-level RequestIds from event.header', async () => {
            connectionDBMock.query.mockResolvedValue([{
                ConnectionId: 'STREAM#mtw.wml::Merge Conflict::ASSET#test',
                DataCategory: 'SESSION#S2'
            }])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#C2'])
            const coreEvent = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                header: { dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test', timestamp: 1234567890, type: 'Merge Conflict', RequestIds: ['req-merge-1'] },
                update: {
                    type: 'Merge Conflict',
                    error: 'Merge failed'
                }
            }
            const match = subscriptionLibrary.matchEvent(coreEvent)
            expect(match).toBeDefined()
            await match!.publish(coreEvent)
            const sent = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
            expect(isSubscriptionClientMessage(sent)).toBe(true)
            expect(isWMLContentEventExternal(sent.update)).toBe(true)
            expect(sent.eventType).toBe(coreEvent.header.type)
            expect(apiClientMock.send).toHaveBeenCalledWith('C2', {
                messageType: 'StreamEvent',
                eventType: 'Merge Conflict',
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                RequestIds: ['req-merge-1'],
                update: {
                    type: 'Merge Conflict',
                    error: 'Merge failed'
                }
            })
        })

        it('should use canonical WebSocket format when event.header.RequestIds is absent (no top-level RequestIds)', async () => {
            connectionDBMock.query.mockResolvedValue([{
                ConnectionId: 'STREAM#mtw.wml::Content Update::ASSET#test',
                DataCategory: 'SESSION#S3'
            }])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#C3'])
            const coreEvent = {
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                header: { dataSourceKey: 'mtw.wml', streamKey: 'ASSET#test', timestamp: 1234567890, type: 'Content Update' },
                update: {
                    type: 'Content Update',
                    wml: '<Asset uuid=(x) />'
                }
            }
            const match = subscriptionLibrary.matchEvent(coreEvent)
            await match!.publish(coreEvent)
            const sent = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
            expect(isSubscriptionClientMessage(sent)).toBe(true)
            expect(isWMLContentEventExternal(sent.update)).toBe(true)
            expect(sent.eventType).toBe(coreEvent.header.type)
            expect(sent).toMatchObject({
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#test',
                timestamp: 1234567890,
                update: { wml: '<Asset uuid=(x) />' }
            })
            // Canonical path: RequestIds only when present in header; not required in update
            expect(sent.RequestIds).toBeUndefined()
        })
    })

    it('should send mtw.assets.library events using unified WebSocketFormat pipeline', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.library::Asset Added::global',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN123'])
        const coreEvent = {
            header: {
                dataSourceKey: 'mtw.assets.library',
                streamKey: 'global',
                timestamp: 1234567890,
                type: 'Asset Added',
                RequestId: 'req-lib-1'
            },
            update: {
                assetId: 'ASSET#123'
            }
        }
        const match = subscriptionLibrary.matchEvent(coreEvent)
        expect(match).toBeDefined()
        await match!.publish(coreEvent)
        expect(connectionDBMock.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.library::Asset Added::global' },
            ProjectionFields: ["DataCategory"]
        })
        expect(internalCacheMock.SessionConnections.get).toHaveBeenCalledWith('SESSION123')
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN123', expect.any(Object))
        const sentMessage = apiClientMock.send.mock.calls[0][1]
        expect(isSubscriptionClientMessage(sentMessage)).toBe(true)
        expect(sentMessage).toMatchObject({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.library',
            streamKey: 'global',
            timestamp: 1234567890,
            eventType: 'Asset Added',
            update: {
                assetId: 'ASSET#123'
            },
            RequestId: 'req-lib-1'
        })
    })

    it('should round-trip mtw.assets.library events through EventBridge, subscriptions, WebSocket, and LibraryEventSerializer', async () => {
        const coreAtSource = {
            header: {
                dataSourceKey: 'mtw.assets.library',
                streamKey: 'global',
                timestamp: 1234567890,
                type: 'Asset Added',
                RequestId: 'req-lib-2'
            },
            update: {
                assetId: 'ASSET#123'
            }
        }
        const eventBridgeEvent = toEventBridgeFormat(coreAtSource)
        const coreAtSubscriptions = fromEventBridgeFormat(eventBridgeEvent)
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.library::Asset Added::global',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const match = subscriptionLibrary.matchEvent(coreAtSubscriptions)
        expect(match).toBeDefined()
        await match!.publish(coreAtSubscriptions)
        const webSocketMessage = apiClientMock.send.mock.calls[0][1]
        expect(isSubscriptionClientMessage(webSocketMessage)).toBe(true)
        const coreAtClient = fromWebSocketFormat(webSocketMessage as any)
        const serializer = new LibraryEventSerializer()
        const deserialized = await serializer.deserialize({
            header: coreAtClient.header,
            content: coreAtClient.update as any
        })
        expect(deserialized).toEqual({ assetId: 'ASSET#123' })
    })

    it('should send mtw.assets.contentHeaders events using unified WebSocketFormat pipeline', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const coreEvent = {
            header: {
                dataSourceKey: 'mtw.assets.contentHeaders',
                streamKey: 'ASSET#456',
                timestamp: 1234567890,
                type: 'Headers Updated',
                RequestId: 'req-headers-1',
            },
            update: { assetId: 'ASSET#456', zone: 'Canon', wml: '<Asset uuid=(test)></Asset>' },
        }
        const match = subscriptionLibrary.matchEvent(coreEvent)
        expect(match).toBeDefined()
        await match!.publish(coreEvent)
        const sent = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
        expect(isSubscriptionClientMessage(sent)).toBe(true)
        expect(isContentHeadersExternal(sent.update)).toBe(true)
        expect(sent.eventType).toBe(coreEvent.header.type)
        expect(sent).toMatchObject({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.contentHeaders',
            streamKey: 'ASSET#456',
            timestamp: 1234567890,
            eventType: 'Headers Updated',
            RequestId: 'req-headers-1',
            update: { assetId: 'ASSET#456', zone: 'Canon', wml: '<Asset uuid=(test)></Asset>' },
        })
    })

    it('should round-trip mtw.assets.contentHeaders events through EventBridge, subscriptions, WebSocket, and ContentHeadersEventSerializer', async () => {
        const coreAtSource = {
            header: {
                dataSourceKey: 'mtw.assets.contentHeaders',
                streamKey: 'ASSET#456',
                timestamp: 1234567890,
                type: 'Headers Updated',
                RequestId: 'req-headers-2',
            },
            update: { assetId: 'ASSET#456', zone: 'Canon', wml: '<Asset uuid=(test)></Asset>' },
        }
        const eventBridgeEvent = toEventBridgeFormat(coreAtSource)
        const coreAtSubscriptions = fromEventBridgeFormat(eventBridgeEvent)
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const match = subscriptionLibrary.matchEvent(coreAtSubscriptions)
        expect(match).toBeDefined()
        await match!.publish(coreAtSubscriptions)
        const webSocketMessage = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
        expect(isSubscriptionClientMessage(webSocketMessage)).toBe(true)
        expect(isContentHeadersExternal(webSocketMessage.update)).toBe(true)
        const coreAtClient = fromWebSocketFormat(webSocketMessage)
        expect(coreAtClient.header.dataSourceKey).toBe('mtw.assets.contentHeaders')
        expect(coreAtClient.header.streamKey).toBe('ASSET#456')
        expect(coreAtClient.header.timestamp).toBe(1234567890)
        expect(coreAtClient.header.type).toBe('Headers Updated')
        expect(coreAtClient.header.RequestId).toBe('req-headers-2')
        const serializer = new ContentHeadersEventSerializer()
        const deserialized = await serializer.deserialize({
            header: coreAtClient.header,
            content: coreAtClient.update as Parameters<ContentHeadersEventSerializer['deserialize']>[0]['content'],
        })
        expect(deserialized).not.toBeNull()
        expect(deserialized).toMatchObject({
            assetId: 'ASSET#456',
            zone: 'Canon',
        })
        expect(deserialized).toHaveProperty('standardForm')
    })

    it('should send mtw.assets.players events using unified WebSocketFormat pipeline', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.players::player123',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN123'])
        const coreEvent = {
            header: {
                dataSourceKey: 'mtw.assets.players',
                streamKey: 'player123',
                timestamp: 1234567890,
                type: 'Player Settings Updated',
                RequestId: 'req-player-1'
            },
            update: {
                settings: { onboardCompleteTags: [] }
            }
        }
        const match = subscriptionLibrary.matchEvent(coreEvent as any)
        expect(match).toBeDefined()
        await match!.publish(coreEvent as any)
        expect(connectionDBMock.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.players::player123' },
            ProjectionFields: ["DataCategory"]
        })
        expect(internalCacheMock.SessionConnections.get).toHaveBeenCalledWith('SESSION123')
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN123', expect.any(Object))
        const sentMessage = apiClientMock.send.mock.calls[0][1]
        expect(isSubscriptionClientMessage(sentMessage)).toBe(true)
        expect(sentMessage).toMatchObject({
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players',
            streamKey: 'player123',
            timestamp: 1234567890,
            eventType: 'Player Settings Updated',
            update: {
                settings: { onboardCompleteTags: [] }
            },
            RequestId: 'req-player-1'
        })
    })

    it('should round-trip mtw.assets.players events through EventBridge, subscriptions, WebSocket, and PlayerEventSerializer', async () => {
        const coreAtSource = {
            header: {
                dataSourceKey: 'mtw.assets.players',
                streamKey: 'player123',
                timestamp: 1234567890,
                type: 'Player Settings Updated',
                RequestId: 'req-player-2'
            },
            update: {
                settings: { onboardCompleteTags: [] }
            }
        }
        const eventBridgeEvent = toEventBridgeFormat(coreAtSource as any)
        const coreAtSubscriptions = fromEventBridgeFormat(eventBridgeEvent)
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.players::player123',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN456'])
        const match = subscriptionLibrary.matchEvent(coreAtSubscriptions as any)
        expect(match).toBeDefined()
        await match!.publish(coreAtSubscriptions as any)
        const webSocketMessage = apiClientMock.send.mock.calls[0][1]
        expect(isSubscriptionClientMessage(webSocketMessage)).toBe(true)
        const coreAtClient = fromWebSocketFormat(webSocketMessage as any)
        const serializer = new PlayerEventSerializer()
        const deserialized = await serializer.deserialize({
            header: coreAtClient.header as any,
            content: coreAtClient.update as any
        })
        expect(deserialized).toEqual({
            settings: { onboardCompleteTags: [] }
        })
    })

    it('should round-trip mtw.ephemera.thinking.scheduling Job Completed through EventBridge, subscriptions, WebSocket, and ThinkingEventSerializer', async () => {
        const coreAtSource = {
            header: {
                dataSourceKey: 'mtw.ephemera.thinking.scheduling',
                streamKey: 'global',
                timestamp: 1234567890,
                type: THINKING_JOB_COMPLETED_HEADER_TYPE,
                RequestId: 'req-thinking-1'
            },
            update: {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: '11111111-1111-1111-1111-111111111111',
                jobStatus: 'completed',
                completedAt: '2026-05-14T13:00:00.000Z',
                schedules: [
                    {
                        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                        generationId: '11111111-1111-1111-1111-111111111111',
                        workItemId: '22222222-2222-2222-2222-222222222222',
                        segment: 'candidates',
                        scheduleStatus: 'completed'
                    }
                ]
            }
        }
        const eventBridgeEvent = toEventBridgeFormat(coreAtSource)
        const coreAtSubscriptions = fromEventBridgeFormat(eventBridgeEvent)
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.ephemera.thinking.scheduling::Job Completed::global',
            DataCategory: 'SESSION#SESSION123'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#CONN789'])
        const match = subscriptionLibrary.matchEvent(coreAtSubscriptions)
        expect(match).toBeDefined()
        await match!.publish(coreAtSubscriptions)
        const webSocketMessage = apiClientMock.send.mock.calls[0][1]
        expect(isSubscriptionClientMessage(webSocketMessage)).toBe(true)
        expect(isThinkingSchedulingExternal(webSocketMessage.update)).toBe(true)
        expect(isThinkingJobCompletedEvent(webSocketMessage.update)).toBe(true)
        const coreAtClient = fromWebSocketFormat(webSocketMessage as any)
        const serializer = new ThinkingEventSerializer()
        const deserialized = await serializer.deserialize({
            header: coreAtClient.header,
            content: coreAtClient.update as any
        })
        expect(deserialized).toEqual(coreAtSource.update)
    })

    describe('WML round-trip (EventBridge -> subscriptions -> WebSocket -> fromWebSocketFormat -> WMLDataSourceEventSerializer)', () => {
        const testWmlEnv = { fetch: global.fetch }
        const wmlSerializer = new WMLDataSourceEventSerializer(testWmlEnv)

        it('should round-trip WML Content Update through pipeline and deserialize to WMLContentEvent with schema', async () => {
            const coreAtSource = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    type: 'Content Update',
                    RequestIds: ['req-wml-1'],
                },
                update: {
                    wml: '<Asset uuid=(test-asset)><Room key=(room1) uuid=(room1)><ShortName>R1</ShortName></Room></Asset>',
                },
            }
            const eventBridgeEvent = toEventBridgeFormat(coreAtSource as any)
            const coreAtSubscriptions = fromEventBridgeFormat(eventBridgeEvent)
            connectionDBMock.query.mockResolvedValue([{
                ConnectionId: 'STREAM#mtw.wml::Content Update::ASSET#test',
                DataCategory: 'SESSION#S1',
            }])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#C1'])
            const match = subscriptionLibrary.matchEvent(coreAtSubscriptions as any)
            expect(match).toBeDefined()
            await match!.publish(coreAtSubscriptions as any)
            const webSocketMessage = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
            expect(isSubscriptionClientMessage(webSocketMessage)).toBe(true)
            expect(isWMLContentEventExternal(webSocketMessage.update)).toBe(true)
            const coreAtClient = fromWebSocketFormat(webSocketMessage)
            expect(coreAtClient.header.dataSourceKey).toBe('mtw.wml')
            expect(coreAtClient.header.streamKey).toBe('ASSET#test')
            expect(coreAtClient.header.timestamp).toBe(1234567890)
            expect(coreAtClient.header.type).toBe('Content Update')
            expect(coreAtClient.header.RequestIds).toEqual(['req-wml-1'])
            const deserialized = await wmlSerializer.deserialize({
                content: coreAtClient.update as any,
                header: coreAtClient.header as any,
            })
            expect(deserialized).not.toBeNull()
            expect(isWMLContentUpdateEvent(deserialized!)).toBe(true)
            if (isWMLContentUpdateEvent(deserialized!)) {
                expect(deserialized!.schema).toBeDefined()
            }
        })

        it('should round-trip WML Merge Conflict through pipeline and deserialize to WMLContentEvent with error', async () => {
            const coreAtSource = {
                header: {
                    dataSourceKey: 'mtw.wml',
                    streamKey: 'ASSET#test',
                    timestamp: 1234567890,
                    type: 'Merge Conflict',
                    RequestIds: ['req-merge-1'],
                },
                update: { error: 'Merge failed' },
            }
            const eventBridgeEvent = toEventBridgeFormat(coreAtSource as any)
            const coreAtSubscriptions = fromEventBridgeFormat(eventBridgeEvent)
            connectionDBMock.query.mockResolvedValue([{
                ConnectionId: 'STREAM#mtw.wml::Merge Conflict::ASSET#test',
                DataCategory: 'SESSION#S2',
            }])
            internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#C2'])
            const match = subscriptionLibrary.matchEvent(coreAtSubscriptions as any)
            expect(match).toBeDefined()
            await match!.publish(coreAtSubscriptions as any)
            const webSocketMessage = apiClientMock.send.mock.calls[0][1] as SubscriptionClientMessage
            expect(isSubscriptionClientMessage(webSocketMessage)).toBe(true)
            expect(isWMLContentEventExternal(webSocketMessage.update)).toBe(true)
            const coreAtClient = fromWebSocketFormat(webSocketMessage)
            expect(coreAtClient.header.dataSourceKey).toBe('mtw.wml')
            expect(coreAtClient.header.streamKey).toBe('ASSET#test')
            expect(coreAtClient.header.timestamp).toBe(1234567890)
            expect(coreAtClient.header.type).toBe('Merge Conflict')
            expect(coreAtClient.header.RequestIds).toEqual(['req-merge-1'])
            const deserialized = await wmlSerializer.deserialize({
                content: coreAtClient.update as any,
                header: coreAtClient.header as any,
            })
            expect(deserialized).not.toBeNull()
            expect(isWMLMergeConflictEvent(deserialized!)).toBe(true)
            if (isWMLMergeConflictEvent(deserialized!)) {
                expect(deserialized!.error).toBe('Merge failed')
            }
        })
    })

})