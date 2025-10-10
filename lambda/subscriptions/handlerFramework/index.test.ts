jest.mock('../apiClient')
import { apiClient } from "../apiClient"
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
jest.mock('../internalCache')
import internalCache from "../internalCache"
import { subscriptionLibraryConstructor } from '.'

const connectionDBMock = jest.mocked(connectionDB)
const apiClientMock = apiClient as jest.Mocked<typeof apiClient>
// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('subscription handlerFramework', () => {
    const testLibrary = subscriptionLibraryConstructor([
        {
            dataSourceKey: 'noDetails',
            transform: (event) => ({
                messageType: 'Subscription',
                dataSourceKey: 'mtw.wml',
                streamKey: 'ASSET#TEST',
                update: { type: 'Content Update', RequestId: 'req-no-details', wml: '' }
            })
        },
        {
            dataSourceKey: 'detailsOne',
            type: 'TestOne',
            transform: (event) => ({
                messageType: 'Subscription',
                dataSourceKey: 'mtw.wml',
                streamKey: event.streamKey,
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
                messageType: 'Subscription',
                dataSourceKey: 'mtw.assets.contentHeaders' as any,
                streamKey: event.streamKey,
                update: {
                    type: 'Headers Updated',
                    assetId: (event as any).update?.assetId || 'ASSET#unknown',
                    zone: (event as any).update?.zone || 'Canon',
                    wml: (event as any).update?.wml || ''
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
            ConnectionId: 'STREAM#noDetails::any::testStream',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        const coreEvent = { dataSourceKey: 'noDetails', streamKey: 'testStream', update: { type: 'any' } }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#noDetails::any::testStream' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', { messageType: 'Subscription', dataSourceKey: 'mtw.wml', streamKey: 'ASSET#TEST', update: { type: 'Content Update', RequestId: 'req-no-details', wml: '' } })
    })

    it('should publish to subscription with details', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        const coreEvent = { dataSourceKey: 'detailsOne', streamKey: 'ASSET#XYZ', update: { type: 'TestOne', RequestId: 'qrstuv' } }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', { messageType: 'Subscription', dataSourceKey: 'mtw.wml', streamKey: 'ASSET#XYZ', update: { type: 'Merge Conflict', RequestId: 'qrstuv' } })
    })

    it('should handle content headers events', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456',
            DataCategory: 'SESSION#EFGH'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#WXYZ'])
        const coreEvent = { dataSourceKey: 'mtw.assets.contentHeaders', streamKey: 'ASSET#456', update: { type: 'Headers Updated', assetId: 'ASSET#456', zone: 'Canon', wml: 'test wml' } }
        await testLibrary.matchEvent(coreEvent as any)?.publish(coreEvent as any)
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#mtw.assets.contentHeaders::Headers Updated::ASSET#456' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('WXYZ', { 
            messageType: 'Subscription', 
            dataSourceKey: 'mtw.assets.contentHeaders', 
            streamKey: 'ASSET#456', 
            update: { 
                type: 'Headers Updated', 
                assetId: 'ASSET#456', 
                zone: 'Canon', 
                wml: 'test wml' 
            } 
        })
    })

})