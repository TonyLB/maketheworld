import { extractJsonObjectText } from '../../../../llm/extractJsonObjectText'
import type {
    ParseCommandErrorResult,
    ParseCommandObjectManipulationResult,
} from '../../baseClasses'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import {
    objectManipulationErrorMessageForResolution,
    objectManipulationErrorMessages,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'

export type ObjectManipulationEnrichAtomicModelResponse = {
    disposition: 'atomic'
    operationKind: string
    objectSpan: string
}

export type ObjectManipulationEnrichComplexModelResponse = {
    disposition: 'complex'
    complexityClass: string
    summary?: string
}

export type ObjectManipulationEnrichModelResponse =
    | ObjectManipulationEnrichAtomicModelResponse
    | ObjectManipulationEnrichComplexModelResponse

const forbiddenEnrichFields = new Set([
    'objectId',
    'targetId',
    'fromHost',
    'toHost',
    'fromRoomId',
    'toRoomId',
    'characterId',
    'roomId',
])

const complexComplexityClasses = new Set([
    'relationalPlacement',
    'multiObject',
    'unimplementedVerb',
])

function hasForbiddenEnrichField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => forbiddenEnrichFields.has(key))
}

function parseEnrichModelResponse(parsed: Record<string, unknown>):
    | { success: true; response: ObjectManipulationEnrichModelResponse }
    | { success: false; errorMessage: string } {
    if (hasForbiddenEnrichField(parsed)) {
        return {
            success: false,
            errorMessage: 'Object manipulation enrich must not include object ids or routing fields',
        }
    }

    const disposition = parsed.disposition
    if (disposition !== 'atomic' && disposition !== 'complex') {
        return {
            success: false,
            errorMessage: 'Object manipulation enrich disposition must be atomic or complex',
        }
    }

    if (disposition === 'complex') {
        if (typeof parsed.operationKind === 'string') {
            return {
                success: false,
                errorMessage: 'Object manipulation enrich complex disposition must not include operationKind',
            }
        }
        const complexityClass = parsed.complexityClass
        if (typeof complexityClass !== 'string' || !complexComplexityClasses.has(complexityClass)) {
            return {
                success: false,
                errorMessage: 'Object manipulation enrich complex disposition requires a valid complexityClass',
            }
        }
        const summary = parsed.summary
        if (summary !== undefined && typeof summary !== 'string') {
            return {
                success: false,
                errorMessage: 'Object manipulation enrich summary must be a string when present',
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
            errorMessage: 'Object manipulation enrich atomic disposition requires operationKind',
        }
    }
    const objectSpan = parsed.objectSpan
    if (typeof objectSpan !== 'string' || objectSpan.trim().length === 0) {
        return {
            success: false,
            errorMessage: 'Object manipulation enrich atomic takeHold requires objectSpan',
        }
    }

    return {
        success: true,
        response: {
            disposition: 'atomic',
            operationKind: operationKind.trim(),
            objectSpan: objectSpan.trim(),
        },
    }
}

export function interpretObjectManipulationEnrichBody(
    body: string
): { success: true; response: ObjectManipulationEnrichModelResponse } | {
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
    return parseEnrichModelResponse(parsed as Record<string, unknown>)
}

function complexErrorMessage(complexityClass: string): string {
    switch (complexityClass) {
        case 'relationalPlacement':
            return objectManipulationErrorMessages.complexRelational
        case 'multiObject':
            return objectManipulationErrorMessages.complexMultiObject
        case 'unimplementedVerb':
            return objectManipulationErrorMessages.complexUnimplementedVerb
        default:
            return objectManipulationErrorMessages.complexUnimplementedVerb
    }
}

export function finalizeObjectManipulationFromEnrich(
    intentConfidence: number,
    enrichResponse: ObjectManipulationEnrichModelResponse | null,
    enrichInvokeFailed: boolean,
    catalog: readonly RoomInPlayObjectCatalogEntry[] | undefined
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

    if (enrichResponse.operationKind !== 'takeHold') {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    const resolved = resolveObjectSpanToObjectId(enrichResponse.objectSpan, catalog)
    if (resolved.type !== 'Resolved') {
        return {
            type: 'Error',
            errorMessage: objectManipulationErrorMessageForResolution(resolved),
        }
    }

    return {
        type: 'ObjectManipulation',
        operationKind: 'takeHold',
        objectId: resolved.objectId,
        confidence: intentConfidence,
    }
}
