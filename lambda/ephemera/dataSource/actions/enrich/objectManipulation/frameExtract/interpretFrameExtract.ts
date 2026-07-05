import { extractJsonObjectText } from '../../../../../llm/extractJsonObjectText'

import type { ManipulationFrameExtractModelResponse, RelationalOperationKind } from '../manipulationFrame'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'

const forbiddenFrameExtractFields = new Set([
    'objectId',
    'subjectId',
    'targetId',
    'relationKind',
    'disposition',
    'complexityClass',
    'fromHost',
    'toHost',
    'fromRoomId',
    'toRoomId',
    'characterId',
    'roomId',
])

const VALID_OPERATION_KINDS = new Set<RelationalOperationKind>(['establishRelation', 'dissolveRelation'])

function hasForbiddenFrameExtractField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => forbiddenFrameExtractFields.has(key))
}

function parseNonEmptySpan(value: unknown, fieldName: string):
    | { success: true; span: string }
    | { success: false; errorMessage: string } {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return {
            success: false,
            errorMessage: `Object manipulation frame extract requires ${fieldName}`,
        }
    }
    return { success: true, span: value.trim() }
}

function parseOperationKind(value: unknown):
    | { success: true; operationKind: RelationalOperationKind }
    | { success: false; errorMessage: string } {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return {
            success: false,
            errorMessage: 'Object manipulation frame extract requires operationKind',
        }
    }
    const trimmed = value.trim() as RelationalOperationKind
    if (!VALID_OPERATION_KINDS.has(trimmed)) {
        return {
            success: false,
            errorMessage: 'Object manipulation frame extract operationKind must be establishRelation or dissolveRelation',
        }
    }
    return { success: true, operationKind: trimmed }
}

function parseFrameExtractModelResponse(
    parsed: Record<string, unknown>
):
    | { success: true; response: ManipulationFrameExtractModelResponse }
    | { success: false; errorMessage: string } {
    if (hasForbiddenFrameExtractField(parsed)) {
        return {
            success: false,
            errorMessage: 'Object manipulation frame extract must not include routing or complexity fields',
        }
    }

    const subject = parseNonEmptySpan(parsed.subjectSpan, 'subjectSpan')
    if (!subject.success) {
        return subject
    }
    const target = parseNonEmptySpan(parsed.targetSpan, 'targetSpan')
    if (!target.success) {
        return target
    }
    const relation = parseNonEmptySpan(parsed.relationSpan, 'relationSpan')
    if (!relation.success) {
        return relation
    }
    const operationKind = parseOperationKind(parsed.operationKind)
    if (!operationKind.success) {
        return operationKind
    }

    return {
        success: true,
        response: {
            subjectSpan: subject.span,
            targetSpan: target.span,
            relationSpan: relation.span,
            operationKind: operationKind.operationKind,
        },
    }
}

export function interpretManipulationFrameExtractBody(body: string): {
    success: true
    response: ManipulationFrameExtractModelResponse
} | {
    success: false
    errorMessage: string
} {
    const toParse = extractJsonObjectText(body.trim())
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return { success: false, errorMessage: objectManipulationErrorMessages.frameExtractParseFailed }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.frameExtractParseFailed }
    }
    return parseFrameExtractModelResponse(parsed as Record<string, unknown>)
}
