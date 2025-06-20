import { isSchemaName, isSchemaDescription, isSchemaSummary, isSchemaExample } from './example'

describe('example tags', () => {
    describe('isSchemaName', () => {
        it('should return true for valid SchemaNameTag', () => {
            const schema = { tag: 'Name' }
            expect(isSchemaName(schema)).toBe(true)
        })

        it('should return false for invalid SchemaNameTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaName(schema)).toBe(false)
        })
    })

    describe('isSchemaDescription', () => {
        it('should return true for valid SchemaDescriptionTag', () => {
            const schema = { tag: 'Description' }
            expect(isSchemaDescription(schema)).toBe(true)
        })

        it('should return false for invalid SchemaDescriptionTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaDescription(schema)).toBe(false)
        })
    })

    describe('isSchemaSummary', () => {
        it('should return true for valid SchemaSummaryTag', () => {
            const schema = { tag: 'Summary' }
            expect(isSchemaSummary(schema)).toBe(true)
        })

        it('should return false for invalid SchemaSummaryTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaSummary(schema)).toBe(false)
        })
    })

    describe('isSchemaExample', () => {
        it('should return true for valid SchemaExampleTag', () => {
            const schema = { tag: 'Example', key: 'exampleKey' }
            expect(isSchemaExample(schema)).toBe(true)
        })

        it('should return false for invalid SchemaExampleTag', () => {
            const schema = { tag: 'Invalid', key: 'exampleKey' }
            expect(isSchemaExample(schema)).toBe(false)
        })

    })
})