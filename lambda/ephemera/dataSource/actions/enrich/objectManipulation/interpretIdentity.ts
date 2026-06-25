import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { extractJsonObjectText } from '../../../../llm/extractJsonObjectText'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type ObjectManipulationIdentityModelResponse = {
    objectId: EphemeraObjectId
}

const forbiddenIdentityFields = new Set([
    'targetId',
    'fromHost',
    'toHost',
    'fromRoomId',
    'toRoomId',
    'characterId',
    'roomId',
    'disposition',
    'operationKind',
    'complexityClass',
    'objectSpan',
])

function hasForbiddenIdentityField(obj: Record<string, unknown>): boolean {
    return Object.keys(obj).some((key) => forbiddenIdentityFields.has(key))
}

function parseIdentityModelResponse(
    parsed: Record<string, unknown>,
    allowedObjectIds: ReadonlySet<string>
):
    | { success: true; response: ObjectManipulationIdentityModelResponse }
    | { success: false; errorMessage: string } {
    if (hasForbiddenIdentityField(parsed)) {
        return {
            success: false,
            errorMessage: 'Object manipulation identity must not include routing or complexity fields',
        }
    }

    const objectId = parsed.objectId
    if (typeof objectId !== 'string' || objectId.trim().length === 0) {
        return {
            success: false,
            errorMessage: 'Object manipulation identity requires objectId',
        }
    }

    const trimmedId = objectId.trim()
    if (!allowedObjectIds.has(trimmedId)) {
        return {
            success: false,
            errorMessage: 'Object manipulation identity objectId is not in catalog',
        }
    }

    return {
        success: true,
        response: { objectId: trimmedId as EphemeraObjectId },
    }
}

export function interpretObjectManipulationIdentityBody(
    body: string,
    allowedObjectIds: ReadonlySet<string>
): { success: true; response: ObjectManipulationIdentityModelResponse } | {
    success: false
    errorMessage: string
} {
    const toParse = extractJsonObjectText(body.trim())
    let parsed: unknown
    try {
        parsed = JSON.parse(toParse)
    } catch {
        return { success: false, errorMessage: objectManipulationErrorMessages.identityParseFailed }
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, errorMessage: objectManipulationErrorMessages.identityParseFailed }
    }
    return parseIdentityModelResponse(parsed as Record<string, unknown>, allowedObjectIds)
}
