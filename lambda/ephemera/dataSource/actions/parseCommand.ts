import {
    type AcmeOrderEnrichModelResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import { invokeBedrockParseCommand } from '../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import {
    isParseCommandAcmeOrderIntentResult,
    isParseCommandLookRoomResult,
} from './baseClasses'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'
import { buildParseCommandIntentClassificationPrompt } from './buildParseCommandIntentClassificationPrompt'
import { isCoyoteAffinitiesTestSlashCommand } from './coyoteAffinitiesTestSlashCommand'
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
import {
    finalizeAcmeOrderFromStepB,
    interpretAcmeOrderEnrichBody,
} from './mergeAcmeOrderEnrich'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

/** After trim, case-insensitive **look** or **l** as the whole line (legacy bare-look parity; no Step B). */
function isBareLookCommand(trimmed: string): boolean {
    return /^(?:look|l)$/i.test(trimmed)
}

function normalizeCommandToken(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function maybeDeterministicNavigationResult(input: ParseCommandInput): ParseCommandResult | null {
    if (!input.roomExits || input.roomExits.length === 0) {
        return null
    }
    const trimmed = input.command.trim()
    if (!trimmed) {
        return null
    }
    const goMatch = /^go\s+(.+)$/i.exec(trimmed)
    const rawCandidate = goMatch ? goMatch[1] : trimmed
    const normalizedCandidate = normalizeCommandToken(rawCandidate)
    if (!normalizedCandidate) {
        return null
    }
    const matchingTargets = [
        ...new Set(input.roomExits
            .filter(({ normalizedName }) => normalizedName === normalizedCandidate)
            .map(({ targetId }) => targetId)),
    ]
    if (matchingTargets.length !== 1) {
        return null
    }
    return { type: 'Navigation', targetId: matchingTargets[0], confidence: 1 }
}

/** Step B chain-of-reason Markdown only; use with {@link parseCommandWithEnrichReasoning} for harness review. */
export type ParseCommandWithEnrichReasoningResult = {
    result: ParseCommandResult;
    enrichReasoningMarkdown: string;
};

async function parseCommandCore(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    if (isCoyoteEngineTestSlashCommand(input.command)) {
        return { result: { type: 'CoyoteEngineTest', confidence: 1 }, enrichReasoningMarkdown: '' }
    }
    if (isCoyoteAffinitiesTestSlashCommand(input.command)) {
        return { result: { type: 'CoyoteAffinitiesTest', confidence: 1 }, enrichReasoningMarkdown: '' }
    }

    if (isBareLookCommand(input.command.trim())) {
        return { result: { type: 'LookRoom', confidence: 1 }, enrichReasoningMarkdown: '' }
    }

    const deterministicNavigation = maybeDeterministicNavigationResult(input)
    if (deterministicNavigation) {
        return { result: deterministicNavigation, enrichReasoningMarkdown: '' }
    }

    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich

    const prompt = buildParseCommandIntentClassificationPrompt(input.command)
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { result: { type: 'Error', errorMessage: invokeResult.errorMessage }, enrichReasoningMarkdown: '' }
    }

    const stepA = interpretParseCommandIntentClassificationBody(invokeResult.body)

    if (!isParseCommandAcmeOrderIntentResult(stepA)) {
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
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; **bare `look` / `l`** returns **`LookRoom`**: all without Bedrock.
 * Otherwise classifies via LLM (Step A), then runs Acme Step B when intent is **AcmeOrderIntent**.
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
 * Same pipeline as **`parseCommand`** (including **bare `look` / `l`** and Coyote test shortcuts without Bedrock), plus Step B **`enrichReasoningMarkdown`** for manual review (affinities harness). Does not add that string to **`AcmeOrder`**.
 */
export async function parseCommandWithEnrichReasoning(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    return parseCommandCore(input, deps)
}
