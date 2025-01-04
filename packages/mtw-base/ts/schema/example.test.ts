import { isSchemaNameTag, isSchemaDescriptionTag, isSchemaSummaryTag, isSchemaExampleTag } from './example'

describe('example tags', () => {
    describe('isSchemaNameTag', () => {
        it('should return true for valid SchemaNameTag', () => {
            const schema = { tag: 'Name' }
            expect(isSchemaNameTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaNameTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaNameTag(schema)).toBe(false)
        })
    })

    describe('isSchemaDescriptionTag', () => {
        it('should return true for valid SchemaDescriptionTag', () => {
            const schema = { tag: 'Description' }
            expect(isSchemaDescriptionTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaDescriptionTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaDescriptionTag(schema)).toBe(false)
        })
    })

    describe('isSchemaSummaryTag', () => {
        it('should return true for valid SchemaSummaryTag', () => {
            const schema = { tag: 'Summary' }
            expect(isSchemaSummaryTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaSummaryTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaSummaryTag(schema)).toBe(false)
        })
    })

    describe('isSchemaExampleTag', () => {
        it('should return true for valid SchemaExampleTag', () => {
            const schema = { tag: 'Example', key: 'exampleKey' }
            expect(isSchemaExampleTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaExampleTag', () => {
            const schema = { tag: 'Invalid', key: 'exampleKey' }
            expect(isSchemaExampleTag(schema)).toBe(false)
        })

        it('should return false for SchemaExampleTag missing key', () => {
            const schema = { tag: 'Example' }
            expect(isSchemaExampleTag(schema)).toBe(false)
        })
    })
})