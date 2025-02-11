import { isSchemaGrant } from './authorization';

describe('authorization tags', () => {
    describe('isSchemaGrant', () => {
        it('should return true for valid SchemaGrantTag', () => {
            const schema = { tag: 'Grant', player: 'player1', actions: ['action1', 'action2'] }
            expect(isSchemaGrant(schema)).toBe(true)
        })

        it('should return false for invalid SchemaGrantTag with wrong tag', () => {
            const schema = { tag: 'Invalid', player: 'player1', actions: ['action1', 'action2'] }
            expect(isSchemaGrant(schema)).toBe(false)
        })

        it('should return false for invalid SchemaGrantTag with missing player', () => {
            const schema = { tag: 'Grant', actions: ['action1', 'action2'] }
            expect(isSchemaGrant(schema)).toBe(false)
        })

        it('should return false for invalid SchemaGrantTag with non-string player', () => {
            const schema = { tag: 'Grant', player: 123, actions: ['action1', 'action2'] }
            expect(isSchemaGrant(schema)).toBe(false)
        })

        it('should return false for invalid SchemaGrantTag with non-array actions', () => {
            const schema = { tag: 'Grant', player: 'player1', actions: 'action1' }
            expect(isSchemaGrant(schema)).toBe(false)
        })

        it('should return false for invalid SchemaGrantTag with non-string actions', () => {
            const schema = { tag: 'Grant', player: 'player1', actions: [123, 'action2'] }
            expect(isSchemaGrant(schema)).toBe(false)
        })
    })
})