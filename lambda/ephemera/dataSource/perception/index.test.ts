import messageBus from '../../messageBus'
import { ephemeraPerceptionDataSource } from './index'

describe('mtw.ephemera.perception DataSource (stub)', () => {
    beforeEach(() => {
        messageBus.clear()
    })

    it('registers subscription and flush completes without error', async () => {
        expect(ephemeraPerceptionDataSource.dataSourceKey).toBe('mtw.ephemera.perception')
        await expect(messageBus.flush()).resolves.toBeUndefined()
    })
})
