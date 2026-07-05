import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import { buildObjectManipulationIdentityPrompt } from './buildPrompt'
import { catalogWithScope } from './catalogMerge'
import { interpretObjectManipulationIdentityBody } from './interpretIdentity'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import {
    objectManipulationErrorMessageForResolution,
    objectManipulationErrorMessages,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'

export type RelationalGroundingDeps = {
    invokeBedrockObjectManipulationIdentityImpl?: typeof invokeBedrockObjectManipulationEnrich
}

export type RelationalGroundingResult =
    | { type: 'success'; subjectId: EphemeraObjectId; targetId: EphemeraObjectId }
    | { type: 'error'; errorMessage: string }

async function resolveSpanToObjectId(
    command: string,
    span: string,
    catalog: readonly RoomInPlayObjectCatalogEntry[],
    deps: RelationalGroundingDeps
): Promise<
    | { type: 'resolved'; objectId: EphemeraObjectId }
    | { type: 'error'; errorMessage: string }
> {
    const resolution = resolveObjectSpanToObjectId(span, catalog)
    if (resolution.type === 'Resolved') {
        return { type: 'resolved', objectId: resolution.objectId }
    }

    if (resolution.type === 'NoCatalog') {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessageForResolution({ type: 'NoCatalog' }),
        }
    }

    if (resolution.type === 'NoMatch' || resolution.type === 'AmbiguousMatch') {
        if (catalog.length === 0) {
            return {
                type: 'error',
                errorMessage: objectManipulationErrorMessageForResolution({ type: 'NoCatalog' }),
            }
        }

        const invokeIdentity = deps.invokeBedrockObjectManipulationIdentityImpl
            ?? invokeBedrockObjectManipulationEnrich
        const allowedObjectIds = new Set(catalog.map(({ objectId }) => objectId))
        const promptParts = buildObjectManipulationIdentityPrompt(command, {
            rawObjectSpan: span,
            catalog: catalogWithScope(catalog, 'room'),
        })
        const invokeResult = await invokeIdentity(promptParts)
        if (!invokeResult.success) {
            return {
                type: 'error',
                errorMessage: objectManipulationErrorMessages.identityInvokeFailed,
            }
        }

        const parsed = interpretObjectManipulationIdentityBody(invokeResult.body, allowedObjectIds)
        if (!parsed.success) {
            return { type: 'error', errorMessage: parsed.errorMessage }
        }

        return { type: 'resolved', objectId: parsed.response.objectId }
    }

    return {
        type: 'error',
        errorMessage: objectManipulationErrorMessageForResolution(resolution),
    }
}

export async function resolveRelationalGrounding(
    command: string,
    subjectSpan: string,
    targetSpan: string,
    roomObjectCatalog: readonly RoomInPlayObjectCatalogEntry[] | undefined,
    deps: RelationalGroundingDeps = {}
): Promise<RelationalGroundingResult> {
    const catalog = roomObjectCatalog ?? []

    const subjectResult = await resolveSpanToObjectId(command, subjectSpan, catalog, deps)
    if (subjectResult.type === 'error') {
        return subjectResult
    }

    const targetResult = await resolveSpanToObjectId(command, targetSpan, catalog, deps)
    if (targetResult.type === 'error') {
        return targetResult
    }

    if (subjectResult.objectId === targetResult.objectId) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        }
    }

    return {
        type: 'success',
        subjectId: subjectResult.objectId,
        targetId: targetResult.objectId,
    }
}
