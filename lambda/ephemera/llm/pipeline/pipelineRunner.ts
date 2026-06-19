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
    /**
     * Last committed pipeline state. On product abort (`abort: true`), the aborting step's returned `state`.
     * On unexpected throw, state from the last successfully committed step (no partial writes from the throwing step).
     */
    state: S;
    failedStepName: string;
    failedStepIndex: number;
    /** `true` when the step returned `{ state, abort: true }`; `false` or omitted on unexpected throw. */
    abort?: boolean;
    /** Present on unexpected throw; omitted on product abort. */
    error?: unknown;
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
 * Sequential fold: each step runs in order; each step receives committed state from the prior step's return.
 */
export type RunPipelineFn<S extends AnyPipelineState> = (
    initialState: S,
    steps: readonly PipelineStep<S>[],
    options?: PipelineRunOptions<S>
) => Promise<PipelineRunResult<S>>;

/**
 * Runs ordered steps against `initialState`. Each step returns the next full `S`; the runner folds results
 * without Immer. Product abort uses `{ state, abort: true }`; unexpected failures use `throw`.
 */
export async function runPipeline<S extends AnyPipelineState>(
    initialState: S,
    steps: readonly PipelineStep<S>[],
    options?: PipelineRunOptions<S>
): Promise<PipelineRunResult<S>> {
    let state = initialState;
    const { onStepStart, onStepEnd } = options ?? {};

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        onStepStart?.(step.name, i);
        try {
            const result = await step.run(state);
            if ('abort' in result && result.abort === true) {
                onStepEnd?.(step.name, i);
                return {
                    ok: false,
                    state: result.state,
                    abort: true,
                    failedStepName: step.name,
                    failedStepIndex: i,
                };
            }
            state = result.state;
        } catch (error) {
            onStepEnd?.(step.name, i);
            return {
                ok: false,
                state,
                abort: false,
                failedStepName: step.name,
                failedStepIndex: i,
                error,
            };
        }
        onStepEnd?.(step.name, i);
    }

    return { ok: true, state };
}
