import type { CoyotePhasePlanValidationContext } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'
import { parseHypothesisModelOutput, parseHypothesisPhasePlanHopOutput } from './parseHypothesisModelOutput'

const phasePlanCtx: CoyotePhasePlanValidationContext = {
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
            sceneAnalysis: '## Scene analysis\nPrep.',
            intent: 'Hypothesis: It looks like you are trying to test.',
        })
    })

    it('legacy: entire body is intent when no Hypothesis line', () => {
        expect(parseHypothesisModelOutput('You are staging an anvil.')).toEqual({
            intent: 'You are staging an anvil.',
        })
    })

    it('hypothesis only: no sceneAnalysis', () => {
        expect(parseHypothesisModelOutput('Hypothesis: It looks like you are trying to move on.')).toEqual({
            intent: 'Hypothesis: It looks like you are trying to move on.',
        })
    })

    it('uses first Hypothesis line when multiple present', () => {
        const body = 'Intro\nHypothesis: First.\nHypothesis: Second.'
        expect(parseHypothesisModelOutput(body)).toEqual({
            sceneAnalysis: 'Intro',
            intent: 'Hypothesis: First.',
        })
    })

    it('drops text before ## Scene analysis so leaked scratch is not sceneAnalysis', () => {
        const body = 'First I will plan in text (leak).\n\n## Scene analysis\nYou staged a trap.\n\nHypothesis: It looks like you are trying to test.'
        expect(parseHypothesisModelOutput(body)).toEqual({
            sceneAnalysis: '## Scene analysis\nYou staged a trap.',
            intent: 'Hypothesis: It looks like you are trying to test.',
        })
    })

    it('new contract: ## Scene analysis prefix + final ```text fence with Hypothesis only', () => {
        const raw = '## Scene analysis\nYou staged a trap.\n\n```text\nHypothesis: It looks like you are trying to test.\n```'
        expect(parseHypothesisModelOutput(raw)).toEqual({
            sceneAnalysis: '## Scene analysis\nYou staged a trap.',
            intent: 'Hypothesis: It looks like you are trying to test.',
        })
    })

    it('hop-2 Option A shape: leading ```json phase-plan fence then Scene analysis then final ```text Hypothesis', () => {
        const raw = [
            '```json',
            '{"phases":[]}',
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
            sceneAnalysis: '## Scene analysis\nPlayer staged cliff gear.',
            intent: 'Hypothesis: It looks like you are trying to spring a cliff trap.',
        })
    })

    it('accepts optional parse options for API symmetry with the pipeline', () => {
        expect(parseHypothesisModelOutput('Hypothesis: Only.', { reasoningContentProvided: true })).toEqual({
            intent: 'Hypothesis: Only.',
        })
    })
})

describe('parseHypothesisPhasePlanHopOutput', () => {
    it('extracts validated phasePlan and Hypothesis line', () => {
        const raw = [
            '```json',
            JSON.stringify({
                phases: [
                    {
                        stableKeysUsed: ['anvil'],
                        virtualEntities: [
                            { label: 'Prep', derivedFrom: ['anvil'], phaseKind: 'gathered' },
                        ],
                        achievement: 'Ready',
                    },
                ],
            }),
            '```',
            '',
            '```text',
            'Hypothesis: Valid plan.',
            '```',
        ].join('\n')
        const out = parseHypothesisPhasePlanHopOutput(raw, phasePlanCtx)
        expect(out.record.phasePlan?.phases).toHaveLength(1)
        expect(out.record.intent).toBe('Hypothesis: Valid plan.')
        expect(out.phasePlanJson).toContain('"phases"')
        expect(out.phasePlanValidationReason).toBeUndefined()
    })

    it('degrades when phase-plan JSON fails validation but Hypothesis parses', () => {
        const raw = [
            '```json',
            '{"phases":[]}',
            '```',
            '',
            '```text',
            'Hypothesis: Still here.',
            '```',
        ].join('\n')
        const out = parseHypothesisPhasePlanHopOutput(raw, phasePlanCtx)
        expect(out.record.phasePlan).toBeUndefined()
        expect(out.record.intent).toBe('Hypothesis: Still here.')
        expect(out.phasePlanValidationReason).toContain('phases')
    })
})
