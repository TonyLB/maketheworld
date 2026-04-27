import {
    CachePointType,
    type BedrockRuntimeClient,
    type ContentBlock,
    type Message,
} from '@aws-sdk/client-bedrock-runtime'
import {
    invokeBedrockConverseText,
    type InvokeBedrockConverseTextResult,
    type NovaReasoningEffort,
} from '../../../../../llm/invokeBedrockConverseText'
import type { CoyotePromptParts } from '../hypothesis/buildHypothesisPrompt'

export const BEDROCK_HYPOTHESIS_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_HYPOTHESIS_TIMEOUT_MS = 30_000

/** Stage 1: clustering seam Markdown only — typically shorter output than stage 2. */
export const BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS = 512

/** Stage 2 max output tokens ("## Scene analysis" prose + Hypothesis line); increase if the model truncates. */
export const BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS = 2048

/**
 * Default max tokens for Option A hops after combine (plan selection; phase-plan + surface).
 * Tune from harness **`usage`** only — topology stays two Bedrock hops after combine (see [`AGENT.md`](./AGENT.md)).
 */
export const BEDROCK_HYPOTHESIS_NEW_HOP_DEFAULT_MAX_TOKENS = 2048

/**
 * Hop 1 (plan selection + rubric + fenced JSON handoff).
 * Compare **`usagePlanSelection`** vs **`usagePhasePlanHop`** from [`runCoyoteEngineTestHarness`](./runCoyoteEngineTestHarness.ts) when tuning output caps.
 */
export const BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS = BEDROCK_HYPOTHESIS_NEW_HOP_DEFAULT_MAX_TOKENS

/**
 * Hop 2 (phase-plan JSON + "## Scene analysis" + fenced Hypothesis line).
 * Hypothesis pipeline: three sequential invokes (stage one + hop 1 + hop 2), each using [`BEDROCK_HYPOTHESIS_TIMEOUT_MS`] — ensure Lambda timeout fits all plus combine work (see [`AGENT.md`](./AGENT.md), template.yaml).
 */
export const BEDROCK_HYPOTHESIS_PHASE_PLAN_HOP_MAX_TOKENS = BEDROCK_HYPOTHESIS_NEW_HOP_DEFAULT_MAX_TOKENS

/** Default max output tokens for [`invokeBedrockHypothesis`] when not using stage wrappers (e.g. plan outcome). */
export const BEDROCK_HYPOTHESIS_MAX_TOKENS = BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS

export type InvokeBedrockHypothesisSuccess = Extract<InvokeBedrockConverseTextResult, { success: true }>
export type InvokeBedrockHypothesisFailure = Extract<InvokeBedrockConverseTextResult, { success: false }>
export type InvokeBedrockHypothesisResult = InvokeBedrockConverseTextResult

function coyoteUserContent(prompt: CoyotePromptParts): ContentBlock[] {
    return [
        { text: prompt.invariantPrefix },
        { cachePoint: { type: CachePointType.DEFAULT } },
        { text: prompt.dynamicSuffix },
    ]
}

export async function invokeBedrockHypothesis(
    prompt: CoyotePromptParts,
    options: {
        modelId?: string;
        maxTokens?: number;
        temperature?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
        extendedThinking?: boolean;
        reasoningEffort?: NovaReasoningEffort;
    } = {}
): Promise<InvokeBedrockHypothesisResult> {
    const modelId = options.modelId ?? BEDROCK_HYPOTHESIS_MODEL_ID
    const maxTokens = options.maxTokens ?? BEDROCK_HYPOTHESIS_MAX_TOKENS
    const timeoutMs = options.timeoutMs ?? BEDROCK_HYPOTHESIS_TIMEOUT_MS
    const temperature = options.temperature ?? 0.2

    const userMessage: Message = {
        role: 'user',
        content: coyoteUserContent(prompt),
    }

    return invokeBedrockConverseText({
        modelId,
        messages: [userMessage],
        maxTokens,
        temperature,
        timeoutMs,
        client: options.client,
        extendedThinking: options.extendedThinking,
        reasoningEffort: options.reasoningEffort,
    })
}

type InvokeBedrockHypothesisOptions = NonNullable<Parameters<typeof invokeBedrockHypothesis>[1]>

/** Hypothesis pipeline round-trip 1: seam Markdown. Defaults to [`BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS`]. */
export async function invokeBedrockHypothesisStageOne(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesis(prompt, {
        ...options,
        maxTokens: options.maxTokens ?? BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS,
    })
}

/** Option A hop 1: plan sketches + rubric matrix + selection + trailing ` ```json ` handoff. */
export async function invokeBedrockHypothesisPlanSelection(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesis(prompt, {
        ...options,
        maxTokens: options.maxTokens ?? BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS,
        extendedThinking: options.extendedThinking ?? false,
    })
}

/** Option A hop 2: leading phase-plan JSON + "## Scene analysis" + final fenced Hypothesis line. */
export async function invokeBedrockHypothesisPhasePlanHop(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesis(prompt, {
        ...options,
        maxTokens: options.maxTokens ?? BEDROCK_HYPOTHESIS_PHASE_PLAN_HOP_MAX_TOKENS,
        extendedThinking: options.extendedThinking ?? false,
    })
}

/**
 * Legacy name: same as [`invokeBedrockHypothesisPhasePlanHop`] (Option A hop 2).
 * @deprecated Prefer [`invokeBedrockHypothesisPhasePlanHop`].
 */
export async function invokeBedrockHypothesisStageTwo(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesisPhasePlanHop(prompt, options)
}
