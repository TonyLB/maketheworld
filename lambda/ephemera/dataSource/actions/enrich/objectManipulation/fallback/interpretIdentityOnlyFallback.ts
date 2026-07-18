import { extractJsonObjectText } from '../../../../../llm/extractJsonObjectText'

import { objectManipulationErrorMessages } from '../resolveObjectSpan'

export type IdentityOnlyFallbackCandidateResponse = {
    objectId: string
    confidence: number
}

export type InterpretIdentityOnlyFallbackResult =
    | { success: true; candidates: readonly IdentityOnlyFallbackCandidateResponse[] }
    | { success: false; errorMessage: string }

const isUnitInterval = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 1
)

function parseCandidateEntry(value: unknown):
    | { success: true; candidate: IdentityOnlyFallbackCandidateResponse }
    | { success: false } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { success: false }
    }
    const record = value as Record<string, unknown>
    if (typeof record.objectId !== 'string' || record.objectId.trim().length === 0) {
        return { success: false }
    }
    if (!isUnitInterval(record.confidence)) {
        return { success: false }
    }
    return {
        success: true,
        candidate: { objectId: record.objectId, confidence: record.confidence },
    }
}

export function interpretIdentityOnlyFallbackBody(body: string): InterpretIdentityOnlyFallbackResult {
    const toParse = extractJsonObjectText(body.trim())
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return { success: false, errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed }
    }
    const record = parsed as Record<string, unknown>
    if (!Array.isArray(record.candidates) || record.candidates.length === 0) {
        return { success: false, errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed }
    }
    const candidates: IdentityOnlyFallbackCandidateResponse[] = []
    for (const entry of record.candidates) {
        const parsedEntry = parseCandidateEntry(entry)
        if (!parsedEntry.success) {
            return { success: false, errorMessage: objectManipulationErrorMessages.identityOnlyFallbackParseFailed }
        }
        candidates.push(parsedEntry.candidate)
    }
    return { success: true, candidates }
}
