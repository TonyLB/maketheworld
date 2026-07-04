import { commandHasRelationalPreposition } from './relationalPrepositionGuard'

describe('commandHasRelationalPreposition', () => {
    it('blocks on word boundary', () => {
        expect(commandHasRelationalPreposition('put the broom on the table')).toBe(true)
    })

    it('blocks under word boundary', () => {
        expect(commandHasRelationalPreposition('stash it under the bench')).toBe(true)
    })

    it('does not block onward or understand', () => {
        expect(commandHasRelationalPreposition('move onward')).toBe(false)
        expect(commandHasRelationalPreposition('help me understand')).toBe(false)
    })

    it('does not block bare take or drop', () => {
        expect(commandHasRelationalPreposition('pick up the broom')).toBe(false)
        expect(commandHasRelationalPreposition('drop the broom')).toBe(false)
    })
})
