import {
    type AcmeOrderEnrichModelResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandLookRoomResult } from './baseClasses'
import { discriminateIntent } from './discriminateIntent'
export { navigationIntentErrorMessages } from './discriminateIntent/exitResolution'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'
import {
    finalizeAcmeOrderFromStepB,
    interpretAcmeOrderEnrichBody,
} from './mergeAcmeOrderEnrich'

/** Step B chain-of-reason Markdown only; use with {@link parseCommandWithEnrichReasoning} for harness review. */
export type ParseCommandWithEnrichReasoningResult = {
    result: ParseCommandResult;
    enrichReasoningMarkdown: string;
};

async function parseCommandCore(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich
    const stepA = await discriminateIntent(input, deps)

    if (stepA.type !== 'AcmeOrderIntent') {
        return { result: stepA, enrichReasoningMarkdown: '' }
    }

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
        stepA.confidence,
        enrichResponse,
        enrichInvokeFailed,
        fallbackName
    )
    return { result, enrichReasoningMarkdown }
}

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **bare `look` / `l`** returns **`LookRoom`**; **bare `help`** returns **`Help`**: all without Bedrock.
 * Otherwise classifies via LLM (Step A), then runs Acme Step B only when intent is **AcmeOrderIntent**. Step A outcomes **PromptInjectionAttempt**, **Unknown**, **Unimplemented**, and others (except **NavigationIntent**, which resolves here) pass through without Step B.
 * Enrich chain-of-reason Markdown is not attached to **`AcmeOrder`**; use {@link parseCommandWithEnrichReasoning} when needed (e.g. affinities harness).
 */
export async function parseCommand(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandResult> {
    const { result } = await parseCommandCore(input, deps)
    if (isParseCommandLookRoomResult(result)) {
        const preview = input.command.trim().slice(0, 120)
        console.log('[mtw.ephemera.parseCommand] LookRoom', {
            confidence: result.confidence,
            commandPreview: preview,
        })
    }
    return result
}

/**
 * Same pipeline as **`parseCommand`** (including **bare `look` / `l`**, **bare `help`**, Coyote test shortcuts without Bedrock, and Step A terminals like **PromptInjectionAttempt** without Acme Step B), plus Step B **`enrichReasoningMarkdown`** for manual review (affinities harness). Does not add that string to **`AcmeOrder`**.
 */
export async function parseCommandWithEnrichReasoning(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    return parseCommandCore(input, deps)
}
