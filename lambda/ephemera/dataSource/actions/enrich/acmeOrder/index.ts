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

/** Placement rows across Coyote demo rooms above this block Acme order enrich (see **`actions/AGENT.md`** Coyote placement cap). */
export const ACME_ORDER_COYOTE_MAX_OBJECTS = 20

export const ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE =
    'You already have more than twenty items placed ... even Acme thinks this plan is getting too complicated.'
const ACME_ENRICH_DEBUG = false

export type EnrichAcmeOrderInput = {
    command: string
    occupiedStableKeys?: readonly string[]
    /** Raw product spans from intent classification; enrich prompt treats as advisory segmentation hints only. */
    intentRawOrders?: readonly string[]
    /** Deprecated compatibility flag; prompt remains compact regardless of value. */
    debugRationale?: boolean
}

export type EnrichAcmeOrderResult = ParseCommandAcmeOrderResult | ParseCommandErrorResult

function summarizeTropeFailureReasons(
    enrichResponse: AcmeOrderEnrichModelResponse | null,
    enrichInvokeFailed: boolean,
    parseFailureReason: string | undefined
): string[] {
    if (enrichInvokeFailed) {
        return [parseFailureReason ? `invoke_or_parse_failed:${parseFailureReason}` : 'invoke_failed_or_no_response']
    }
    if (!enrichResponse) {
        return ['no_enrich_response']
    }
    const reasons = enrichResponse.lines.flatMap((line, index) => {
        if (line.valid === false) {
            return []
        }
        const lineReasons: string[] = []
        if (line.tropeAffinitiesFailed === true) {
            lineReasons.push('tropeAffinitiesFailed=true')
        }
        if ((line.tropeAffinities ?? []).length === 0) {
            lineReasons.push('tropeAffinities empty')
        }
        if (lineReasons.length === 0) {
            return []
        }
        return [`line${index + 1}:${lineReasons.join('+')}`]
    })
    return reasons.length > 0 ? reasons : ['none']
}

export async function enrichAcmeOrder(
    input: EnrichAcmeOrderInput,
    intentConfidence: number,
    invokeBedrockAcmeOrderEnrichImpl?: typeof invokeBedrockAcmeOrderEnrich,
    countCoyoteDeps?: Partial<CollectCoyoteOccupiedStableKeysDeps>
): Promise<{
    result: EnrichAcmeOrderResult
    enrichReasoningMarkdown: string
    enrichRawBody?: string
}> {
    const commandPreview = input.command.trim().slice(0, 200)
    if (ACME_ENRICH_DEBUG) {
        console.log('[mtw.ephemera.acmeEnrich] start', {
            commandPreview,
            occupiedStableKeysCount: input.occupiedStableKeys?.length ?? 0,
            intentConfidence,
        })
    }
    const count = await countCoyotePlacedObjectsAcrossRooms(countCoyoteDeps)
    if (count > ACME_ORDER_COYOTE_MAX_OBJECTS) {
        if (ACME_ENRICH_DEBUG) {
            console.warn('[mtw.ephemera.acmeEnrich] blocked_by_placed_objects_cap', {
                placedObjectsCount: count,
                cap: ACME_ORDER_COYOTE_MAX_OBJECTS,
            })
        }
        return {
            result: {
                type: 'Error',
                errorMessage: ACME_ORDER_TOO_MANY_PLACED_OBJECTS_MESSAGE,
            },
            enrichReasoningMarkdown: '',
            enrichRawBody: undefined,
        }
    }

    const invokeEnrich = invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich
    const enrichPromptParts = buildParseAcmeOrderEnrichPrompt(input.command, {
        occupiedStableKeys: input.occupiedStableKeys ?? [],
        intentRawOrders: input.intentRawOrders,
    })
    const enrichInvoke = await invokeEnrich(enrichPromptParts)
    if (ACME_ENRICH_DEBUG) {
        console.log('[mtw.ephemera.acmeEnrich] invoke_complete', {
            success: enrichInvoke.success,
            bodyLength: enrichInvoke.success ? enrichInvoke.body.length : 0,
            errorMessage: enrichInvoke.success ? undefined : enrichInvoke.errorMessage,
        })
    }

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: AcmeOrderEnrichModelResponse | null = null
    let enrichReasoningMarkdown = ''
    let enrichRawBody: string | undefined = undefined
    let parseFailureReason: string | undefined = undefined

    if (enrichInvoke.success) {
        enrichRawBody = enrichInvoke.body
        const fallback = input.command.trim() || 'order'
        const parsed = interpretAcmeOrderEnrichBody(enrichInvoke.body, {
            emptyFallbackName: fallback,
        })
        if (parsed.success) {
            enrichResponse = parsed.response
            enrichReasoningMarkdown = parsed.reasoningMarkdown
            if (ACME_ENRICH_DEBUG) {
                console.log('[mtw.ephemera.acmeEnrich] parse_success', {
                    linesCount: parsed.response.lines.length,
                    reasoningLength: parsed.reasoningMarkdown.length,
                })
            }
        } else {
            enrichInvokeFailed = true
            parseFailureReason = parsed.errorMessage
            if (ACME_ENRICH_DEBUG) {
                console.warn('[mtw.ephemera.acmeEnrich] parse_failed', {
                    errorMessage: parsed.errorMessage,
                    bodyPreview: enrichInvoke.body.slice(0, 400),
                })
            }
        }
    }

    const fallbackName = input.command.trim() || 'order'
    const result = finalizeAcmeOrderFromEnrich(
        intentConfidence,
        enrichResponse,
        enrichInvokeFailed,
        fallbackName
    )
    if (ACME_ENRICH_DEBUG) {
        console.log('[mtw.ephemera.acmeEnrich] finalize_complete', {
            resultType: result.type,
            enrichInvokeFailed,
            hasReasoning: enrichReasoningMarkdown.length > 0,
            validOrdersCount: result.type === 'AcmeOrder'
                ? result.orders.filter(({ valid }) => valid).length
                : 0,
            invalidOrdersCount: result.type === 'AcmeOrder'
                ? result.orders.filter(({ valid }) => !valid).length
                : 0,
            tropeFailureReasons: summarizeTropeFailureReasons(
                enrichResponse,
                enrichInvokeFailed,
                parseFailureReason
            ),
        })
    }
    return { result, enrichReasoningMarkdown, enrichRawBody }
}
