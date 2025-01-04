import { isSchemaReplace, isSchemaReplaceMatch, isSchemaReplacePayload, isSchemaRemove, isSchemaEdit } from './edit'

describe('edit tags', () => {
    describe('isSchemaReplace', () => {
        it('should identify SchemaReplaceTag correctly', () => {
            const schema = { tag: 'Replace', someOtherProp: 'value' }
            expect(isSchemaReplace(schema)).toBe(true)
        })

        it('should not identify SchemaReplaceTag incorrectly', () => {
            const schema = { tag: 'NotReplace', someOtherProp: 'value' }
            expect(isSchemaReplace(schema)).toBe(false)
        })
    })

    describe('isSchemaReplaceMatch', () => {
        it('should identify SchemaReplaceMatchTag correctly', () => {
            const schema = { tag: 'ReplaceMatch', someOtherProp: 'value' }
            expect(isSchemaReplaceMatch(schema)).toBe(true)
        })

        it('should not identify SchemaReplaceMatchTag incorrectly', () => {
            const schema = { tag: 'NotReplaceMatch', someOtherProp: 'value' }
            expect(isSchemaReplaceMatch(schema)).toBe(false)
        })
    })

    describe('isSchemaReplacePayload', () => {
        it('should identify SchemaReplacePayloadTag correctly', () => {
            const schema = { tag: 'ReplacePayload', someOtherProp: 'value' }
            expect(isSchemaReplacePayload(schema)).toBe(true)
        })

        it('should not identify SchemaReplacePayloadTag incorrectly', () => {
            const schema = { tag: 'NotReplacePayload', someOtherProp: 'value' }
            expect(isSchemaReplacePayload(schema)).toBe(false)
        })
    })

    describe('isSchemaRemove', () => {
        it('should identify SchemaRemoveTag correctly', () => {
            const schema = { tag: 'Remove', someOtherProp: 'value' }
            expect(isSchemaRemove(schema)).toBe(true)
        })

        it('should not identify SchemaRemoveTag incorrectly', () => {
            const schema = { tag: 'NotRemove', someOtherProp: 'value' }
            expect(isSchemaRemove(schema)).toBe(false)
        })
    })

    describe('isSchemaEdit', () => {
        it('should identify SchemaEditTag correctly', () => {
            const schemaReplace = { tag: 'Replace', someOtherProp: 'value' }
            const schemaReplaceMatch = { tag: 'ReplaceMatch', someOtherProp: 'value' }
            const schemaReplacePayload = { tag: 'ReplacePayload', someOtherProp: 'value' }
            const schemaRemove = { tag: 'Remove', someOtherProp: 'value' }

            expect(isSchemaEdit(schemaReplace)).toBe(true)
            expect(isSchemaEdit(schemaReplaceMatch)).toBe(true)
            expect(isSchemaEdit(schemaReplacePayload)).toBe(true)
            expect(isSchemaEdit(schemaRemove)).toBe(true)
        })

        it('should not identify SchemaEditTag incorrectly', () => {
            const schema = { tag: 'NotEdit', someOtherProp: 'value' }
            expect(isSchemaEdit(schema)).toBe(false)
        })
    })
})