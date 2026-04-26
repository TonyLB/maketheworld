import {
    type AcmeOrderEnrichModelResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import { invokeBedrockParseCommand } from '../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import {
    isParseCommandAcmeOrderIntentResult,
    isParseCommandLookRoomResult,
    isParseCommandNavigationIntentResult,
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

type ExitResolutionResult =
    | { type: 'Resolved'; targetId: EphemeraRoomId }
    | { type: 'NoExitContext' }
    | { type: 'NoMatch' }
    | { type: 'AmbiguousMatch' }

export const navigationIntentErrorMessages = {
    noExitContext: 'NavigationIntent resolution failed: no current room exit context',
    noMatch: 'NavigationIntent resolution failed: no such exit',
    ambiguousMatch: 'NavigationIntent resolution failed: ambiguous exit',
} as const

function resolveExitLabelToTargetId(input: ParseCommandInput, rawCandidate: string): ExitResolutionResult {
    if (!input.roomExits || input.roomExits.length === 0) {
        return { type: 'NoExitContext' }
    }
    const normalizedCandidate = normalizeCommandToken(rawCandidate)
    if (!normalizedCandidate) {
        return { type: 'NoMatch' }
    }
    const matchingTargets = [
        ...new Set(input.roomExits
            .filter(({ normalizedName }) => normalizedName === normalizedCandidate)
            .map(({ targetId }) => targetId)),
    ]
    if (matchingTargets.length === 0) {
        return { type: 'NoMatch' }
    }
    if (matchingTargets.length > 1) {
        return { type: 'AmbiguousMatch' }
    }
    return { type: 'Resolved', targetId: matchingTargets[0] }
}

function maybeDeterministicNavigationResult(input: ParseCommandInput): ParseCommandResult | null {
    const trimmed = input.command.trim()
    if (!trimmed) {
        return null
    }
    const goMatch = /^go\s+(.+)$/i.exec(trimmed)
    const rawCandidate = goMatch ? goMatch[1] : trimmed
    if (!normalizeCommandToken(rawCandidate)) {
        return null
    }
    const resolved = resolveExitLabelToTargetId(input, rawCandidate)
    if (resolved.type !== 'Resolved') {
        return null
    }
    return { type: 'Navigation', targetId: resolved.targetId, confidence: 1 }
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

    const prompt = buildParseCommandIntentClassificationPrompt(input.command, {
        movementExitLabels: [...new Set((input.roomExits ?? []).map(({ normalizedName }) => normalizedName))],
    })
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { result: { type: 'Error', errorMessage: invokeResult.errorMessage }, enrichReasoningMarkdown: '' }
    }

    const stepA = interpretParseCommandIntentClassificationBody(invokeResult.body)

    if (isParseCommandNavigationIntentResult(stepA)) {
        const resolved = resolveExitLabelToTargetId(input, stepA.exitCandidate)
        if (resolved.type === 'Resolved') {
            return {
                result: {
                    type: 'Navigation',
                    targetId: resolved.targetId,
                    confidence: stepA.confidence,
                },
                enrichReasoningMarkdown: '',
            }
        }
        if (resolved.type === 'NoExitContext') {
            return {
                result: { type: 'Error', errorMessage: navigationIntentErrorMessages.noExitContext },
                enrichReasoningMarkdown: '',
            }
        }
        if (resolved.type === 'AmbiguousMatch') {
            return {
                result: { type: 'Error', errorMessage: navigationIntentErrorMessages.ambiguousMatch },
                enrichReasoningMarkdown: '',
            }
        }
        return {
            result: { type: 'Error', errorMessage: navigationIntentErrorMessages.noMatch },
            enrichReasoningMarkdown: '',
        }
    }

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
