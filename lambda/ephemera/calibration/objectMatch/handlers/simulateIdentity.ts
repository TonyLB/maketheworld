import { calibrationJsonResponse } from '../../calibrationResponse'
import { calibrationRunMetadata, simulateIdentityCalibration } from '../runEmbeddingCalibration'

export type EmbeddingSimulateIdentityEvent = {
    type: 'EmbeddingSimulateIdentity'
    span: string
    catalog: string[]
}

export async function handleEmbeddingSimulateIdentity(event: EmbeddingSimulateIdentityEvent) {
    if (typeof event.span !== 'string') {
        return calibrationJsonResponse(400, { error: 'span must be a string' })
    }
    if (!Array.isArray(event.catalog) || event.catalog.some((entry) => typeof entry !== 'string')) {
        return calibrationJsonResponse(400, { error: 'catalog must be a string array' })
    }

    const result = await simulateIdentityCalibration({
        span: event.span,
        catalog: event.catalog,
    })
    if ('error' in result) {
        return calibrationJsonResponse(400, { error: result.error })
    }

    return calibrationJsonResponse(200, {
        ...calibrationRunMetadata(),
        ...result,
    })
}
