import { isSchemaVariable, isSchemaComputed, isSchemaAction } from './computation'

describe('computation tags', () => {
    describe('isSchemaVariable', () => {
        it('should return true for valid SchemaVariableTag', () => {
            const schema = { tag: 'Variable', key: 'variableKey' }
            expect(isSchemaVariable(schema)).toBe(true)
        })

        it('should return false for invalid SchemaVariableTag', () => {
            const schema = { tag: 'Invalid', key: 'variableKey' }
            expect(isSchemaVariable(schema)).toBe(false)
        })

        it('should return false for SchemaVariableTag missing key', () => {
            const schema = { tag: 'Variable' }
            expect(isSchemaVariable(schema)).toBe(false)
        })
    })

    describe('isSchemaComputed', () => {
        it('should return true for valid SchemaComputedTag', () => {
            const schema = { tag: 'Computed', key: 'computedKey', src: 'source' }
            expect(isSchemaComputed(schema)).toBe(true)
        })

        it('should return false for invalid SchemaComputedTag', () => {
            const schema = { tag: 'Invalid', key: 'computedKey', src: 'source' }
            expect(isSchemaComputed(schema)).toBe(false)
        })

        it('should return false for SchemaComputedTag missing key', () => {
            const schema = { tag: 'Computed', src: 'source' }
            expect(isSchemaComputed(schema)).toBe(false)
        })

        it('should return false for SchemaComputedTag missing src', () => {
            const schema = { tag: 'Computed', key: 'computedKey' }
            expect(isSchemaComputed(schema)).toBe(false)
        })

        it('should return true for SchemaComputedTag with dependencies', () => {
            const schema = { tag: 'Computed', key: 'computedKey', src: 'source', dependencies: ['dep1', 'dep2'] }
            expect(isSchemaComputed(schema)).toBe(true)
        })

        it('should return false for SchemaComputedTag with invalid dependencies', () => {
            const schema = { tag: 'Computed', key: 'computedKey', src: 'source', dependencies: ['dep1', 2] }
            expect(isSchemaComputed(schema)).toBe(false)
        })
    })

    describe('isSchemaAction', () => {
        it('should return true for valid SchemaActionTag', () => {
            const schema = { tag: 'Action', key: 'actionKey', src: 'source' }
            expect(isSchemaAction(schema)).toBe(true)
        })

        it('should return false for invalid SchemaActionTag', () => {
            const schema = { tag: 'Invalid', key: 'actionKey', src: 'source' }
            expect(isSchemaAction(schema)).toBe(false)
        })

        it('should return false for SchemaActionTag missing key', () => {
            const schema = { tag: 'Action', src: 'source' }
            expect(isSchemaAction(schema)).toBe(false)
        })

        it('should return false for SchemaActionTag missing src', () => {
            const schema = { tag: 'Action', key: 'actionKey' }
            expect(isSchemaAction(schema)).toBe(false)
        })
    })
})