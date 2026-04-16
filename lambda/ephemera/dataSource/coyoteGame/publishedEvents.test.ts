import {
    isHypothesisGenerationResultPublishedPayload,
    isHypothesisGenerationStartedPublishedPayload,
} from './publishedEvents'

describe('coyoteGame publishedEvents guards', () => {
    it('isHypothesisGenerationStartedPublishedPayload accepts valid payloads', () => {
        expect(isHypothesisGenerationStartedPublishedPayload({
            type: 'Hypothesis Generation Started',
            hypothesisId: 'HYP#01',
            characterId: 'CHARACTER#coyote',
        })).toBe(true)
    })

    it('isHypothesisGenerationStartedPublishedPayload rejects invalid payloads', () => {
        expect(isHypothesisGenerationStartedPublishedPayload(null)).toBe(false)
        expect(isHypothesisGenerationStartedPublishedPayload({
            type: 'Hypothesis Generation Started',
            hypothesisId: '',
            characterId: 'CHARACTER#coyote',
        })).toBe(false)
    })

    it('isHypothesisGenerationResultPublishedPayload accepts valid payloads with RenderTree', () => {
        expect(isHypothesisGenerationResultPublishedPayload({
            type: 'Hypothesis Generation Result',
            hypothesisId: 'HYP#01',
            characterId: 'CHARACTER#coyote',
            renderTree: ['The plan thickens.', { data: { tag: 'br' }, children: [] }, 'Maybe.'],
        })).toBe(true)
    })

    it('isHypothesisGenerationResultPublishedPayload rejects non-RenderTree output', () => {
        expect(isHypothesisGenerationResultPublishedPayload({
            type: 'Hypothesis Generation Result',
            hypothesisId: 'HYP#01',
            characterId: 'CHARACTER#coyote',
            renderTree: {},
        })).toBe(false)
    })
})
