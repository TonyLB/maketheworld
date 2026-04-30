import { isAcmeOrderPublishedOrder, isLookCommandRequestedPublishedPayload } from './publishedEvents'

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

    it('accepts canonical trope fields when present', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'launch rig' }],
            })
        ).toBe(true)
    })

    it('accepts tropeAffinities environmentAffordances when structured objects', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    environmentAffordances: [{
                        object: 'boulder',
                        roles: ['Finishing Move'],
                    }],
                }],
            })
        ).toBe(true)
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    environmentAffordances: [],
                }],
            })
        ).toBe(true)
    })

    it('rejects tropeAffinities environmentAffordances when invalid', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    environmentAffordances: 'payload cradle',
                }],
            } as unknown)
        ).toBe(false)
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    environmentAffordances: [{
                        object: 'boulder',
                        roles: ['Finishing Move'],
                    }, 1],
                }],
            } as unknown)
        ).toBe(false)
    })

    it('rejects tropeAffinities legacy affordances key', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    affordances: ['payload cradle'],
                }],
            } as unknown)
        ).toBe(false)
    })

    it('rejects tropeAffinitiesFailed true with non-empty tropeAffinities', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{ trope: 'Contraption', aptness: 'High', narrowing: 'launch rig' }],
                tropeAffinitiesFailed: true,
            })
        ).toBe(false)
    })
})

describe('isLookCommandRequestedPublishedPayload', () => {
    const minimal = {
        type: 'Look Command Requested' as const,
        characterId: 'CHAR#test',
        roomId: 'ROOM#test',
        confidence: 1,
    }

    it('accepts a valid payload', () => {
        expect(isLookCommandRequestedPublishedPayload(minimal)).toBe(true)
    })

    it('rejects wrong or missing type', () => {
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, type: 'Look Room' })).toBe(false)
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, type: 1 } as unknown)).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isLookCommandRequestedPublishedPayload(rest)).toBe(false)
    })

    it('rejects non-string characterId or roomId', () => {
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, characterId: 1 } as unknown)).toBe(
            false,
        )
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, roomId: null } as unknown)).toBe(
            false,
        )
    })

    it('rejects non-finite confidence', () => {
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, confidence: NaN })).toBe(false)
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, confidence: Infinity })).toBe(
            false,
        )
    })
})
