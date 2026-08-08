jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')

import { connectionDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { CachePlayerSessionsData } from './playerSessions'

const connectionDBMock = connectionDB as jest.Mocked<typeof connectionDB>

describe('CachePlayerSessionsData', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('queries only the requested player\'s pointer partition', async () => {
        connectionDBMock.query.mockResolvedValueOnce([
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#123' }
        ])
        const cache = new CachePlayerSessionsData()
        const sessions = await cache.get('Testy')
        expect(sessions).toEqual(['123'])
        expect(connectionDBMock.query).toHaveBeenCalledWith(expect.objectContaining({
            Key: { ConnectionId: 'PLAYER#Testy' }
        }))
    })

    it('dedupes repeated session pointers', async () => {
        connectionDBMock.query.mockResolvedValueOnce([
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#123' },
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#123' }
        ])
        const cache = new CachePlayerSessionsData()
        expect(await cache.get('Testy')).toEqual(['123'])
    })

    it('memoizes per player and does not re-query on a second get for the same player', async () => {
        connectionDBMock.query.mockResolvedValueOnce([
            { ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#123' }
        ])
        const cache = new CachePlayerSessionsData()
        await cache.get('Testy')
        await cache.get('Testy')
        expect(connectionDBMock.query).toHaveBeenCalledTimes(1)
    })

    it('queries separately for a different player', async () => {
        connectionDBMock.query
            .mockResolvedValueOnce([{ ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#123' }])
            .mockResolvedValueOnce([{ ConnectionId: 'PLAYER#Other', DataCategory: 'SESSION#456' }])
        const cache = new CachePlayerSessionsData()
        expect(await cache.get('Testy')).toEqual(['123'])
        expect(await cache.get('Other')).toEqual(['456'])
        expect(connectionDBMock.query).toHaveBeenCalledTimes(2)
    })

    it('re-queries after clear', async () => {
        connectionDBMock.query
            .mockResolvedValueOnce([{ ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#123' }])
            .mockResolvedValueOnce([{ ConnectionId: 'PLAYER#Testy', DataCategory: 'SESSION#789' }])
        const cache = new CachePlayerSessionsData()
        expect(await cache.get('Testy')).toEqual(['123'])
        cache.clear()
        expect(await cache.get('Testy')).toEqual(['789'])
        expect(connectionDBMock.query).toHaveBeenCalledTimes(2)
    })
})
