import { COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY } from './coyotePlanAffinities'
import {
    normalizedPhasePlanStableKey,
    validateCoyotePhasePlan,
    type CoyotePhasePlanValidationContext,
} from './coyotePhasePlan'

const snapshot = new Set(['anvil-1', 'outlier-prop', 'crate-2'])

function ctx(overrides: Partial<CoyotePhasePlanValidationContext> = {}): CoyotePhasePlanValidationContext {
    return {
        snapshotStableKeys: snapshot,
        ...overrides,
    }
}

/** One phase with one virtual grounded on the first snapshot key (and listed in stableKeysUsed). */
function minimalValidPlan() {
    return {
        phases: [
            {
                stableKeysUsed: ['anvil-1'],
                virtualEntities: [
                    {
                        label: 'Lift anvil',
                        derivedFrom: ['anvil-1'],
                        phaseKind: 'gathered',
                    },
                ],
                achievement: 'Anvil is positioned',
            },
        ],
    }
}

describe('validateCoyotePhasePlan', () => {
    it('accepts a minimal valid plan', () => {
        const result = validateCoyotePhasePlan(minimalValidPlan(), ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.phases).toHaveLength(1)
            expect(result.phasePlan.phases[0].stableKeysUsed).toEqual(['anvil-1'])
        }
    })

    it('rejects extra root keys', () => {
        const raw = { ...minimalValidPlan(), extra: 1 }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('exactly the key "phases"')
        }
    })

    it('rejects extra keys on a phase', () => {
        const raw = {
            phases: [
                {
                    ...minimalValidPlan().phases[0],
                    notes: 'nope',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('unexpected key on phase')
        }
    })

    it('rejects extra keys on a virtual entity', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'gathered',
                            weight: 1,
                        },
                    ],
                    achievement: 'y',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('unexpected key on virtual entity')
        }
    })

    it('rejects reserved setting token in stableKeysUsed', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'y',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('must not appear in stableKeysUsed')
        }
    })

    it('rejects unknown snapshot stableKey in stableKeysUsed', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['not-in-snapshot'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'deployed',
                        },
                    ],
                    achievement: 'y',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('unknown snapshot stableKey')
        }
    })

    it('allows derivedFrom to mix reserved setting and snapshot keys', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [
                        {
                            label: 'Desert rock',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY, 'crate-2'],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'Prop ready',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
    })

    it('allows stableKeysUsed for keys that would be clustering outliers (present on snapshot)', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [
                        {
                            label: 'Use outlier',
                            derivedFrom: ['outlier-prop'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'Outlier incorporated',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
    })

    it('rejects topology-only derivedFrom when no topology allowlist is provided', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'Cliff cue',
                            derivedFrom: ['VORTEX'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'z',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('not a snapshot stableKey')
        }
    })

    it('allows topology tokens when allowlist matches (case-insensitive)', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'Cliff cue',
                            derivedFrom: ['vortex'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'z',
                },
            ],
        }
        const result = validateCoyotePhasePlan(
            raw,
            ctx({ allowedTopologyRefTokens: new Set(['VORTEX']) })
        )
        expect(result.ok).toBe(true)
    })

    it('mentions topology allowlist when it is provided and the token is invalid', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['UNKNOWN-ROOM'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'y',
                },
            ],
        }
        const result = validateCoyotePhasePlan(
            raw,
            ctx({ allowedTopologyRefTokens: new Set(['VORTEX']) })
        )
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('topology allowlist')
        }
    })

    it('rejects empty phases array', () => {
        const result = validateCoyotePhasePlan({ phases: [] }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('non-empty')
        }
    })

    it('enforces maxSettingOnlyVirtualsPerPhase cap', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: [],
                    virtualEntities: [
                        {
                            label: 'Rock a',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                            phaseKind: 'synthesized',
                        },
                        {
                            label: 'Rock b',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'Stock scenery',
                },
            ],
        }
        const pass = validateCoyotePhasePlan(raw, ctx({ caps: { maxSettingOnlyVirtualsPerPhase: 2 } }))
        expect(pass.ok).toBe(true)

        const fail = validateCoyotePhasePlan(raw, ctx({ caps: { maxSettingOnlyVirtualsPerPhase: 1 } }))
        expect(fail.ok).toBe(false)
        if (!fail.ok) {
            expect(fail.reason).toContain('exceeds maxSettingOnlyVirtualsPerPhase')
        }
    })

    it('does not count virtuals with a snapshot key toward the setting-only cap', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'Real prop beat',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'deployed',
                        },
                        {
                            label: 'Setting furniture',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                            phaseKind: 'synthesized',
                        },
                        {
                            label: 'Setting furniture 2',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'x',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx({ caps: { maxSettingOnlyVirtualsPerPhase: 2 } }))
        expect(result.ok).toBe(true)
    })

    it('accepts optional prepVsBeat', () => {
        const raw = {
            phases: [
                {
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'y',
                    prepVsBeat: 'prep',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.phases[0].prepVsBeat).toBe('prep')
        }
    })
})

describe('normalizedPhasePlanStableKey', () => {
    it('matches snapshot normalization used in validation', () => {
        expect(normalizedPhasePlanStableKey('  Anvil-1  ')).toBe('anvil-1')
    })
})
