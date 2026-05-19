import { isSchemaDisplayName, isSchemaDescription, isSchemaSummary } from './prose'

describe('prose tags', () => {
    describe('isSchemaDisplayName', () => {
        it('should return true for valid SchemaDisplayNameTag', () => {
            const schema = { tag: 'DisplayName' }
            expect(isSchemaDisplayName(schema)).toBe(true)
        })

        it('should return false for invalid SchemaDisplayNameTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaDisplayName(schema)).toBe(false)
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
})
