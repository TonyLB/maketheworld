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
        state: Readonly<S>
    ) => InvokeBedrockConverseTextParams | Promise<InvokeBedrockConverseTextParams>;
    invoke: (params: InvokeBedrockConverseTextParams) => Promise<InvokeBedrockConverseTextResult>;
    applyOutputs: (
        state: Readonly<S>,
        extracted: { body: string; reasoningContent?: string }
    ) => S | Promise<S>;
    /** Writes invoke diagnostics onto `S` (for example `metaA` slot) */
    applyMeta?: (state: Readonly<S>, meta: LlmInvokeDiagnostics) => S | Promise<S>;
}): LlmAdapterStepDefinition<S> {
    const { name, buildParams, invoke: invokeBedrock, applyOutputs, applyMeta } = options;

    return {
        name,
        run: async (state) => {
            const params = await buildParams(state);
            const started = Date.now();
            const modelId = params.modelId;
            const result = await invokeBedrock(params);
            const latencyMs = Date.now() - started;

            if (!result.success) {
                throw new Error(result.errorMessage);
            }

            let nextState = await applyOutputs(state, {
                body: result.body,
                reasoningContent: result.reasoningContent,
            });

            if (applyMeta) {
                nextState = await applyMeta(nextState, {
                    ok: true,
                    modelId,
                    latencyMs,
                    usage: result.usage,
                });
            }

            return { state: nextState };
        },
    };
}
