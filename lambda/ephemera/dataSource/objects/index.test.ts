import './index'
import { ephemeraObjectsDataSource } from './index'

describe('mtw.ephemera.objects DataSource', () => {
    it('uses publish outbound bus delivery', () => {
        expect(ephemeraObjectsDataSource.outboundBusDelivery).toBe('publish')
    })
})
