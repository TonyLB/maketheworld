import { isSchemaReplaceTag, isSchemaReplaceMatchTag, isSchemaReplacePayloadTag, isSchemaRemoveTag, isSchemaEditTag } from './edit'

describe('edit tags', () => {
    describe('SchemaReplaceTag', () => {
        it('should identify SchemaReplaceTag correctly', () => {
            const schema = { tag: 'Replace', someOtherProp: 'value' }
            expect(isSchemaReplaceTag(schema)).toBe(true)
        })

        it('should not identify SchemaReplaceTag incorrectly', () => {
            const schema = { tag: 'NotReplace', someOtherProp: 'value' }
            expect(isSchemaReplaceTag(schema)).toBe(false)
        })
    })

    describe('SchemaReplaceMatchTag', () => {
        it('should identify SchemaReplaceMatchTag correctly', () => {
            const schema = { tag: 'ReplaceMatch', someOtherProp: 'value' }
            expect(isSchemaReplaceMatchTag(schema)).toBe(true)
        })

        it('should not identify SchemaReplaceMatchTag incorrectly', () => {
            const schema = { tag: 'NotReplaceMatch', someOtherProp: 'value' }
            expect(isSchemaReplaceMatchTag(schema)).toBe(false)
        })
    })

    describe('SchemaReplacePayloadTag', () => {
        it('should identify SchemaReplacePayloadTag correctly', () => {
            const schema = { tag: 'ReplacePayload', someOtherProp: 'value' }
            expect(isSchemaReplacePayloadTag(schema)).toBe(true)
        })

        it('should not identify SchemaReplacePayloadTag incorrectly', () => {
            const schema = { tag: 'NotReplacePayload', someOtherProp: 'value' }
            expect(isSchemaReplacePayloadTag(schema)).toBe(false)
        })
    })

    describe('SchemaRemoveTag', () => {
        it('should identify SchemaRemoveTag correctly', () => {
            const schema = { tag: 'Remove', someOtherProp: 'value' }
            expect(isSchemaRemoveTag(schema)).toBe(true)
        })

        it('should not identify SchemaRemoveTag incorrectly', () => {
            const schema = { tag: 'NotRemove', someOtherProp: 'value' }
            expect(isSchemaRemoveTag(schema)).toBe(false)
        })
    })

    describe('SchemaEditTag', () => {
        it('should identify SchemaEditTag correctly', () => {
            const schemaReplace = { tag: 'Replace', someOtherProp: 'value' }
            const schemaReplaceMatch = { tag: 'ReplaceMatch', someOtherProp: 'value' }
            const schemaReplacePayload = { tag: 'ReplacePayload', someOtherProp: 'value' }
            const schemaRemove = { tag: 'Remove', someOtherProp: 'value' }

            expect(isSchemaEditTag(schemaReplace)).toBe(true)
            expect(isSchemaEditTag(schemaReplaceMatch)).toBe(true)
            expect(isSchemaEditTag(schemaReplacePayload)).toBe(true)
            expect(isSchemaEditTag(schemaRemove)).toBe(true)
        })

        it('should not identify SchemaEditTag incorrectly', () => {
            const schema = { tag: 'NotEdit', someOtherProp: 'value' }
            expect(isSchemaEditTag(schema)).toBe(false)
        })
    })
})