import { calibrationJsonResponse } from '../../calibrationResponse'
import { calibrationRunMetadata, compareEmbeddingPair } from '../runEmbeddingCalibration'

export type EmbeddingCompareEvent = {
    type: 'EmbeddingCompare'
    left: string
    right: string
}

export async function handleEmbeddingCompare(event: EmbeddingCompareEvent) {
    if (typeof event.left !== 'string' || typeof event.right !== 'string') {
        return calibrationJsonResponse(400, { error: 'left and right must be strings' })
    }

    const result = await compareEmbeddingPair(event.left, event.right)
    if ('error' in result) {
        return calibrationJsonResponse(400, { error: result.error })
    }

    return calibrationJsonResponse(200, {
        ...calibrationRunMetadata(),
        ...result,
    })
}
