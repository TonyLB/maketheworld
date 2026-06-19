/**
 * Upper bound for pipeline state: a shallow record of optional **slots** (`input*`, `output*`, `meta*`, ...).
 * Each feature defines its own concrete `S` (for example `Partial<{ inputA, outputA, metaA }>`); distinct slot
 * names and value types distinguish pipelines without extra nominal branding.
 * Per-call token usage and invoke diagnostics live in **`meta*`** slots, not in a parallel bag.
 */
export type AnyPipelineState = Record<string, unknown>;

export type PipelineStepRunSuccess<S> = { state: S };
export type PipelineStepRunAbort<S> = { state: S; abort: true };
export type PipelineStepRunResult<S> = PipelineStepRunSuccess<S> | PipelineStepRunAbort<S>;

/**
 * Primary step contract: each step receives read-only committed state and returns the next full `S`
 * (or an abort discriminant carrying that `S`). The runner folds results sequentially; it does not use Immer.
 * Steps may use sync `produce` internally after async work when nested updates are clearer that way.
 */
export type PipelineStepRunFn<S extends AnyPipelineState> = (
    state: Readonly<S>
) => Promise<PipelineStepRunResult<S>>;

/**
 * Orchestration: async TypeScript only; no Bedrock. Reads prior `input*` / `output*` slots and may
 * derive the next step's inputs.
 */
export type OrchestrationStepDefinition<S extends AnyPipelineState> = {
    /** Structured log / span name. */
    name: string;
    run: PipelineStepRunFn<S>;
};

/**
 * LLM adapter: thin wrapper around feature-owned `invokeBedrock*` + prompt builders + parse/validate.
 * Framework wires invoke to typed extraction and writes **`output*`** and **`meta*`** on `S`.
 * Prompt assembly, cache points, and domain options stay in the feature.
 */
export type LlmAdapterStepDefinition<S extends AnyPipelineState> = {
    name: string;
    run: PipelineStepRunFn<S>;
};

export type PipelineStep<S extends AnyPipelineState> =
    | ({ kind: 'orchestration' } & OrchestrationStepDefinition<S>)
    | ({ kind: 'llm' } & LlmAdapterStepDefinition<S>);
