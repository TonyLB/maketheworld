import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

describe('interpretParseCommandIntentClassificationBody', () => {
    it('rejects CoyoteEngineTest from model JSON (harness is slash-only)', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteEngineTest', confidence: 0.87 })
            )
        ).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid AwaitRoadRunner, AcmeOrder, Unimplemented, or Unknown payload (see prompt)',
        })
    })

    it('rejects CoyoteAffinitiesTest from model JSON (harness is slash-only)', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteAffinitiesTest', confidence: 0.9 })
            )
        ).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid AwaitRoadRunner, AcmeOrder, Unimplemented, or Unknown payload (see prompt)',
        })
    })
})
