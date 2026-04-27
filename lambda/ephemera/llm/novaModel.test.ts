import {
    BEDROCK_NOVA_2_LITE_MODEL_ID,
    BEDROCK_NOVA_MICRO_MODEL_ID,
    DEFAULT_NOVA_MODEL,
    novaModelToBedrockModelId,
} from './novaModel'

describe('novaModel', () => {
    it('maps NovaMicro to Bedrock model id', () => {
        expect(novaModelToBedrockModelId('NovaMicro')).toBe(BEDROCK_NOVA_MICRO_MODEL_ID)
    })

    it('maps Nova2Lite to Bedrock model id', () => {
        expect(novaModelToBedrockModelId('Nova2Lite')).toBe(BEDROCK_NOVA_2_LITE_MODEL_ID)
    })

    it('defaults to Nova2Lite', () => {
        expect(DEFAULT_NOVA_MODEL).toBe('Nova2Lite')
        expect(novaModelToBedrockModelId(DEFAULT_NOVA_MODEL)).toBe(BEDROCK_NOVA_2_LITE_MODEL_ID)
    })
})
