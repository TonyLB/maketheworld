import {
    isAcmeOrderPublishedOrder,
    isCharacterHomePublishedPayload,
    isCharacterNavigatePublishedPayload,
    isLookCommandRequestedPublishedPayload,
    isObjectTakeHoldPublishedPayload,
    isPredictHypothesisPublishedPayload,
} from './publishedEvents'

describe('isAcmeOrderPublishedOrder', () => {
    const minimal = {
        shortName: 'Anvil',
        stableKey: 'anvil',
    }

    it('accepts minimal order with stableKey', () => {
        expect(isAcmeOrderPublishedOrder(minimal)).toBe(true)
    })

    it('rejects missing stableKey', () => {
        expect(isAcmeOrderPublishedOrder({
            shortName: 'Anvil',
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

    it('accepts Scene Dressing tropeAffinities', () => {
        expect(
            isAcmeOrderPublishedOrder({
                shortName: 'helmet',
                stableKey: 'helmet',
                tropeAffinities: [{
                    trope: 'Scene Dressing',
                    aptness: 'Good',
                    narrowing: 'protective equipment',
                }],
            })
        ).toBe(true)
    })

    it('rejects Scene Dressing in affordance roles', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    environmentAffordances: [{
                        object: 'boulder',
                        roles: ['Scene Dressing'],
                    }],
                }],
            })
        ).toBe(false)
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

    it('accepts tropeAffinities affordancesProvided when structured objects', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'electrical generator',
                    affordancesProvided: [{
                        object: 'lightning',
                        intended: true,
                        roles: ['Contraption', 'Finishing Move'],
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
                    environmentAffordances: [{
                        object: 'boulder',
                        roles: ['Finishing Move'],
                    }],
                    affordancesProvided: [{
                        object: 'long rope for setting off',
                        roles: ['Contraption'],
                    }],
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

    it('rejects tropeAffinities affordancesProvided when invalid', () => {
        expect(
            isAcmeOrderPublishedOrder({
                ...minimal,
                tropeAffinities: [{
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'launch rig',
                    affordancesProvided: [{
                        object: 'drop trigger',
                        intended: false,
                        roles: ['Contraption'],
                    }],
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
                    affordancesProvided: [{
                        object: 4,
                        roles: ['Contraption'],
                    }],
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
                    affordancesProvided: [{
                        object: 'drop trigger',
                        roles: [],
                    }],
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

describe('isCharacterNavigatePublishedPayload', () => {
    const minimal = {
        type: 'Character Navigate' as const,
        characterId: 'CHARACTER#test',
        fromRoomId: 'ROOM#from',
        toRoomId: 'ROOM#to',
    }

    it('accepts a valid payload', () => {
        expect(isCharacterNavigatePublishedPayload(minimal)).toBe(true)
    })

    it('accepts optional exitName', () => {
        expect(isCharacterNavigatePublishedPayload({ ...minimal, exitName: 'north' })).toBe(true)
    })

    it('rejects empty or non-string exitName', () => {
        expect(isCharacterNavigatePublishedPayload({ ...minimal, exitName: '' })).toBe(false)
        expect(isCharacterNavigatePublishedPayload({ ...minimal, exitName: '   ' })).toBe(false)
        expect(isCharacterNavigatePublishedPayload({ ...minimal, exitName: 1 } as unknown)).toBe(false)
    })

    it('rejects wrong or missing type', () => {
        expect(isCharacterNavigatePublishedPayload({ ...minimal, type: 'Character Home' })).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isCharacterNavigatePublishedPayload(rest)).toBe(false)
    })

    it('rejects non-string endpoint fields', () => {
        expect(isCharacterNavigatePublishedPayload({ ...minimal, fromRoomId: 1 } as unknown)).toBe(false)
        expect(isCharacterNavigatePublishedPayload({ ...minimal, toRoomId: null } as unknown)).toBe(false)
    })
})

describe('isObjectTakeHoldPublishedPayload', () => {
    const minimal = {
        type: 'Object Take Hold' as const,
        characterId: 'CHARACTER#test',
        objectId: 'OBJECT#Broom',
        roomId: 'ROOM#from',
    }

    it('accepts a valid payload', () => {
        expect(isObjectTakeHoldPublishedPayload(minimal)).toBe(true)
    })

    it('accepts optional confidence', () => {
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, confidence: 0.92 })).toBe(true)
    })

    it('rejects wrong or missing type', () => {
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, type: 'Character Navigate' })).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isObjectTakeHoldPublishedPayload(rest)).toBe(false)
    })

    it('rejects invalid ids', () => {
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, characterId: 'ROOM#x' })).toBe(false)
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, objectId: 'ROOM#x' })).toBe(false)
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, roomId: 'OBJECT#x' })).toBe(false)
    })

    it('rejects non-finite confidence', () => {
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, confidence: NaN })).toBe(false)
        expect(isObjectTakeHoldPublishedPayload({ ...minimal, confidence: Infinity })).toBe(false)
    })
})

describe('isCharacterHomePublishedPayload', () => {
    const minimal = {
        type: 'Character Home' as const,
        characterId: 'CHARACTER#test',
        fromRoomId: 'ROOM#from',
        toRoomId: 'ROOM#home',
    }

    it('accepts a valid payload', () => {
        expect(isCharacterHomePublishedPayload(minimal)).toBe(true)
    })

    it('rejects wrong or missing type', () => {
        expect(isCharacterHomePublishedPayload({ ...minimal, type: 'Character Navigate' })).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isCharacterHomePublishedPayload(rest)).toBe(false)
    })

    it('rejects non-string endpoint fields', () => {
        expect(isCharacterHomePublishedPayload({ ...minimal, characterId: 1 } as unknown)).toBe(false)
        expect(isCharacterHomePublishedPayload({ ...minimal, fromRoomId: null } as unknown)).toBe(false)
    })
})

describe('isLookCommandRequestedPublishedPayload', () => {
    const minimal = {
        type: 'Look Command Requested' as const,
        characterId: 'CHAR#test',
        componentId: 'ROOM#test',
        confidence: 1,
    }

    it('accepts a valid payload', () => {
        expect(isLookCommandRequestedPublishedPayload(minimal)).toBe(true)
    })

    it('accepts feature and knowledge componentId with optional directResponse', () => {
        expect(isLookCommandRequestedPublishedPayload({
            ...minimal,
            componentId: 'FEATURE#door',
        })).toBe(true)
        expect(isLookCommandRequestedPublishedPayload({
            ...minimal,
            componentId: 'KNOWLEDGE#lore',
            directResponse: true,
        })).toBe(true)
    })

    it('rejects wrong or missing type', () => {
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, type: 'Look Room' })).toBe(false)
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, type: 1 } as unknown)).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isLookCommandRequestedPublishedPayload(rest)).toBe(false)
    })

    it('rejects non-string characterId or componentId', () => {
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, characterId: 1 } as unknown)).toBe(
            false,
        )
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, componentId: null } as unknown)).toBe(
            false,
        )
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, componentId: 'CHARACTER#x' })).toBe(
            false,
        )
    })

    it('rejects invalid directResponse', () => {
        expect(isLookCommandRequestedPublishedPayload({
            ...minimal,
            directResponse: 'yes' as unknown as boolean,
        })).toBe(false)
    })

    it('rejects non-finite confidence', () => {
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, confidence: NaN })).toBe(false)
        expect(isLookCommandRequestedPublishedPayload({ ...minimal, confidence: Infinity })).toBe(
            false,
        )
    })
})

describe('isPredictHypothesisPublishedPayload', () => {
    const minimal = {
        type: 'Predict Hypothesis' as const,
        characterId: 'CHARACTER#test',
        confidence: 0.91,
    }

    it('accepts a valid payload', () => {
        expect(isPredictHypothesisPublishedPayload(minimal)).toBe(true)
    })

    it('rejects wrong or missing type', () => {
        expect(isPredictHypothesisPublishedPayload({ ...minimal, type: 'Await RoadRunner' })).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isPredictHypothesisPublishedPayload(rest)).toBe(false)
    })

    it('rejects non-string characterId', () => {
        expect(isPredictHypothesisPublishedPayload({ ...minimal, characterId: 1 } as unknown)).toBe(false)
        expect(isPredictHypothesisPublishedPayload({ ...minimal, characterId: null } as unknown)).toBe(false)
    })

    it('rejects non-finite confidence', () => {
        expect(isPredictHypothesisPublishedPayload({ ...minimal, confidence: NaN })).toBe(false)
        expect(isPredictHypothesisPublishedPayload({ ...minimal, confidence: Infinity })).toBe(false)
    })
})
