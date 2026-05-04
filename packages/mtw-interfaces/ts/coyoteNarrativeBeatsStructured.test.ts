import {
    validateCoyoteNarrativeBeatsStructured,
    type CoyoteNarrativeBeatsValidationContext,
} from './coyoteNarrativeBeatsStructured'

const snapshot = new Set(['anvil-1', 'rocket-0'])

function ctx(
    overrides: Partial<CoyoteNarrativeBeatsValidationContext> = {}
): CoyoteNarrativeBeatsValidationContext {
    return {
        snapshotStableKeys: snapshot,
        ...overrides,
    }
}

function minimalValidStructured() {
    return {
        beats: [
            {
                beatId: 'prep',
                description: 'Rig the launch lane.',
                derivedFrom: ['anvil-1'],
            },
            {
                beatId: 'launch',
                description: 'Fire the rocket trigger.',
                derivedFrom: ['rocket-0'],
            },
        ],
        linearizedSequence: ['prep', 'launch'],
    }
}

describe('validateCoyoteNarrativeBeatsStructured', () => {
    it('accepts a minimal valid structure', () => {
        const result = validateCoyoteNarrativeBeatsStructured(minimalValidStructured(), ctx())
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.narrativeBeatsStructured.linearizedSequence).toEqual(['prep', 'launch'])
        }
    })

    it('rejects extra root keys', () => {
        const result = validateCoyoteNarrativeBeatsStructured({
            ...minimalValidStructured(),
            extra: true,
        }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('exactly keys "beats" and "linearizedSequence"')
        }
    })

    it('rejects empty beats array', () => {
        const result = validateCoyoteNarrativeBeatsStructured({
            beats: [],
            linearizedSequence: ['prep'],
        }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('beats must be a non-empty array')
        }
    })

    it('rejects beat with malformed derivedFrom', () => {
        const result = validateCoyoteNarrativeBeatsStructured({
            beats: [
                {
                    beatId: 'prep',
                    description: 'Rig setup.',
                    derivedFrom: [123],
                },
            ],
            linearizedSequence: ['prep'],
        }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('derivedFrom must be an array of strings')
        }
    })

    it('rejects unknown derivedFrom reference', () => {
        const result = validateCoyoteNarrativeBeatsStructured({
            beats: [
                {
                    beatId: 'prep',
                    description: 'Rig setup.',
                    derivedFrom: ['missing-stable-key'],
                },
            ],
            linearizedSequence: ['prep'],
        }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('not a snapshot stableKey')
        }
    })

    it('allows topology refs when allowlist includes them', () => {
        const result = validateCoyoteNarrativeBeatsStructured({
            beats: [
                {
                    beatId: 'prep',
                    description: 'Use cliff lane.',
                    derivedFrom: ['VORTEX'],
                },
            ],
            linearizedSequence: ['prep'],
        }, ctx({ allowedTopologyRefTokens: new Set(['vortex']) }))
        expect(result.ok).toBe(true)
    })

    it('rejects linearizedSequence unknown beat id', () => {
        const result = validateCoyoteNarrativeBeatsStructured({
            beats: [
                {
                    beatId: 'prep',
                    description: 'Rig setup.',
                    derivedFrom: ['anvil-1'],
                },
            ],
            linearizedSequence: ['launch'],
        }, ctx())
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toContain('references unknown beatId')
        }
    })
})
