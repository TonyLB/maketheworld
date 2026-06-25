import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import type { ObjectManipulationCatalogEntry, ObjectManipulationCatalogScope } from './catalogMerge'
import { buildObjectManipulationIdentityPrompt } from './buildPrompt'
import { interpretObjectManipulationIdentityBody } from './interpretIdentity'
import {
    objectManipulationErrorMessageForResolution,
    objectManipulationErrorMessages,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'

export type SpanGrounding =
    | { type: 'resolved'; objectId: EphemeraObjectId; catalogScope: ObjectManipulationCatalogScope }
    | { type: 'noMatch' }
    | { type: 'ambiguous' }
    | { type: 'noCatalog' }

export type IdentityStageResult =
    | { type: 'success'; spanGroundings: SpanGrounding[] }
    | { type: 'error'; errorMessage: string }

export type IdentityStageDeps = {
    invokeBedrockObjectManipulationIdentityImpl?: typeof invokeBedrockObjectManipulationEnrich
}

function deterministicSpanGrounding(
    rawObjectSpan: string,
    catalog: readonly ObjectManipulationCatalogEntry[]
): SpanGrounding {
    const resolution = resolveObjectSpanToObjectId(rawObjectSpan, catalog)
    if (resolution.type === 'Resolved') {
        const entry = catalog.find(({ objectId }) => objectId === resolution.objectId)
        return {
            type: 'resolved',
            objectId: resolution.objectId,
            catalogScope: entry?.catalogScope ?? 'room',
        }
    }
    if (resolution.type === 'NoCatalog') {
        return { type: 'noCatalog' }
    }
    if (resolution.type === 'NoMatch') {
        return { type: 'noMatch' }
    }
    return { type: 'ambiguous' }
}

function needsIdentityLlm(grounding: SpanGrounding): boolean {
    return grounding.type === 'noMatch' || grounding.type === 'ambiguous'
}

export async function runIdentityStage(
    command: string,
    rawObjectSpans: readonly string[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    deps: IdentityStageDeps = {}
): Promise<IdentityStageResult> {
    const invokeIdentity = deps.invokeBedrockObjectManipulationIdentityImpl ?? invokeBedrockObjectManipulationEnrich
    const allowedObjectIds = new Set(catalog.map(({ objectId }) => objectId))
    const spanGroundings: SpanGrounding[] = []

    for (const rawObjectSpan of rawObjectSpans) {
        let grounding = deterministicSpanGrounding(rawObjectSpan, catalog)

        if (needsIdentityLlm(grounding)) {
            if (catalog.length === 0) {
                return {
                    type: 'error',
                    errorMessage: objectManipulationErrorMessages.noCatalog,
                }
            }

            const promptParts = buildObjectManipulationIdentityPrompt(command, {
                rawObjectSpan,
                catalog,
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

            const entry = catalog.find(({ objectId }) => objectId === parsed.response.objectId)
            grounding = {
                type: 'resolved',
                objectId: parsed.response.objectId,
                catalogScope: entry?.catalogScope ?? 'room',
            }
        } else if (grounding.type === 'noCatalog') {
            return {
                type: 'error',
                errorMessage: objectManipulationErrorMessageForResolution({ type: 'NoCatalog' }),
            }
        }

        spanGroundings.push(grounding)
    }

    return { type: 'success', spanGroundings }
}
