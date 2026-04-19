import { isAcmeOrderPublishedOrder } from './publishedEvents'

describe('isAcmeOrderPublishedOrder', () => {
    const minimal = {
        shortName: 'Anvil',
        stableKey: 'anvil',
        affinities: [{ role: 'terminal' as const, aptness: 0.5 }],
    }

    it('accepts minimal order with stableKey', () => {
        expect(isAcmeOrderPublishedOrder(minimal)).toBe(true)
    })

    it('rejects missing stableKey', () => {
        expect(isAcmeOrderPublishedOrder({
            shortName: 'Anvil',
            affinities: [{ role: 'terminal' as const, aptness: 0.5 }],
        } as unknown)).toBe(false)
    })

    it('rejects stableKey empty or whitespace-only', () => {
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: '' })).toBe(false)
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: '   ' })).toBe(false)
    })

    it('rejects stableKey wrong type', () => {
        expect(isAcmeOrderPublishedOrder({ ...minimal, stableKey: 1 } as unknown)).toBe(false)
    })
})
