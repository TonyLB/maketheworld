import { ConverterMixinFactory, BaseConverter } from './functionMixins'

type TagString = {
    tag: 'String';
    value: string;
}

type TagNumber = {
    tag: 'Number';
    value: number;
}

const TagNumberConverter = ConverterMixinFactory({
    typeGuard: (value: unknown): value is number => (typeof value === 'number'),
    convert: (value: number): TagNumber => ({
        tag: 'Number',
        value
    })
})

const TagStringConverter = ConverterMixinFactory({
    typeGuard: (value: unknown): value is string => (typeof value === 'string'),
    convert: (value: string): TagString => ({
        tag: 'String',
        value
    })
})

export class ComposedConverter extends TagNumberConverter(TagStringConverter(BaseConverter)) {}

// const converter = new ComposedConverter()

// const convertStringTestTwo = converter.convert('Test')
// const convertNumberTestTwo = converter.convert(5)
// const convertBooleanTestTwo = converter.convert(false)

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