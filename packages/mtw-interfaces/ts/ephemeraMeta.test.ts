import { isEphemeraMetaRoomObject } from './ephemeraMeta'

const baseRow = {
    uuid: 'OBJECT#helmet' as const,
    shortName: 'helmet',
    stableKey: 'helmet',
}

describe('isEphemeraMetaRoomObject', () => {
    it('accepts minimal row without trope fields', () => {
        expect(isEphemeraMetaRoomObject(baseRow)).toBe(true)
    })

    it('accepts Scene Dressing tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [{
                    trope: 'Scene Dressing',
                    aptness: 'Good',
                    narrowing: 'protective equipment',
                }],
            })
        ).toBe(true)
    })

    it('accepts mixed Scene Dressing and causal tropes', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                uuid: 'OBJECT#skates' as const,
                shortName: 'rocket skates',
                stableKey: 'rocket-skates',
                tropeAffinities: [
                    { trope: 'Contraption', aptness: 'High', narrowing: 'coyote mobility rig' },
                    { trope: 'Scene Dressing', aptness: 'Good', narrowing: 'racing gear' },
                ],
            })
        ).toBe(true)
    })

    it('accepts tropeAffinitiesFailed with empty tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            })
        ).toBe(true)
    })

    it('rejects invalid trope string', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [{ trope: 'wizard', aptness: 'High', narrowing: 'x' }],
            })
        ).toBe(false)
    })

    it('rejects tropeAffinitiesFailed true with non-empty tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [{ trope: 'Scene Dressing', aptness: 'Good', narrowing: 'gear' }],
                tropeAffinitiesFailed: true,
            })
        ).toBe(false)
    })

    it('rejects more than three tropeAffinities', () => {
        expect(
            isEphemeraMetaRoomObject({
                ...baseRow,
                tropeAffinities: [
                    { trope: 'Bait', aptness: 'High', narrowing: 'a' },
                    { trope: 'Bait', aptness: 'Good', narrowing: 'b' },
                    { trope: 'Bait', aptness: 'Poor', narrowing: 'c' },
                    { trope: 'Bait', aptness: 'High', narrowing: 'd' },
                ],
            })
        ).toBe(false)
    })

    it('rejects missing stableKey', () => {
        expect(
            isEphemeraMetaRoomObject({
                uuid: 'OBJECT#a' as const,
                shortName: 'Anvil',
            })
        ).toBe(false)
    })
})
