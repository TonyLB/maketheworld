import { handleEmbeddingCompare } from './objectMatch/handlers/comparePair'
import { handleEmbeddingCalibrationCorpus } from './objectMatch/handlers/runCorpus'
import { handleEmbeddingSimulateIdentity } from './objectMatch/handlers/simulateIdentity'
import { calibrationJsonResponse, type CalibrationRouteResponse } from './calibrationResponse'

export const CALIBRATION_EVENT_TYPES = [
    'EmbeddingCompare',
    'EmbeddingCalibrationCorpus',
    'EmbeddingSimulateIdentity',
] as const

export type CalibrationEventType = (typeof CALIBRATION_EVENT_TYPES)[number]

export type { CalibrationRouteResponse }

export const isCalibrationEventType = (type: unknown): type is CalibrationEventType =>
    typeof type === 'string' &&
    (CALIBRATION_EVENT_TYPES as readonly string[]).includes(type)

export async function routeCalibrationEvent(event: {
    type?: string
    [key: string]: unknown
}): Promise<CalibrationRouteResponse> {
    switch (event.type) {
        case 'EmbeddingCompare':
            return handleEmbeddingCompare(event as Parameters<typeof handleEmbeddingCompare>[0])
        case 'EmbeddingCalibrationCorpus':
            return handleEmbeddingCalibrationCorpus(
                event as Parameters<typeof handleEmbeddingCalibrationCorpus>[0]
            )
        case 'EmbeddingSimulateIdentity':
            return handleEmbeddingSimulateIdentity(
                event as Parameters<typeof handleEmbeddingSimulateIdentity>[0]
            )
        default:
            return calibrationJsonResponse(400, {
                error: `unknown calibration event type: ${String(event.type)}`,
                supportedTypes: [...CALIBRATION_EVENT_TYPES],
            })
    }
}
