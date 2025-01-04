import { isSchemaVariableTag, isSchemaComputedTag, isSchemaActionTag } from './computation'

describe('computation tags', () => {
    describe('isSchemaVariableTag', () => {
        it('should return true for valid SchemaVariableTag', () => {
            const schema = { tag: 'Variable', key: 'variableKey' }
            expect(isSchemaVariableTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaVariableTag', () => {
            const schema = { tag: 'Invalid', key: 'variableKey' }
            expect(isSchemaVariableTag(schema)).toBe(false)
        })

        it('should return false for SchemaVariableTag missing key', () => {
            const schema = { tag: 'Variable' }
            expect(isSchemaVariableTag(schema)).toBe(false)
        })
    })

    describe('isSchemaComputedTag', () => {
        it('should return true for valid SchemaComputedTag', () => {
            const schema = { tag: 'Computed', key: 'computedKey', src: 'source' }
            expect(isSchemaComputedTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaComputedTag', () => {
            const schema = { tag: 'Invalid', key: 'computedKey', src: 'source' }
            expect(isSchemaComputedTag(schema)).toBe(false)
        })

        it('should return false for SchemaComputedTag missing key', () => {
            const schema = { tag: 'Computed', src: 'source' }
            expect(isSchemaComputedTag(schema)).toBe(false)
        })

        it('should return false for SchemaComputedTag missing src', () => {
            const schema = { tag: 'Computed', key: 'computedKey' }
            expect(isSchemaComputedTag(schema)).toBe(false)
        })

        it('should return true for SchemaComputedTag with dependencies', () => {
            const schema = { tag: 'Computed', key: 'computedKey', src: 'source', dependencies: ['dep1', 'dep2'] }
            expect(isSchemaComputedTag(schema)).toBe(true)
        })

        it('should return false for SchemaComputedTag with invalid dependencies', () => {
            const schema = { tag: 'Computed', key: 'computedKey', src: 'source', dependencies: ['dep1', 2] }
            expect(isSchemaComputedTag(schema)).toBe(false)
        })
    })

    describe('isSchemaActionTag', () => {
        it('should return true for valid SchemaActionTag', () => {
            const schema = { tag: 'Action', key: 'actionKey', src: 'source' }
            expect(isSchemaActionTag(schema)).toBe(true)
        })

        it('should return false for invalid SchemaActionTag', () => {
            const schema = { tag: 'Invalid', key: 'actionKey', src: 'source' }
            expect(isSchemaActionTag(schema)).toBe(false)
        })

        it('should return false for SchemaActionTag missing key', () => {
            const schema = { tag: 'Action', src: 'source' }
            expect(isSchemaActionTag(schema)).toBe(false)
        })

        it('should return false for SchemaActionTag missing src', () => {
            const schema = { tag: 'Action', key: 'actionKey' }
            expect(isSchemaActionTag(schema)).toBe(false)
        })
    })
})