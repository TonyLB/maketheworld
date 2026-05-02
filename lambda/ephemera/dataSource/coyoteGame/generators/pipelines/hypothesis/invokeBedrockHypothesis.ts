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
import {
    BEDROCK_NOVA_2_LITE_MODEL_ID,
    DEFAULT_NOVA_MODEL,
    type NovaModel,
    novaModelToBedrockModelId,
} from '../../../../../llm/novaModel'
import type { CoyotePromptParts } from './promptTypes'

export const BEDROCK_HYPOTHESIS_MODEL_ID = BEDROCK_NOVA_2_LITE_MODEL_ID
export const BEDROCK_HYPOTHESIS_TIMEOUT_MS = 30_000

/** Candidates phase (first hop): seam Markdown only; shorter cap than post-combine hops. */
export const BEDROCK_HYPOTHESIS_CANDIDATES_MAX_TOKENS = 1024

/**
 * Default max output tokens for post-combine hops (plan selection, narrative beat), and for
 * [`invokeBedrockHypothesis`] when callers omit maxTokens (e.g. plan outcome).
 * Tune from harness **`usage`** — two Bedrock invokes after combine (see [`AGENT.md`](./AGENT.md)).
 */
export const BEDROCK_HYPOTHESIS_DEFAULT_MAX_TOKENS = 2048

/**
 * Plan-selection hop (rubric + fenced JSON handoff).
 * Raised above [`BEDROCK_HYPOTHESIS_DEFAULT_MAX_TOKENS`] for internal materialized candidates, rubric prose, and large `selectedCandidate` JSON on heavy plans.
 * Compare **`usagePlanSelection`** vs **`usageNarrativeBeat`** from [`runCoyoteEngineTestHarness`](./runCoyoteEngineTestHarness.ts) when tuning output caps.
 */
export const BEDROCK_HYPOTHESIS_PLAN_SELECTION_MAX_TOKENS = 4096

/**
 * Narrative beat hop (phase-plan JSON + "## Scene analysis" + fenced Hypothesis line).
 * Hypothesis pipeline: three sequential invokes (candidates phase + plan selection + narrative beat), each using [`BEDROCK_HYPOTHESIS_TIMEOUT_MS`] — ensure Lambda timeout fits all plus combine work (see [`AGENT.md`](./AGENT.md), template.yaml).
 */
export const BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS = BEDROCK_HYPOTHESIS_DEFAULT_MAX_TOKENS

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
        model?: NovaModel;
        modelId?: string;
        maxTokens?: number;
        temperature?: number;
        timeoutMs?: number;
        client?: BedrockRuntimeClient;
        extendedThinking?: boolean;
        reasoningEffort?: NovaReasoningEffort;
    } = {}
): Promise<InvokeBedrockHypothesisResult> {
    const model = options.model ?? DEFAULT_NOVA_MODEL
    const modelId = options.modelId ?? novaModelToBedrockModelId(model)
    const maxTokens = options.maxTokens ?? BEDROCK_HYPOTHESIS_DEFAULT_MAX_TOKENS
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

/** Candidates phase: seam Markdown. Defaults to [`BEDROCK_HYPOTHESIS_CANDIDATES_MAX_TOKENS`]. */
export async function invokeBedrockHypothesisStageOne(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesis(prompt, {
        ...options,
        maxTokens: options.maxTokens ?? BEDROCK_HYPOTHESIS_CANDIDATES_MAX_TOKENS,
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

/** Narrative beat hop: leading phase-plan JSON + "## Scene analysis" + final fenced Hypothesis line. */
export async function invokeBedrockHypothesisNarrativeBeat(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesis(prompt, {
        ...options,
        maxTokens: options.maxTokens ?? BEDROCK_HYPOTHESIS_NARRATIVE_BEAT_MAX_TOKENS,
        extendedThinking: options.extendedThinking ?? false,
    })
}
