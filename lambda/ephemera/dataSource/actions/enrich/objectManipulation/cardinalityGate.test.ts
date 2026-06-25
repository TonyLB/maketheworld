import { evaluateCardinalityGate } from './cardinalityGate'

describe('evaluateCardinalityGate', () => {
    it('continues for a single object span', () => {
        expect(evaluateCardinalityGate(['broom'])).toEqual({ type: 'continue' })
    })

    it('continues for an empty span list', () => {
        expect(evaluateCardinalityGate([])).toEqual({ type: 'continue' })
    })

    it('returns multiObject complex for more than one span', () => {
        expect(evaluateCardinalityGate(['broom', 'anvil'])).toEqual({
            type: 'complex',
            complexityClass: 'multiObject',
        })
    })
})
