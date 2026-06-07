import { isSchemaString, isSchemaLink, isSchemaWhitespace, isSchemaLineBreak, isSchemaSpacer, isSchemaDoubleSpace, isSchemaDoubleBR } from './renderTree'

describe('renderTree typeguards', () => {
    describe('isSchemaString', () => {
        it('should return true for valid SchemaStringTag', () => {
            const schema = { tag: 'String', value: 'example' }
            expect(isSchemaString(schema)).toBe(true)
        })

        it('should return false for invalid SchemaStringTag', () => {
            const schema = { tag: 'Invalid', value: 'example' }
            expect(isSchemaString(schema)).toBe(false)
        })

        it('should return false for SchemaStringTag missing value', () => {
            const schema = { tag: 'String' }
            expect(isSchemaString(schema)).toBe(false)
        })
    })

    describe('isSchemaLink', () => {
        it('should return true for valid SchemaLinkTag', () => {
            const schema = { tag: 'Link', to: 'example.com', text: 'example' }
            expect(isSchemaLink(schema)).toBe(true)
        })

        it('should return false for invalid SchemaLinkTag', () => {
            const schema = { tag: 'Invalid', to: 'example.com', text: 'example' }
            expect(isSchemaLink(schema)).toBe(false)
        })

        it('should return false for SchemaLinkTag missing to', () => {
            const schema = { tag: 'Link', text: 'example' }
            expect(isSchemaLink(schema)).toBe(false)
        })

        it('should return false for SchemaLinkTag missing text', () => {
            const schema = { tag: 'Link', to: 'example.com' }
            expect(isSchemaLink(schema)).toBe(false)
        })
    })

    describe('isSchemaWhitespace', () => {
        it('should return true for valid SchemaWhitespaceTag', () => {
            const schema = { tag: 'Whitespace' }
            expect(isSchemaWhitespace(schema)).toBe(true)
        })

        it('should return false for invalid SchemaWhitespaceTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaWhitespace(schema)).toBe(false)
        })
    })

    describe('isSchemaLineBreak', () => {
        it('should return true for valid SchemaLineBreakTag', () => {
            const schema = { tag: 'br' }
            expect(isSchemaLineBreak(schema)).toBe(true)
        })

        it('should return false for invalid SchemaLineBreakTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaLineBreak(schema)).toBe(false)
        })
    })

    describe('isSchemaSpacer', () => {
        it('should return true for valid SchemaSpacerTag', () => {
            const schema = { tag: 'Space' }
            expect(isSchemaSpacer(schema)).toBe(true)
        })

        it('should return false for invalid SchemaSpacerTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaSpacer(schema)).toBe(false)
        })
    })

    describe('isSchemaDoubleSpace', () => {
        it('should return true for valid SchemaDoubleSpaceTag', () => {
            const schema = { tag: 'DoubleSpace' }
            expect(isSchemaDoubleSpace(schema)).toBe(true)
        })

        it('should return false for invalid SchemaDoubleSpaceTag', () => {
            const schema = { tag: 'Space' }
            expect(isSchemaDoubleSpace(schema)).toBe(false)
        })
    })

    describe('isSchemaDoubleBR', () => {
        it('should return true for valid SchemaDoubleBRTag', () => {
            const schema = { tag: 'DoubleBR' }
            expect(isSchemaDoubleBR(schema)).toBe(true)
        })

        it('should return false for invalid SchemaDoubleBRTag', () => {
            const schema = { tag: 'br' }
            expect(isSchemaDoubleBR(schema)).toBe(false)
        })
    })
})