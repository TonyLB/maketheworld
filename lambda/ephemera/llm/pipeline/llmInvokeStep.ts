import type { Draft } from 'immer';

import type {
    InvokeBedrockConverseTextParams,
    InvokeBedrockConverseTextResult,
} from '../invokeBedrockConverseText';
import type { AnyPipelineState, LlmAdapterStepDefinition } from './pipelineSteps';

/** Summarizes transport outcome for **`meta*`** slots on pipeline state */
export type LlmInvokeDiagnostics = {
    ok: boolean;
    modelId: string;
    latencyMs: number;
    usage?: NonNullable<
        Extract<InvokeBedrockConverseTextResult, { success: true }>['usage']
    >;
    errorMessage?: string;
};

/**
 * Builds an {@link LlmAdapterStepDefinition} around `invokeBedrockConverseText`-shaped calls.
 * Prompt assembly and domain-specific output wiring stay in `buildParams` / `applyOutputs`.
 */
export function defineLlmInvokeStep<S extends AnyPipelineState>(options: {
    name: string;
    buildParams: (
        draft: Draft<S>
    ) => InvokeBedrockConverseTextParams | Promise<InvokeBedrockConverseTextParams>;
    invoke: (params: InvokeBedrockConverseTextParams) => Promise<InvokeBedrockConverseTextResult>;
    applyOutputs: (
        draft: Draft<S>,
        extracted: { body: string; reasoningContent?: string }
    ) => void | Promise<void>;
    /** Writes invoke diagnostics onto `S` (for example `draft.metaA = meta`) */
    applyMeta?: (draft: Draft<S>, meta: LlmInvokeDiagnostics) => void | Promise<void>;
}): LlmAdapterStepDefinition<S> {
    const { name, buildParams, invoke: invokeBedrock, applyOutputs, applyMeta } = options;

    return {
        name,
        run: async (draft) => {
            const params = await buildParams(draft);
            const started = Date.now();
            const modelId = params.modelId;
            const result = await invokeBedrock(params);
            const latencyMs = Date.now() - started;

            if (!result.success) {
                await applyMeta?.(draft, {
                    ok: false,
                    modelId,
                    latencyMs,
                    errorMessage: result.errorMessage,
                });
                throw new Error(result.errorMessage);
            }

            await applyOutputs(draft, {
                body: result.body,
                reasoningContent: result.reasoningContent,
            });

            await applyMeta?.(draft, {
                ok: true,
                modelId,
                latencyMs,
                usage: result.usage,
            });
        },
    };
}
