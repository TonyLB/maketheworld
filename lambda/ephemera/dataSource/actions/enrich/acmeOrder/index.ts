import { invokeBedrockAcmeOrderEnrich } from '../../../../generateExample/invokeBedrockAcmeOrderEnrich'
import type { AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { buildParseAcmeOrderEnrichPrompt } from './buildPrompt'
import {
    finalizeAcmeOrderFromStepB,
    interpretAcmeOrderEnrichBody,
} from './interpretAndFinalize'

export type EnrichAcmeOrderInput = {
    command: string
    occupiedStableKeys?: readonly string[]
}

export type EnrichAcmeOrderResult = ReturnType<typeof finalizeAcmeOrderFromStepB>

export async function enrichAcmeOrder(
    input: EnrichAcmeOrderInput,
    intentConfidence: number,
    invokeBedrockAcmeOrderEnrichImpl?: typeof invokeBedrockAcmeOrderEnrich
): Promise<{
    result: EnrichAcmeOrderResult
    enrichReasoningMarkdown: string
}> {
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
    const result = finalizeAcmeOrderFromStepB(
        intentConfidence,
        enrichResponse,
        enrichInvokeFailed,
        fallbackName
    )
    return { result, enrichReasoningMarkdown }
}
