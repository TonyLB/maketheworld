jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'

import { CacheBase, CacheGlobal, CacheLookupOnce } from '.'

const assetDBMock = assetDB as jest.Mocked<typeof assetDB>

describe('Internal Cache', () => {
    it('should handle mixins', async () => {
        const MixedCache = CacheLookupOnce(CacheGlobal(CacheBase))
        assetDBMock.getItem.mockResolvedValue({
            player: 'TestPlayer'
        })
        const cache = new MixedCache()
        cache.set({ category: 'Global', key: 'connectionId', value: 'Test' })
        expect(await cache.get({ category: 'Global', key: 'connectionId' })).toEqual('Test')
        expect(await cache.get({ category: 'Lookup', key: 'player' })).toEqual('TestPlayer')
    })
})