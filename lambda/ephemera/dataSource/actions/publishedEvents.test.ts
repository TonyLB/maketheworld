import { isAcmeOrderPublishedOrder } from './publishedEvents'

describe('isAcmeOrderPublishedOrder', () => {
    const minimal = {
        shortName: 'Anvil',
        affinities: [{ role: 'terminal' as const, aptness: 0.5 }],
    }

    it('accepts minimal order without stableKey', () => {
        expect(isAcmeOrderPublishedOrder(minimal)).toBe(true)
    })

    it('accepts stableKey when non-empty after trim', () => {
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: 'anvil' })).toBe(true)
    })

    it('rejects stableKey empty or whitespace-only', () => {
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: '' })).toBe(false)
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: '   ' })).toBe(false)
    })

    it('rejects stableKey wrong type', () => {
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: 1 } as unknown)).toBe(false)
    })
})
