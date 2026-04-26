import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

describe('interpretParseCommandIntentClassificationBody', () => {
    it('rejects CoyoteEngineTest from model JSON (harness is slash-only)', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteEngineTest', confidence: 0.87 })
            )
        ).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid PromptInjectionAttempt, AwaitRoadRunner, AcmeOrder (confidence only), LookRoom, Help, NavigationIntent, Unimplemented, or Unknown payload (see prompt)',
        })
    })

    it('rejects CoyoteAffinitiesTest from model JSON (harness is slash-only)', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteAffinitiesTest', confidence: 0.9 })
            )
        ).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid PromptInjectionAttempt, AwaitRoadRunner, AcmeOrder (confidence only), LookRoom, Help, NavigationIntent, Unimplemented, or Unknown payload (see prompt)',
        })
    })

    it('accepts Help with confidence in range', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'Help', confidence: 0.72 })
            )
        ).toEqual({ type: 'Help', confidence: 0.72 })
    })

    it('rejects Help with invalid or missing confidence', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'Help', confidence: 1.01 })
            ).type
        ).toBe('Error')
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'Help' })
            ).type
        ).toBe('Error')
    })

    it('accepts PromptInjectionAttempt with confidence in range', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'PromptInjectionAttempt', confidence: 0.85 })
            )
        ).toEqual({ type: 'PromptInjectionAttempt', confidence: 0.85 })
    })

    it('rejects PromptInjectionAttempt with invalid or missing confidence', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'PromptInjectionAttempt', confidence: 1.01 })
            ).type
        ).toBe('Error')
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'PromptInjectionAttempt' })
            ).type
        ).toBe('Error')
    })
})
