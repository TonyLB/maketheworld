import { isSchemaSelectedTag, isSchemaConditionTag, isSchemaConditionStatementTag, isSchemaConditionFallthroughTag } from './condition';

describe('condition tags', () => {
    describe('isSchemaSelectedTag', () => {
        it('should return true for valid SchemaSelectedTag', () => {
            const schema = { tag: 'Selected' };
            expect(isSchemaSelectedTag(schema)).toBe(true);
        });

        it('should return false for invalid SchemaSelectedTag', () => {
            const schema = { tag: 'Invalid' };
            expect(isSchemaSelectedTag(schema)).toBe(false);
        });
    });

    describe('isSchemaConditionTag', () => {
        it('should return true for valid SchemaConditionTag', () => {
            const schema = { tag: 'If' };
            expect(isSchemaConditionTag(schema)).toBe(true);
        });

        it('should return false for invalid SchemaConditionTag', () => {
            const schema = { tag: 'Invalid' };
            expect(isSchemaConditionTag(schema)).toBe(false);
        });
    });

    describe('isSchemaConditionStatementTag', () => {
        it('should return true for valid SchemaConditionStatementTag', () => {
            const schema = { tag: 'Statement', if: 'condition' };
            expect(isSchemaConditionStatementTag(schema)).toBe(true);
        });

        it('should return false for invalid SchemaConditionStatementTag', () => {
            const schema = { tag: 'Invalid', if: 'condition' };
            expect(isSchemaConditionStatementTag(schema)).toBe(false);
        });

        it('should return false for SchemaConditionStatementTag missing if', () => {
            const schema = { tag: 'Statement' };
            expect(isSchemaConditionStatementTag(schema)).toBe(false);
        });
    });

    describe('isSchemaConditionFallthroughTag', () => {
        it('should return true for valid SchemaConditionFallthroughTag', () => {
            const schema = { tag: 'Fallthrough' };
            expect(isSchemaConditionFallthroughTag(schema)).toBe(true);
        });

        it('should return false for invalid SchemaConditionFallthroughTag', () => {
            const schema = { tag: 'Invalid' };
            expect(isSchemaConditionFallthroughTag(schema)).toBe(false);
        });
    });
});