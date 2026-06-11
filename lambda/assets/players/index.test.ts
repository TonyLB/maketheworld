import './index'
import { playersDataSource } from './index'

describe('mtw.assets.players DataSource', () => {
    it('registers mtw.assets.players', () => {
        expect(playersDataSource.dataSourceKey).toBe('mtw.assets.players')
    })
})
