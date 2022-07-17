jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { connectionDB } from '@tonylb/mtw-utilities/dist/dynamoDB'

import { CacheBase, CacheConnection } from '.'

const connectionDBMock = jest.mocked(connectionDB)

describe('Internal Cache', () => {
    it('should handle mixins', async () => {
        const MixedCache = CacheConnection(CacheBase)
        connectionDBMock.getItem.mockResolvedValue({
            player: 'TestPlayer'
        })
        const cache = new MixedCache()
        cache.Connection.set({ key: 'connectionId', value: 'Test' })
        expect(await cache.Connection.get('connectionId')).toEqual('Test')
        expect(await cache.Connection.get('player')).toEqual('TestPlayer')
    })
})