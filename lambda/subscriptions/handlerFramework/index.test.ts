jest.mock('../apiClient')
import { apiClient } from "../apiClient"
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('../internalCache')
import internalCache from "../internalCache"
import { subscriptionLibrary, subscriptionLibraryConstructor } from '.'

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
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#TEST',
                timestamp: event.timestamp,
                update: { type: 'Content Update', RequestId: 'req-no-details', wml: '' }
            })
        },
        {
            dataSourceKey: 'detailsOne',
            type: 'TestOne',
            transform: (event) => ({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.wml',
                streamKey: event.streamKey,
                timestamp: event.timestamp,
                update: {
                    type: 'Merge Conflict',
                    RequestId: (event as any).update?.RequestId
                }
            })
        },
        {
            dataSourceKey: 'mtw.assets.contentHeaders',
            type: 'Headers Updated',
            transform: (event) => ({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.assets.contentHeaders' as any,
                streamKey: event.streamKey,
                timestamp: event.timestamp,
                update: {
                    type: 'Headers Updated',
                    assetId: (event as any).update?.assetId || 'ASSET#unknown',
                    zone: (event as any).update?.zone || 'Canon',
                    wml: (event as any).update?.wml || ''
                }
            })
        },
        {
            dataSourceKey: 'mtw.assets.players',
            transform: (event) => ({
                messageType: 'StreamEvent',
                dataSourceKey: 'mtw.assets.players',
                streamKey: event.streamKey,
                timestamp: event.timestamp,
                update: {
                    ...(event as any).update,
                    ...((event as any).RequestId ? { RequestId: (event as any).RequestId } : {})
                }
            })
        }
    ])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should match an event with no details', () => {
        expect(testLibrary.matchEvent({ dataSourceKey: 'noDetails', streamKey: '', update: { type: 'any' } })?._dataSourceKey).toEqual('noDetails')
        expect(testLibrary.matchEvent({ dataSourceKey: 'noMatch', streamKey: '', update: { type: 'any' } })).toBeFalsy()
    })

    it('should match an event with type', () => {
        expect(testLibrary.matchEvent({ dataSourceKey: 'detailsOne', streamKey: 'ASSET#XYZ', update: { type: 'TestOne' } })?._dataSourceKey).toEqual('detailsOne')
        expect(testLibrary.matchEvent({ dataSourceKey: 'detailsOne', streamKey: 'ASSET#XYZ', update: { type: 'NoMatch' } })).toBeFalsy()
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
        const coreEvent = { dataSourceKey: 'noDetails', streamKey: 'testStream', timestamp: 1234567890, update: { type: 'any' } }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#noDetails::testStream' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', { messageType: 'StreamEvent', dataSourceKey: 'mtw.wml', streamKey: 'ASSET#TEST', timestamp: 1234567890, update: { type: 'Content Update', RequestId: 'req-no-details', wml: '' } })
    })

    it('should publish to subscription with details', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        const coreEvent = { dataSourceKey: 'detailsOne', streamKey: 'ASSET#XYZ', timestamp: 1234567890, update: { type: 'TestOne', RequestId: 'qrstuv' } }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', { messageType: 'StreamEvent', dataSourceKey: 'mtw.wml', streamKey: 'ASSET#XYZ', timestamp: 1234567890, update: { type: 'Merge Conflict', RequestId: 'qrstuv' } })
    })

    it('should handle content headers events', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456',
            DataCategory: 'SESSION#EFGH'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#WXYZ'])
        const coreEvent = { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'ASSET#456', timestamp: 1234567890, update: { type: 'Headers Updated', assetId: 'ASSET#456', zone: 'Canon', wml: 'test wml' } }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('WXYZ', { 
            messageType: 'StreamEvent', 
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
            dataSourceKey: 'mtw.assets.players',
            streamKey: 'player123',
            timestamp: 1234567890,
            update: {
                type: 'Player Settings Updated',
                settings: { onboardCompleteTags: [] }
            },
            RequestId: 'req-123'
        }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.players::player123' },
            ProjectionFields: ["DataCategory"]
        })
        expect(internalCacheMock.SessionConnections.get).toHaveBeenCalledWith('SESSION123')
        expect(apiClientMock.send).toHaveBeenCalledWith('CONN456', {
            messageType: 'StreamEvent',
            dataSourceKey: 'mtw.assets.players',
            streamKey: 'player123',
            timestamp: 1234567890,
            update: {
                type: 'Player Settings Updated',
                settings: { onboardCompleteTags: [] },
                RequestId: 'req-123'
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
            dataSourceKey: 'mtw.assets.players', 
            streamKey: 'player123', 
            timestamp: 1234567890, 
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
            dataSourceKey: 'mtw.assets.contentHeaders', 
            streamKey: 'ASSET#456', 
            timestamp: 1234567890, 
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
            dataSourceKey: 'mtw.assets.players', 
            streamKey: 'player123', 
            timestamp: 1234567890, 
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
            dataSourceKey: 'mtw.assets.players', 
            streamKey: 'player123', 
            timestamp: 1234567890, 
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
            const match = subscriptionLibrary.matchEvent(coreEvent as any)
            expect(match).toBeDefined()
            await match!.publish(coreEvent as any)
            expect(apiClientMock.send).toHaveBeenCalledWith('C1', {
                messageType: 'StreamEvent',
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
            const match = subscriptionLibrary.matchEvent(coreEvent as any)
            expect(match).toBeDefined()
            await match!.publish(coreEvent as any)
            expect(apiClientMock.send).toHaveBeenCalledWith('C2', {
                messageType: 'StreamEvent',
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

        it('should use empty RequestIds when event.header.RequestIds is absent', async () => {
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
            const match = subscriptionLibrary.matchEvent(coreEvent as any)
            await match!.publish(coreEvent as any)
            expect(apiClientMock.send).toHaveBeenCalledWith('C3', expect.objectContaining({
                RequestIds: [],
                update: expect.objectContaining({ type: 'Content Update', wml: '<Asset uuid=(x) />' })
            }))
        })
    })

})