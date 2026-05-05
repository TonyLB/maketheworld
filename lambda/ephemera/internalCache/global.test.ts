jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { CacheGlobalData } from './global'

const connectionDBMock = jest.mocked(connectionDB)

describe('ephemera CacheGlobalData sessions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('resolves sessions from Meta::Session rows', async () => {
        connectionDBMock.query.mockResolvedValue([
            { ConnectionId: 'SESSION#session-1' },
            { ConnectionId: 'SESSION#session-2' }
        ] as any)
        const cache = new CacheGlobalData()

        const result = await cache.get('sessions')

        expect(connectionDBMock.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            Key: {
                DataCategory: 'Meta::Session'
            },
            ProjectionFields: ['ConnectionId']
        })
        expect(result).toEqual(['session-1', 'session-2'])
    })
})
