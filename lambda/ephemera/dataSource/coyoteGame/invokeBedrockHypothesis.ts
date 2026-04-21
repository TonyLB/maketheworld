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
} from '../../llm/invokeBedrockConverseText'
import type { CoyotePromptParts } from './buildHypothesisPrompt'

export const BEDROCK_HYPOTHESIS_MODEL_ID = 'us.amazon.nova-2-lite-v1:0' as const
export const BEDROCK_HYPOTHESIS_TIMEOUT_MS = 30_000

/** Stage 1: clustering seam Markdown only — typically shorter output than stage 2. */
export const BEDROCK_HYPOTHESIS_STAGE_ONE_MAX_TOKENS = 512

/** Stage 2: "## Scene analysis" prose + Hypothesis line (matches prior single-call hypothesis cap). */
export const BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS = 2048

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

/** Hypothesis pipeline round-trip 2: scene analysis + Hypothesis line. Defaults to [`BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS`]. */
export async function invokeBedrockHypothesisStageTwo(
    prompt: CoyotePromptParts,
    options: InvokeBedrockHypothesisOptions = {}
): Promise<InvokeBedrockHypothesisResult> {
    return invokeBedrockHypothesis(prompt, {
        ...options,
        maxTokens: options.maxTokens ?? BEDROCK_HYPOTHESIS_STAGE_TWO_MAX_TOKENS,
        extendedThinking: options.extendedThinking ?? true,
    })
}
