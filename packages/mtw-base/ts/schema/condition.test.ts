import { isSchemaSelected, isSchemaCondition, isSchemaConditionStatement, isSchemaConditionFallthrough } from './condition'

describe('condition tags', () => {
    describe('isSchemaSelected', () => {
        it('should return true for valid SchemaSelectedTag', () => {
            const schema = { tag: 'Selected' }
            expect(isSchemaSelected(schema)).toBe(true)
        })

        it('should return false for invalid SchemaSelectedTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaSelected(schema)).toBe(false)
        })
    })

    describe('isSchemaCondition', () => {
        it('should return true for valid SchemaConditionTag', () => {
            const schema = { tag: 'If' }
            expect(isSchemaCondition(schema)).toBe(true)
        })

        it('should return false for invalid SchemaConditionTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaCondition(schema)).toBe(false)
        })
    })

    describe('isSchemaConditionStatement', () => {
        it('should return true for valid SchemaConditionStatementTag', () => {
            const schema = { tag: 'Statement', if: 'condition' }
            expect(isSchemaConditionStatement(schema)).toBe(true)
        })

        it('should return false for invalid SchemaConditionStatementTag', () => {
            const schema = { tag: 'Invalid', if: 'condition' }
            expect(isSchemaConditionStatement(schema)).toBe(false)
        })

        it('should return false for SchemaConditionStatementTag missing if', () => {
            const schema = { tag: 'Statement' }
            expect(isSchemaConditionStatement(schema)).toBe(false)
        })
    })

    describe('isSchemaConditionFallthrough', () => {
        it('should return true for valid SchemaConditionFallthroughTag', () => {
            const schema = { tag: 'Fallthrough' }
            expect(isSchemaConditionFallthrough(schema)).toBe(true)
        })

        it('should return false for invalid SchemaConditionFallthroughTag', () => {
            const schema = { tag: 'Invalid' }
            expect(isSchemaConditionFallthrough(schema)).toBe(false)
        })
    })
})