import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { extractJsonObjectText } from '../../../../llm/extractJsonObjectText'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import { complexComplexityClasses, complexErrorMessage } from './complexityClasses'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type ObjectManipulationComplexityAtomicModelResponse = {
    disposition: 'atomic'
    operationKind: string
}

export type ObjectManipulationComplexityComplexModelResponse = {
    disposition: 'complex'
    complexityClass: string
    summary?: string
}

export type ObjectManipulationComplexityModelResponse =
    | ObjectManipulationComplexityAtomicModelResponse
    | ObjectManipulationComplexityComplexModelResponse

/** @deprecated Use ObjectManipulationComplexityModelResponse */
export type ObjectManipulationEnrichAtomicModelResponse = {
    disposition: 'atomic'
    operationKind: string
    objectSpan: string
}

/** @deprecated Use ObjectManipulationComplexityModelResponse */
export type ObjectManipulationEnrichComplexModelResponse = {
    disposition: 'complex'
    complexityClass: string
    summary?: string
}

/** @deprecated Use ObjectManipulationComplexityModelResponse */
export type ObjectManipulationEnrichModelResponse =
    | ObjectManipulationEnrichAtomicModelResponse
    | ObjectManipulationEnrichComplexModelResponse

const forbiddenComplexityFields = new Set([
    'objectId',
    'objectSpan',
    'targetId',
    'fromHost',
    'toHost',
    'fromRoomId',
    'toRoomId',
    'characterId',
    'roomId',
])

function hasForbiddenComplexityField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => forbiddenComplexityFields.has(key))
}

function parseComplexityModelResponse(parsed: Record<string, unknown>):
    | { success: true; response: ObjectManipulationComplexityModelResponse }
    | { success: false; errorMessage: string } {
    if (hasForbiddenComplexityField(parsed)) {
        return {
            success: false,
            errorMessage: 'Object manipulation complexity must not include object ids or routing fields',
        }
    }

    const disposition = parsed.disposition
    if (disposition !== 'atomic' && disposition !== 'complex') {
        return {
            success: false,
            errorMessage: 'Object manipulation complexity disposition must be atomic or complex',
        }
    }

    if (disposition === 'complex') {
        if (typeof parsed.operationKind === 'string') {
            return {
                success: false,
                errorMessage: 'Object manipulation complexity complex disposition must not include operationKind',
            }
        }
        const complexityClass = parsed.complexityClass
        if (typeof complexityClass !== 'string' || !complexComplexityClasses.has(complexityClass)) {
            return {
                success: false,
                errorMessage: 'Object manipulation complexity complex disposition requires a valid complexityClass',
            }
        }
        const summary = parsed.summary
        if (summary !== undefined && typeof summary !== 'string') {
            return {
                success: false,
                errorMessage: 'Object manipulation complexity summary must be a string when present',
            }
        }
        return {
            success: true,
            response: {
                disposition: 'complex',
                complexityClass,
                ...(typeof summary === 'string' ? { summary } : {}),
            },
        }
    }

    const operationKind = parsed.operationKind
    if (typeof operationKind !== 'string' || operationKind.trim().length === 0) {
        return {
            success: false,
            errorMessage: 'Object manipulation complexity atomic disposition requires operationKind',
        }
    }

    return {
        success: true,
        response: {
            disposition: 'atomic',
            operationKind: operationKind.trim(),
        },
    }
}

export function interpretObjectManipulationComplexityBody(
    body: string
): { success: true; response: ObjectManipulationComplexityModelResponse } | {
    success: false
    errorMessage: string
} {
    const toParse = extractJsonObjectText(body.trim())
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return { success: false, errorMessage: objectManipulationErrorMessages.enrichParseFailed }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.enrichParseFailed }
    }
    return parseComplexityModelResponse(parsed as Record<string, unknown>)
}

/** @deprecated Use interpretObjectManipulationComplexityBody */
export function interpretObjectManipulationEnrichBody(
    body: string
): { success: true; response: ObjectManipulationEnrichModelResponse } | {
    success: false
    errorMessage: string
} {
    const parsed = interpretObjectManipulationComplexityBody(body)
    if (!parsed.success) {
        return parsed
    }
    if (parsed.response.disposition === 'complex') {
        return { success: true, response: parsed.response }
    }
    return {
        success: false,
        errorMessage: 'Object manipulation enrich atomic takeHold requires objectSpan',
    }
}

export function finalizeComplexityFromEnrich(
    intentConfidence: number,
    objectId: EphemeraObjectId,
    complexityResponse: ObjectManipulationComplexityModelResponse | null,
    complexityInvokeFailed: boolean
): ParseCommandObjectManipulationResult | ParseCommandErrorResult {
    if (complexityInvokeFailed || complexityResponse === null) {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.enrichInvokeFailed,
        }
    }

    if (complexityResponse.disposition === 'complex') {
        return {
            type: 'Error',
            errorMessage: complexErrorMessage(complexityResponse.complexityClass),
        }
    }

    if (complexityResponse.operationKind !== 'takeHold' && complexityResponse.operationKind !== 'drop') {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    return {
        type: 'ObjectManipulation',
        operationKind: complexityResponse.operationKind,
        objectIds: [objectId],
        confidence: intentConfidence,
    }
}

/** @deprecated Use finalizeComplexityFromEnrich */
export function finalizeObjectManipulationFromEnrich(
    intentConfidence: number,
    enrichResponse: ObjectManipulationEnrichModelResponse | null,
    enrichInvokeFailed: boolean,
    _catalog: unknown
): ParseCommandObjectManipulationResult | ParseCommandErrorResult {
    if (enrichInvokeFailed || enrichResponse === null) {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.enrichInvokeFailed,
        }
    }

    if (enrichResponse.disposition === 'complex') {
        return {
            type: 'Error',
            errorMessage: complexErrorMessage(enrichResponse.complexityClass),
        }
    }

    return {
        type: 'Error',
        errorMessage: objectManipulationErrorMessages.enrichParseFailed,
    }
}
