import { ComposedConverter } from './functionMixins'

describe('functionMixins', () => {
    describe('ComposedConverter', () => {
        it('should correctly convert string', () => {
            const converter = new ComposedConverter()
            expect(converter.convert('Test')).toEqual({
                tag: 'String',
                value: 'Test'
            })
        })

        it('should correctly convert number', () => {
            const converter = new ComposedConverter()
            expect(converter.convert(5)).toEqual({
                tag: 'Number',
                value: 5
            })
        })
    })
})