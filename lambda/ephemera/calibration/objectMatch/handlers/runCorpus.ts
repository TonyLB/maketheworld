import type { EmbeddingCalibrationBucket } from '../corpus'
import { calibrationJsonResponse } from '../../calibrationResponse'
import { calibrationRunMetadata, runFullEmbeddingCalibration } from '../runEmbeddingCalibration'

export type EmbeddingCalibrationCorpusEvent = {
    type: 'EmbeddingCalibrationCorpus'
    bucket?: EmbeddingCalibrationBucket
}

const VALID_BUCKETS = new Set<EmbeddingCalibrationBucket>([
    'positive-paraphrase',
    'hard-negative',
    'absent-object',
    'unary-trap',
    'synonym-without-shared-tokens',
    'duplicate-shortName',
])

export async function handleEmbeddingCalibrationCorpus(event: EmbeddingCalibrationCorpusEvent) {
    if (event.bucket !== undefined && !VALID_BUCKETS.has(event.bucket)) {
        return calibrationJsonResponse(400, { error: `invalid bucket: ${String(event.bucket)}` })
    }

    const result = await runFullEmbeddingCalibration(event.bucket)
    return calibrationJsonResponse(200, {
        ...calibrationRunMetadata(),
        ...result,
    })
}
