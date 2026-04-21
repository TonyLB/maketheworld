import type { AnyPipelineState, PipelineStep } from './pipelineSteps';

/**
 * Optional hooks for structured logging / tracing; Phase 2 invokes these around each step.
 * Token usage remains on **`meta*`** slots on pipeline state, not here.
 */
export type PipelineTelemetryHooks = {
    onStepStart?: (stepName: string, stepIndex: number) => void;
    onStepEnd?: (stepName: string, stepIndex: number) => void;
};

/**
 * Failure policy is caller-defined in Phase 2 (fail-fast, stub paths, no partial player-visible output).
 * This shape only carries the failed step identity and error payload for structured handling.
 */
export type PipelineRunFailure<S extends AnyPipelineState> = {
    ok: false;
    /** State after the last successful `produce` (or initial if the first step failed). */
    state: S;
    failedStepName: string;
    failedStepIndex: number;
    error: unknown;
};

export type PipelineRunSuccess<S extends AnyPipelineState> = {
    ok: true;
    state: S;
};

export type PipelineRunResult<S extends AnyPipelineState> = PipelineRunSuccess<S> | PipelineRunFailure<S>;

export type PipelineRunOptions<S extends AnyPipelineState> = PipelineTelemetryHooks & {
    /** Phase 2: extend with abort signals, per-run metrics tags, etc. */
    extra?: Record<string, unknown>;
};

/**
 * Sequential fold: each step runs in order; each step sees the immutable state from the previous `produce`.
 * Implementation lands in Phase 2.
 */
export type RunPipelineFn<S extends AnyPipelineState> = (
    initialState: S,
    steps: readonly PipelineStep<S>[],
    options?: PipelineRunOptions<S>
) => Promise<PipelineRunResult<S>>;
