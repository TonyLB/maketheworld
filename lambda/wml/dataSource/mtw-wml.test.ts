import { wmlDataSource, WMLEventSerializer } from './mtw-wml'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

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
})

describe('WMLEventSerializer', () => {
    let serializer: WMLEventSerializer

    beforeEach(() => {
        serializer = new WMLEventSerializer()
    })

    it('should serialize StandardForm to WML string', () => {
        const standardForm = new StandardForm(deIndentWML(`
            <Asset key=(test-asset)>
                <Room key=(test-room) uuid=(test-room)>
                    <Name>Test Room</Name>
                    <Description>A test room for testing purposes</Description>
                </Room>
            </Asset>
        `))

        const wmlString = serializer.serialize({ update: standardForm })
        expect(typeof wmlString).toBe('string')
        expect(wmlString).toContain('Room')
        expect(wmlString).toContain('test-room')
    })

    it('should deserialize WML string back to StandardForm', () => {
        const wmlString = deIndentWML(`
            <Asset key=(test-asset)>
                <Room key=(test-room) uuid=(test-room)>
                    <Name>Test Room</Name>
                    <Description>A test room for testing purposes</Description>
                </Room>
            </Asset>
        `)

        const standardForm = serializer.deserialize(wmlString)
        expect(standardForm).toBeInstanceOf(StandardForm)
        expect(standardForm.key).toBe('test-asset')
        expect(standardForm.toJSON().components).toHaveLength(1)
    })

    it('should handle serialization round-trip correctly', () => {
        const originalForm = new StandardForm(deIndentWML(`
            <Asset key=(test-asset)>
                <Room key=(test-room) uuid=(test-room)>
                    <Name>Test Room</Name>
                    <Description>A test room for testing purposes</Description>
                </Room>
            </Asset>
        `))

        // Serialize to WML
        const wmlString = serializer.serialize({ update: originalForm })
        
        // Deserialize back to StandardForm
        const deserializedForm = serializer.deserialize(wmlString)
        
        // Verify key is preserved
        expect(deserializedForm.key).toBe(originalForm.key)
        expect(deserializedForm.toJSON().components).toHaveLength(originalForm.toJSON().components.length)
    })

})
