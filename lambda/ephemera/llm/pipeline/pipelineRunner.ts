import { createDraft, finishDraft } from 'immer';

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
     * Last committed pipeline state. On a thrown step, includes any mutations committed before the throw
     * (for example invoke diagnostics written in a failure path).
     */
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
 * Sequential fold: each step runs in order; each step sees the immutable state from the prior step's `finishDraft`.
 */
export type RunPipelineFn<S extends AnyPipelineState> = (
    initialState: S,
    steps: readonly PipelineStep<S>[],
    options?: PipelineRunOptions<S>
) => Promise<PipelineRunResult<S>>;

/**
 * Runs ordered steps against `initialState`. Each step mutates an Immer draft, then commits with `finishDraft`.
 * Uses `createDraft`/`finishDraft` (not async `produce`) so async steps can safely `await` before mutating the draft.
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
        const draft = createDraft(state);
        try {
            await step.run(draft);
        } catch (error) {
            /** Commit draft mutations made before throw (for example invoke diagnostics on failure paths). */
            state = finishDraft(draft) as S;
            onStepEnd?.(step.name, i);
            return {
                ok: false,
                state,
                failedStepName: step.name,
                failedStepIndex: i,
                error,
            };
        }
        state = finishDraft(draft) as S;
        onStepEnd?.(step.name, i);
    }

    return { ok: true, state };
}
