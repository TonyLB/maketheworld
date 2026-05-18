import { COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY } from './coyotePlanAffinities'
import {
    CANONICAL_TROPE_ORDER,
    normalizedPhasePlanStableKey,
    tropeSequenceFromAssignments,
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
        tropeSequence: ['Contraption'],
        deconflictionSummary: 'Use only the anvil lane and avoid duplicate prop assignments.',
        phases: [
            {
                trope: 'Contraption',
                tropeBeat: 'Rig the anvil lane with a committed trigger.',
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
            expect(result.reason).toContain('exactly keys "tropeSequence", "deconflictionSummary", and "phases"')
        }
    })

    it('rejects extra keys on a phase', () => {
        const raw = {
            ...minimalValidPlan(),
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

    it('rejects non-canonical tropeSequence order', () => {
        const raw = {
            ...minimalValidPlan(),
            tropeSequence: ['Disadvantage', 'Bait'],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('canonical order')
        }
    })

    it('rejects phase trope mismatch against tropeSequence', () => {
        const raw = {
            ...minimalValidPlan(),
            tropeSequence: ['Contraption'],
            phases: [{ ...minimalValidPlan().phases[0], trope: 'Bait' }],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('must match tropeSequence')
        }
    })

    it('rejects extra keys on a virtual entity', () => {
        const raw = {
            ...minimalValidPlan(),
            phases: [
                {
                    ...minimalValidPlan().phases[0],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'gathered',
                            weight: 1,
                        },
                    ],
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Keep setting token virtual-only.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Set the prop.',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Unknown key should fail.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Set unknown key.',
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

    it('accepts materialized affordance stableKey in stableKeysUsed when not in snapshot', () => {
        const raw = {
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Coyote finishing affordance.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Finish with coyote.',
                    stableKeysUsed: ['affordance:coyote'],
                    virtualEntities: [
                        {
                            label: 'Coyote gag',
                            derivedFrom: ['affordance:coyote'],
                            phaseKind: 'deployed',
                        },
                    ],
                    achievement: 'Beat lands',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.phases[0].stableKeysUsed).toEqual(['affordance-coyote'])
        }
    })

    it('rejects malformed materialized affordance stableKey in stableKeysUsed', () => {
        const raw = {
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Bad affordance key.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'x',
                    stableKeysUsed: ['affordance:'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'gathered',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Mix setting and staged grounding.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Blend setting with staged object.',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Outlier is still snapshot-valid.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Include outlier prop in final beat.',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Topology token invalid without allowlist.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Use cliff cue.',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Topology token accepted by allowlist.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Use cliff cue.',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Invalid topology token should error.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Use invalid cue.',
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
        const result = validateCoyotePhasePlan({
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Empty phases should fail.',
            phases: [],
        }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('non-empty')
        }
    })

    it('enforces maxSettingOnlyVirtualsPerPhase cap', () => {
        const raw = {
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Setting-only cap applies.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Stock scenery setup.',
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
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Snapshot-grounded virtuals should not count toward setting cap.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Use real prop plus setting extras.',
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

    it('does not count virtuals with only materialized affordance derivedFrom toward the setting-only cap', () => {
        const raw = {
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Materialized affordance is not setting-only.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Mix affordance virtual with setting-only virtuals.',
                    stableKeysUsed: ['affordance:coyote', 'anvil-1'],
                    virtualEntities: [
                        {
                            label: 'Coyote beat',
                            derivedFrom: ['affordance:coyote'],
                            phaseKind: 'deployed',
                        },
                        {
                            label: 'Setting a',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                            phaseKind: 'synthesized',
                        },
                        {
                            label: 'Setting b',
                            derivedFrom: [COYOTE_RESERVED_VIRTUAL_GROUNDING_STABLE_KEY],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'y',
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

    it('accepts optional prepVsBeat', () => {
        const raw = {
            tropeSequence: ['Contraption'],
            deconflictionSummary: 'Prep beat accepted.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Prep the launch line.',
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

    it('accepts Bait and Misdirection together in canonical order', () => {
        const raw = {
            tropeSequence: ['Bait', 'Misdirection'],
            deconflictionSummary: 'Lure then misread terrain.',
            phases: [
                {
                    trope: 'Bait',
                    tropeBeat: 'Birdseed draws the runner to the cliff lip.',
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [
                        {
                            label: 'Lure pile',
                            derivedFrom: ['crate-2'],
                            phaseKind: 'deployed',
                        },
                    ],
                    achievement: 'Runner is positioned',
                },
                {
                    trope: 'Misdirection',
                    tropeBeat: 'Painted tunnel reads as real at speed.',
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [
                        {
                            label: 'False tunnel mouth',
                            derivedFrom: ['outlier-prop'],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'Runner commits to the wrong vector',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.tropeSequence).toEqual(['Bait', 'Misdirection'])
        }
    })

    it('rejects Misdirection before Bait in tropeSequence', () => {
        const raw = {
            tropeSequence: ['Misdirection', 'Bait'],
            deconflictionSummary: 'Wrong order for co-occurring lure beats.',
            phases: [
                {
                    trope: 'Misdirection',
                    tropeBeat: 'Illusion first.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'a',
                },
                {
                    trope: 'Bait',
                    tropeBeat: 'Lure second.',
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [
                        {
                            label: 'y',
                            derivedFrom: ['crate-2'],
                            phaseKind: 'deployed',
                        },
                    ],
                    achievement: 'b',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('canonical order')
        }
    })

    it('accepts Scene Dressing before Contraption in tropeSequence', () => {
        const raw = {
            tropeSequence: ['Scene Dressing', 'Contraption'],
            deconflictionSummary: 'Dress the chase scene then rig hardware.',
            phases: [
                {
                    trope: 'Scene Dressing',
                    tropeBeat: 'Helmet and goggles signal racing gear around the skateboard anchor.',
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [
                        {
                            label: 'Racing gear cluster',
                            derivedFrom: ['outlier-prop'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'Archetype visible',
                },
                {
                    trope: 'Contraption',
                    tropeBeat: 'Skateboard is the causal anchor.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'Board rig',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'deployed',
                        },
                    ],
                    achievement: 'Hardware staged',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.tropeSequence).toEqual(['Scene Dressing', 'Contraption'])
        }
    })

    it('rejects Contraption before Scene Dressing in tropeSequence', () => {
        const raw = {
            tropeSequence: ['Contraption', 'Scene Dressing'],
            deconflictionSummary: 'Wrong order for dressing beat.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Rig first.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [
                        {
                            label: 'x',
                            derivedFrom: ['anvil-1'],
                            phaseKind: 'gathered',
                        },
                    ],
                    achievement: 'a',
                },
                {
                    trope: 'Scene Dressing',
                    tropeBeat: 'Dress second.',
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [
                        {
                            label: 'y',
                            derivedFrom: ['outlier-prop'],
                            phaseKind: 'synthesized',
                        },
                    ],
                    achievement: 'b',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('canonical order')
        }
    })

    it('accepts a full five-trope plan in canonical order', () => {
        const raw = {
            tropeSequence: ['Contraption', 'Bait', 'Misdirection', 'Disadvantage', 'Finishing Move'],
            deconflictionSummary: 'Golden path through every slot.',
            phases: [
                {
                    trope: 'Contraption',
                    tropeBeat: 'Rig approach hardware.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [{ label: 'c', derivedFrom: ['anvil-1'], phaseKind: 'gathered' }],
                    achievement: 'Hardware staged',
                },
                {
                    trope: 'Bait',
                    tropeBeat: 'Draw the runner.',
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [{ label: 'b', derivedFrom: ['crate-2'], phaseKind: 'deployed' }],
                    achievement: 'Runner lured',
                },
                {
                    trope: 'Misdirection',
                    tropeBeat: 'Steer perception.',
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [{ label: 'm', derivedFrom: ['outlier-prop'], phaseKind: 'synthesized' }],
                    achievement: 'Misread committed',
                },
                {
                    trope: 'Disadvantage',
                    tropeBeat: 'Impose mobility loss.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [{ label: 'd', derivedFrom: ['anvil-1'], phaseKind: 'deployed' }],
                    achievement: 'Runner impaired',
                },
                {
                    trope: 'Finishing Move',
                    tropeBeat: 'Terminal payload.',
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [{ label: 'f', derivedFrom: ['crate-2'], phaseKind: 'gathered' }],
                    achievement: 'Finisher armed',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.phases).toHaveLength(5)
        }
    })

    it('accepts a full six-trope plan in canonical order', () => {
        const raw = {
            tropeSequence: [
                'Scene Dressing',
                'Contraption',
                'Bait',
                'Misdirection',
                'Disadvantage',
                'Finishing Move',
            ],
            deconflictionSummary: 'Golden path through every slot including dressing.',
            phases: [
                {
                    trope: 'Scene Dressing',
                    tropeBeat: 'Stage protective gear as associative signal.',
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [{ label: 's', derivedFrom: ['outlier-prop'], phaseKind: 'gathered' }],
                    achievement: 'Scene dressed',
                },
                {
                    trope: 'Contraption',
                    tropeBeat: 'Rig approach hardware.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [{ label: 'c', derivedFrom: ['anvil-1'], phaseKind: 'gathered' }],
                    achievement: 'Hardware staged',
                },
                {
                    trope: 'Bait',
                    tropeBeat: 'Draw the runner.',
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [{ label: 'b', derivedFrom: ['crate-2'], phaseKind: 'deployed' }],
                    achievement: 'Runner lured',
                },
                {
                    trope: 'Misdirection',
                    tropeBeat: 'Steer perception.',
                    stableKeysUsed: ['outlier-prop'],
                    virtualEntities: [{ label: 'm', derivedFrom: ['outlier-prop'], phaseKind: 'synthesized' }],
                    achievement: 'Misread committed',
                },
                {
                    trope: 'Disadvantage',
                    tropeBeat: 'Impose mobility loss.',
                    stableKeysUsed: ['anvil-1'],
                    virtualEntities: [{ label: 'd', derivedFrom: ['anvil-1'], phaseKind: 'deployed' }],
                    achievement: 'Runner impaired',
                },
                {
                    trope: 'Finishing Move',
                    tropeBeat: 'Terminal payload.',
                    stableKeysUsed: ['crate-2'],
                    virtualEntities: [{ label: 'f', derivedFrom: ['crate-2'], phaseKind: 'gathered' }],
                    achievement: 'Finisher armed',
                },
            ],
        }
        const result = validateCoyotePhasePlan(raw, ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.phasePlan.phases).toHaveLength(6)
        }
    })
})

describe('CANONICAL_TROPE_ORDER', () => {
    it('lists six tropes with Scene Dressing first', () => {
        expect(CANONICAL_TROPE_ORDER).toHaveLength(6)
        expect(CANONICAL_TROPE_ORDER[0]).toBe('Scene Dressing')
    })
})

describe('tropeSequenceFromAssignments', () => {
    it('returns empty array when no tropes are assigned', () => {
        expect(tropeSequenceFromAssignments({})).toEqual([])
    })

    it('orders fixture-01-shaped assignments with Scene Dressing before Contraption', () => {
        expect(
            tropeSequenceFromAssignments({
                'Scene Dressing': { members: [] },
                Contraption: { members: [] },
            })
        ).toEqual(['Scene Dressing', 'Contraption'])
    })

    it('omits tropes not present in assignments', () => {
        expect(
            tropeSequenceFromAssignments({
                Bait: { members: [] },
                'Finishing Move': { members: [] },
            })
        ).toEqual(['Bait', 'Finishing Move'])
    })
})

describe('normalizedPhasePlanStableKey', () => {
    it('matches snapshot normalization used in validation', () => {
        expect(normalizedPhasePlanStableKey('  Anvil-1  ')).toBe('anvil-1')
    })
})
