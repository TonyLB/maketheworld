import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { invokeBedrockObjectManipulationEnrich } from '../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import type { ObjectManipulationCatalogEntry, ObjectManipulationCatalogScope } from './catalogMerge'
import { buildObjectManipulationIdentityPrompt } from './buildPrompt'
import { createSpanEmbedCache } from './embeddingMatch/spanEmbedCache'
import {
    resolveObjectSpanByEmbedding,
    type ResolveObjectSpanByEmbeddingDeps,
} from './embeddingMatch/resolveObjectSpanByEmbedding'
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
    resolveObjectSpanByEmbeddingImpl?: typeof resolveObjectSpanByEmbedding
} & Pick<ResolveObjectSpanByEmbeddingDeps, 'embedSpan'>

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

async function invokeIdentityLlmForSpan(
    command: string,
    rawObjectSpan: string,
    catalog: readonly ObjectManipulationCatalogEntry[],
    invokeIdentity: typeof invokeBedrockObjectManipulationEnrich,
    allowedObjectIds: Set<EphemeraObjectId>
): Promise<
    | { type: 'resolved'; objectId: EphemeraObjectId; catalogScope: ObjectManipulationCatalogScope }
    | { type: 'error'; errorMessage: string }
> {
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
    return {
        type: 'resolved',
        objectId: parsed.response.objectId,
        catalogScope: entry?.catalogScope ?? 'room',
    }
}

export async function runIdentityStage(
    command: string,
    rawObjectSpans: readonly string[],
    catalog: readonly ObjectManipulationCatalogEntry[],
    deps: IdentityStageDeps = {}
): Promise<IdentityStageResult> {
    const invokeIdentity = deps.invokeBedrockObjectManipulationIdentityImpl ?? invokeBedrockObjectManipulationEnrich
    const resolveByEmbedding = deps.resolveObjectSpanByEmbeddingImpl ?? resolveObjectSpanByEmbedding
    const allowedObjectIds = new Set(catalog.map(({ objectId }) => objectId))
    const spanEmbedCache = createSpanEmbedCache()
    const spanGroundings: SpanGrounding[] = []

    for (const rawObjectSpan of rawObjectSpans) {
        let grounding = deterministicSpanGrounding(rawObjectSpan, catalog)

        if (grounding.type === 'noCatalog') {
            return {
                type: 'error',
                errorMessage: objectManipulationErrorMessageForResolution({ type: 'NoCatalog' }),
            }
        }

        if (grounding.type === 'noMatch') {
            const embeddingDecision = await resolveByEmbedding(rawObjectSpan, catalog, {
                embedSpan: deps.embedSpan,
                spanEmbedCache,
            })
            if (embeddingDecision.type === 'Resolved') {
                grounding = {
                    type: 'resolved',
                    objectId: embeddingDecision.objectId,
                    catalogScope: embeddingDecision.catalogScope,
                }
            }
        }

        if (grounding.type === 'noMatch' || grounding.type === 'ambiguous') {
            if (catalog.length === 0) {
                return {
                    type: 'error',
                    errorMessage: objectManipulationErrorMessages.noCatalog,
                }
            }

            const llmResult = await invokeIdentityLlmForSpan(
                command,
                rawObjectSpan,
                catalog,
                invokeIdentity,
                allowedObjectIds
            )
            if (llmResult.type === 'error') {
                return llmResult
            }

            grounding = {
                type: 'resolved',
                objectId: llmResult.objectId,
                catalogScope: llmResult.catalogScope,
            }
        }

        spanGroundings.push(grounding)
    }

    return { type: 'success', spanGroundings }
}
