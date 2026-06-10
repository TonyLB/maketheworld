import './index'
import { playersDataSource } from './index'

describe('mtw.assets.players DataSource', () => {
    it('uses publish outbound bus delivery', () => {
        expect(playersDataSource.outboundBusDelivery).toBe('publish')
    })
})
