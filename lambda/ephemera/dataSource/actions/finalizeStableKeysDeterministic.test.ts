import { finalizeStableKeysDeterministic } from './finalizeStableKeysDeterministic'

describe('finalizeStableKeysDeterministic', () => {
    it('normalizes charset and folds case', () => {
        const keys = finalizeStableKeysDeterministic(
            [{ name: 'X', proposedStableKey: '  Rocket_Powered!! ' }],
            new Set()
        )
        expect(keys).toEqual(['rocket-powered'])
    })

    it('never emits keys starting with constructed- (remaps to acme-)', () => {
        const keys = finalizeStableKeysDeterministic(
            [{ name: 'Widget', proposedStableKey: 'constructed-widget' }],
            new Set()
        )
        expect(keys).toEqual(['acme-widget'])
        expect(keys[0].startsWith('constructed-')).toBe(false)
    })

    it('picks next free numeric suffix when occupied collides with Coyote-wide set', () => {
        const keys = finalizeStableKeysDeterministic(
            [{ name: 'R', proposedStableKey: 'rocket2' }],
            new Set(['rocket', 'rocket1', 'rocket2'])
        )
        expect(keys).toEqual(['rocket3'])
    })

    it('separates intra-batch duplicate proposals', () => {
        const keys = finalizeStableKeysDeterministic(
            [
                { name: 'A', proposedStableKey: 'anvil' },
                { name: 'B', proposedStableKey: 'anvil' },
            ],
            new Set()
        )
        expect(keys).toEqual(['anvil', 'anvil1'])
    })

    it('assigns consecutive suffixes when the same base collides repeatedly', () => {
        const keys = finalizeStableKeysDeterministic(
            [
                { name: 'A', proposedStableKey: 'bolt' },
                { name: 'B', proposedStableKey: 'bolt' },
                { name: 'C', proposedStableKey: 'bolt' },
            ],
            new Set(['bolt'])
        )
        expect(keys).toEqual(['bolt1', 'bolt2', 'bolt3'])
    })

    it('uses defaultStableKeyProposal when proposedStableKey is omitted', () => {
        const keys = finalizeStableKeysDeterministic(
            [{ name: 'Iron Anvil' }],
            new Set()
        )
        expect(keys).toEqual(['iron-anvil'])
    })

    /**
     * Legacy **`Meta::Room.objects`** rows may omit **`stableKey`**; callers building
     * **`coyoteOccupiedStableKeys`** must not invent placeholder keys for those rows.
     */
    it('documents legacy occupancy posture (caller omits unknown keys from occupied set)', () => {
        expect(finalizeStableKeysDeterministic([{ name: 'Z', proposedStableKey: 'z' }], new Set())).toEqual([
            'z',
        ])
    })
})
