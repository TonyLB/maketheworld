jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { subscriptionLibraryConstructor } from '.'

const connectionDBMock = jest.mocked(connectionDB)

describe('subscription handlerFramework', () => {
    const testLibrary = subscriptionLibraryConstructor([
        {
            source: 'noDetails'
        },
        {
            source: 'detailsOne',
            detailType: 'TestOne',
            detailExtract: (event) => (event.AssetId)
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

})