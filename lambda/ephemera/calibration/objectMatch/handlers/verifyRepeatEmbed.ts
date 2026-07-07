import { calibrationJsonResponse } from '../../calibrationResponse'
import { calibrationRunMetadata } from '../runEmbeddingCalibration'
import { verifyRepeatBedrockEmbed } from '../verifyRepeatBedrockEmbed'

export type EmbeddingVerifyRepeatEvent = {
    type: 'EmbeddingVerifyRepeat'
    text: string
}

export async function handleEmbeddingVerifyRepeat(event: EmbeddingVerifyRepeatEvent) {
    if (typeof event.text !== 'string' || event.text.length === 0) {
        return calibrationJsonResponse(400, { error: 'text must be a non-empty string' })
    }

    const result = await verifyRepeatBedrockEmbed(event.text)
    if ('error' in result) {
        return calibrationJsonResponse(400, { error: result.error })
    }

    return calibrationJsonResponse(200, {
        ...calibrationRunMetadata(),
        ...result,
        note: 'Two independent Bedrock invokes for the same normalized text (no embed cache). Expect float32 and quantized cosine ~1.0 and vectorsEqual true if Titan and our pipeline are deterministic.',
    })
}
