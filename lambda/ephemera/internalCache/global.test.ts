jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => {
    const actual = jest.requireActual('@tonylb/mtw-utilities/ts/dynamoDB') as typeof import('@tonylb/mtw-utilities/ts/dynamoDB')
    return {
        ...actual,
        connectionDB: Object.assign({}, actual.connectionDB, {
            query: jest.fn()
        })
    }
})
import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import { CacheGlobalData } from './global'

const connectionDBMock = jest.mocked(connectionDB)

describe('ephemera CacheGlobalData sessions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('resolves sessions from Meta::Session rows', async () => {
        connectionDBMock.query.mockResolvedValue([
            { ConnectionId: 'Meta::Session', DataCategory: 'SESSION#session-1' },
            { ConnectionId: 'Meta::Session', DataCategory: 'SESSION#session-2' }
        ] as any)
        const cache = new CacheGlobalData()

        const result = await cache.get('sessions')

        expect(connectionDBMock.query).toHaveBeenCalledWith({
            Key: {
                ConnectionId: 'Meta::Session'
            },
            KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
            ExpressionAttributeValues: {
                ':prefix': 'SESSION#'
            },
            ProjectionFields: ['DataCategory'],
            ConsistentRead: true
        })
        expect(result).toEqual(['session-1', 'session-2'])
    })
})
