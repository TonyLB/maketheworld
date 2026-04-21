import type { Draft } from 'immer';

/**
 * Upper bound for pipeline state: a shallow record of optional **slots** (`input*`, `output*`, `meta*`, ...).
 * Each feature defines its own concrete `S` (for example `Partial<{ inputA, outputA, metaA }>`); distinct slot
 * names and value types distinguish pipelines without extra nominal branding.
 * Per-call token usage and invoke diagnostics live in **`meta*`** slots, not in a parallel bag.
 */
export type AnyPipelineState = Record<string, unknown>;

/**
 * Primary step contract: each step mutates a single Immer **draft** of `S`.
 * The runner applies **`createDraft` / `finishDraft`** per step; prefer shallow writes to top-level slot keys.
 */
export type PipelineStepDraftFn<S extends AnyPipelineState> = (draft: Draft<S>) => void | Promise<void>;

/**
 * Orchestration: async TypeScript only; no Bedrock. Reads prior `input*` / `output*` slots and may
 * derive the next step's inputs.
 */
export type OrchestrationStepDefinition<S extends AnyPipelineState> = {
    /** Structured log / span name (Phase 2). */
    name: string;
    run: PipelineStepDraftFn<S>;
};

/**
 * LLM adapter: thin wrapper around feature-owned `invokeBedrock*` + prompt builders + parse/validate.
 * Framework (Phase 2) wires invoke to typed extraction and writes **`output*`** and **`meta*`** on `S`.
 * Prompt assembly, cache points, and domain options stay in the feature.
 */
export type LlmAdapterStepDefinition<S extends AnyPipelineState> = {
    name: string;
    run: PipelineStepDraftFn<S>;
};

export type PipelineStep<S extends AnyPipelineState> =
    | ({ kind: 'orchestration' } & OrchestrationStepDefinition<S>)
    | ({ kind: 'llm' } & LlmAdapterStepDefinition<S>);
