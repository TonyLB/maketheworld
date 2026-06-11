import './index'
import { ephemeraObjectsDataSource } from './index'

describe('mtw.ephemera.objects DataSource', () => {
    it('registers mtw.ephemera.objects', () => {
        expect(ephemeraObjectsDataSource.dataSourceKey).toBe('mtw.ephemera.objects')
    })
})
