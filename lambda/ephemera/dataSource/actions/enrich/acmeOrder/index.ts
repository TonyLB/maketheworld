import { invokeBedrockAcmeOrderEnrich } from '../../../../generateExample/invokeBedrockAcmeOrderEnrich'
import type { AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { CollectCoyoteOccupiedStableKeysDeps } from '../../baseClasses'
import type { ParseCommandAcmeOrderResult, ParseCommandErrorResult } from '../../baseClasses'
import { countCoyotePlacedObjectsAcrossRooms } from '../../utilities/countCoyotePlacedObjectsAcrossRooms'
import { buildParseAcmeOrderEnrichPrompt } from './buildPrompt'
import {
    finalizeAcmeOrderFromEnrich,
    interpretAcmeOrderEnrichBody,
} from './interpretAndFinalize'

/** Placement rows across Coyote demo rooms above this block Acme order enrich (see task plan). */
export const ACME_ORDER_COYOTE_MAX_OBJECTS = 20

export const ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE =
    'You already have more than twenty items placed ... even Acme thinks this plan is getting too complicated.'

export type EnrichAcmeOrderInput = {
    command: string
    occupiedStableKeys?: readonly string[]
}

export type EnrichAcmeOrderResult = ParseCommandAcmeOrderResult | ParseCommandErrorResult

export async function enrichAcmeOrder(
    input: EnrichAcmeOrderInput,
    intentConfidence: number,
    invokeBedrockAcmeOrderEnrichImpl?: typeof invokeBedrockAcmeOrderEnrich,
    countCoyoteDeps?: Partial<CollectCoyoteOccupiedStableKeysDeps>
): Promise<{
    result: EnrichAcmeOrderResult
    enrichReasoningMarkdown: string
}> {
    const count = await countCoyotePlacedObjectsAcrossRooms(countCoyoteDeps)
    if (count > ACME_ORDER_COYOTE_MAX_OBJECTS) {
        return {
            result: {
                type: 'Error',
                errorMessage: ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE,
            },
            enrichReasoningMarkdown: '',
        }
    }

    const invokeEnrich = invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich
    const enrichPromptParts = buildParseAcmeOrderEnrichPrompt(input.command, {
        occupiedStableKeys: input.occupiedStableKeys ?? [],
    })
    const enrichInvoke = await invokeEnrich(enrichPromptParts)

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: AcmeOrderEnrichModelResponse | null = null
    let enrichReasoningMarkdown = ''

    if (enrichInvoke.success) {
        const fallback = input.command.trim() || 'order'
        const parsed = interpretAcmeOrderEnrichBody(enrichInvoke.body, {
            emptyFallbackName: fallback,
        })
        if (parsed.success) {
            enrichResponse = parsed.response
            enrichReasoningMarkdown = parsed.reasoningMarkdown
        } else {
            enrichInvokeFailed = true
        }
    }

    const fallbackName = input.command.trim() || 'order'
    const result = finalizeAcmeOrderFromEnrich(
        intentConfidence,
        enrichResponse,
        enrichInvokeFailed,
        fallbackName
    )
    return { result, enrichReasoningMarkdown }
}
