import { wmlDataSource } from './index'
import { WMLEventSerializer } from './serializers'

describe('WML DataSource', () => {
    it('should create wmlDataSource instance', () => {
        expect(wmlDataSource).toBeDefined()
        expect(wmlDataSource.dataSourceKey).toBe('mtw.wml')
        expect(wmlDataSource.replayable).toBe(false)
    })

    it('should have event serializer configured', () => {
        const serializer = wmlDataSource.getSerializer()
        expect(serializer).toBeInstanceOf(WMLEventSerializer)
    })

    it('should have correct data source configuration', () => {
        expect(wmlDataSource.dataSourceKey).toBe('mtw.wml')
        expect(wmlDataSource.replayable).toBe(false)
        expect(wmlDataSource.getSerializer()).toBeDefined()
    })
})
