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
            source: 'noDetails'
        },
        {
            source: 'detailsOne',
            detailType: 'TestOne',
            detailExtract: (event) => (event.AssetId),
            transform: (event) => ({
                messageType: 'Subscription',
                source: 'mtw.wml',
                detailType: 'Merge Conflict',
                AssetId: event.AssetId,
                RequestId: event.RequestId
            })
        }
    ])

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should match an event with no details', () => {
        expect(testLibrary.matchEvent({ source: 'noDetails' })?._source).toEqual('noDetails')
        expect(testLibrary.matchEvent({ source: 'noMatch' })).toBeFalsy()
    })

    it('should match an event with detailExtract', () => {
        expect(testLibrary.matchEvent({ source: 'detailsOne', detailType: 'TestOne' })?._source).toEqual('detailsOne')
        expect(testLibrary.matchEvent({ source: 'detailsOne', detailType: 'NoMatch' })).toBeFalsy()
    })

    it('should subscribe with no details', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        await testLibrary.match({ source: 'noDetails' })?.subscribe({ message: 'subscribe', source: 'noDetails' }, `SESSION#ABCD`)
        expect(connectionDBMock.putItem).toHaveBeenCalledWith({
            ConnectionId: 'STREAM#noDetails',
            DataCategory: 'SESSION#ABCD'
        })
    })

    it('should subscribe with detailExtract', async () => {
        connectionDBMock.putItem.mockResolvedValue({})
        await testLibrary.match({ source: 'detailsOne', detailType: 'TestOne', detailExtract: 'XYZ' })?.subscribe({ message: 'subscribe', source: 'detailsOne', detailType: 'TestOne', AssetId: 'XYZ' }, `SESSION#ABCD`)
        expect(connectionDBMock.putItem).toHaveBeenCalledWith({
            ConnectionId: 'STREAM#detailsOne::TestOne::XYZ',
            DataCategory: 'SESSION#ABCD'
        })
    })

    it('should publish to subscription with no details', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#noDetails',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        await testLibrary.matchEvent({ source: 'noDetails' })?.publish({ messageType: 'Subscription', source: 'noDetails' })
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#noDetails' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', { messageType: 'Subscription', source: 'noDetails' })
    })

    it('should publish to subscription with details', async () => {
        connectionDBMock.query.mockResolvedValue([{
            ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ',
            DataCategory: 'SESSION#ABCD'
        }])
        internalCacheMock.SessionConnections.get.mockResolvedValue(['CONNECTION#QRST'])
        await testLibrary.matchEvent({ source: 'detailsOne', detailType: 'TestOne', AssetId: 'ASSET#XYZ' })?.publish({ source: 'detailsOne', detailType: 'TestOne', AssetId: 'ASSET#XYZ', RequestId: 'qrstuv' })
        expect(connectionDB.query).toHaveBeenCalledWith({
            Key: { ConnectionId: 'STREAM#detailsOne::TestOne::ASSET#XYZ' },
            ProjectionFields: ["DataCategory"]
        })
        expect(apiClientMock.send).toHaveBeenCalledWith('QRST', { messageType: 'Subscription', source: 'mtw.wml', detailType: 'Merge Conflict', AssetId: 'ASSET#XYZ', RequestId: 'qrstuv' })
    })

})