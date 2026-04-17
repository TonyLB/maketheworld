import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

describe('interpretParseCommandIntentClassificationBody', () => {
    it('accepts CoyoteEngineTest intent payload', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteEngineTest', confidence: 0.87 })
            )
        ).toEqual({
            type: 'CoyoteEngineTest',
            confidence: 0.87,
        })
    })

    it('rejects CoyoteEngineTest payload with invalid confidence', () => {
        expect(
            interpretParseCommandIntentClassificationBody(
                JSON.stringify({ type: 'CoyoteEngineTest', confidence: 4 })
            )
        ).toEqual({
            type: 'Error',
            errorMessage: 'Model JSON must be a valid AwaitRoadRunner, AcmeOrder, CoyoteEngineTest, Unimplemented, or Unknown payload (see prompt)',
        })
    })
})

