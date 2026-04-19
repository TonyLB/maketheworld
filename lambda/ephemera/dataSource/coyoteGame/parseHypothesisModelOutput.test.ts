import { parseHypothesisModelOutput } from './parseHypothesisModelOutput'

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
})
