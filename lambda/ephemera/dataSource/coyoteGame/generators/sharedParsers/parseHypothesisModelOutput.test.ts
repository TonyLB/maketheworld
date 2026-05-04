import type { CoyoteNarrativeBeatsValidationContext } from '@tonylb/mtw-interfaces/ts/coyoteNarrativeBeatsStructured'
import { parseHypothesisModelOutput, parseNarrativeBeatOutput } from './parseHypothesisModelOutput'

const narrativeBeatsCtx: CoyoteNarrativeBeatsValidationContext = {
    snapshotStableKeys: new Set(['anvil']),
    allowedTopologyRefTokens: new Set(['vortex']),
}

describe('parseHypothesisModelOutput', () => {
    it('returns stub when empty after strip', () => {
        expect(parseHypothesisModelOutput('   ')).toEqual({ intent: 'Hypothesis: Stubbed' })
        expect(parseHypothesisModelOutput('')).toEqual({ intent: 'Hypothesis: Stubbed' })
    })

    it('strips fenced code blocks then splits', () => {
        const raw = '```text\n## Scene analysis\nPrep.\nHypothesis: It looks like you are trying to test.\n```'
        expect(parseHypothesisModelOutput(raw)).toEqual({
            walkthrough: '## Scene analysis\nPrep.',
            intent: 'Hypothesis: It looks like you are trying to test.',
        })
    })

    it('legacy: entire body is intent when no Hypothesis line', () => {
        expect(parseHypothesisModelOutput('You are staging an anvil.')).toEqual({
            intent: 'You are staging an anvil.',
        })
    })

    it('hypothesis only: no walkthrough', () => {
        expect(parseHypothesisModelOutput('Hypothesis: It looks like you are trying to move on.')).toEqual({
            intent: 'Hypothesis: It looks like you are trying to move on.',
        })
    })

    it('uses first Hypothesis line when multiple present', () => {
        const body = 'Intro\nHypothesis: First.\nHypothesis: Second.'
        expect(parseHypothesisModelOutput(body)).toEqual({
            walkthrough: 'Intro',
            intent: 'Hypothesis: First.',
        })
    })

    it('drops text before ## Scene analysis so leaked scratch is not sceneAnalysis', () => {
        const body = 'First I will plan in text (leak).\n\n## Scene analysis\nYou staged a trap.\n\nHypothesis: It looks like you are trying to test.'
        expect(parseHypothesisModelOutput(body)).toEqual({
            walkthrough: '## Scene analysis\nYou staged a trap.',
            intent: 'Hypothesis: It looks like you are trying to test.',
        })
    })

    it('new contract: ## Scene analysis prefix + final ```text fence with Hypothesis only', () => {
        const raw = '## Scene analysis\nYou staged a trap.\n\n```text\nHypothesis: It looks like you are trying to test.\n```'
        expect(parseHypothesisModelOutput(raw)).toEqual({
            walkthrough: '## Scene analysis\nYou staged a trap.',
            intent: 'Hypothesis: It looks like you are trying to test.',
        })
    })

    it('hop-2 Option A shape: leading ```json phase-plan fence then Scene analysis then final ```text Hypothesis', () => {
        const raw = [
            '```json',
            '{"tropeSequence":[],"deconflictionSummary":"x","phases":[]}',
            '```',
            '',
            '## Scene analysis',
            'Player staged cliff gear.',
            '',
            '```text',
            'Hypothesis: It looks like you are trying to spring a cliff trap.',
            '```',
        ].join('\n')
        expect(parseHypothesisModelOutput(raw)).toEqual({
            walkthrough: '## Scene analysis\nPlayer staged cliff gear.',
            intent: 'Hypothesis: It looks like you are trying to spring a cliff trap.',
        })
    })

    it('accepts optional parse options for API symmetry with the pipeline', () => {
        expect(parseHypothesisModelOutput('Hypothesis: Only.', { reasoningContentProvided: true })).toEqual({
            intent: 'Hypothesis: Only.',
        })
    })
})

describe('parseNarrativeBeatOutput', () => {
    it('extracts validated narrativeBeatsStructured and Hypothesis line', () => {
        const raw = [
            '```json',
            JSON.stringify({
                beats: [
                    {
                        beatId: 'prep',
                        description: 'Rig anvil in launch lane.',
                        derivedFrom: ['anvil'],
                    },
                ],
                linearizedSequence: ['prep'],
            }),
            '```',
            '',
            '```text',
            'Hypothesis: Valid plan.',
            '```',
        ].join('\n')
        const out = parseNarrativeBeatOutput(raw, narrativeBeatsCtx)
        expect(out.record.narrativeBeatsStructured?.beats).toHaveLength(1)
        expect(out.record.intent).toBe('Hypothesis: Valid plan.')
        expect(out.narrativeBeatsStructuredJson).toContain('"beats"')
        expect(out.narrativeBeatsStructuredValidationReason).toBeUndefined()
    })

    it('maps ## Scene analysis prose to walkthrough on intent record only', () => {
        const raw = [
            '```json',
            JSON.stringify({
                beats: [
                    {
                        beatId: 'prep',
                        description: 'Rig anvil in launch lane.',
                        derivedFrom: ['anvil'],
                    },
                ],
                linearizedSequence: ['prep'],
            }),
            '```',
            '',
            '## Scene analysis',
            'Coyote surveys the terrain.',
            '',
            '```text',
            'Hypothesis: Valid with walkthrough.',
            '```',
        ].join('\n')
        const out = parseNarrativeBeatOutput(raw, narrativeBeatsCtx)
        expect(out.record.walkthrough).toBe('## Scene analysis\nCoyote surveys the terrain.')
        expect(out.record.intent).toBe('Hypothesis: Valid with walkthrough.')
    })

    it('degrades when narrative-beats JSON fails validation but Hypothesis parses', () => {
        const raw = [
            '```json',
            '{"beats":[],"linearizedSequence":[]}',
            '```',
            '',
            '```text',
            'Hypothesis: Still here.',
            '```',
        ].join('\n')
        const out = parseNarrativeBeatOutput(raw, narrativeBeatsCtx)
        expect(out.record.narrativeBeatsStructured).toBeUndefined()
        expect(out.record.intent).toBe('Hypothesis: Still here.')
        expect(out.narrativeBeatsStructuredValidationReason).toContain('non-empty')
    })

    it('degrades when json fence is invalid JSON but Hypothesis parses', () => {
        const raw = [
            '```json',
            '{bad json',
            '```',
            '',
            '```text',
            'Hypothesis: Still here.',
            '```',
        ].join('\n')
        const out = parseNarrativeBeatOutput(raw, narrativeBeatsCtx)
        expect(out.record.narrativeBeatsStructured).toBeUndefined()
        expect(out.record.intent).toBe('Hypothesis: Still here.')
        expect(out.narrativeBeatsStructuredValidationReason).toContain('invalid JSON')
    })

    it('uses first valid structured fence when earlier json fails', () => {
        const raw = [
            '```json',
            '{"beats":[],"linearizedSequence":[]}',
            '```',
            '',
            '```json',
            '{"beats":[{"beatId":"prep","description":"Rig anvil.","derivedFrom":["anvil"]}],"linearizedSequence":["prep"]}',
            '```',
            '',
            '```text',
            'Hypothesis: Still here.',
            '```',
        ].join('\n')
        const out = parseNarrativeBeatOutput(raw, narrativeBeatsCtx)
        expect(out.record.narrativeBeatsStructured?.beats).toHaveLength(1)
        expect(out.narrativeBeatsStructuredValidationReason).toBeUndefined()
    })
})
