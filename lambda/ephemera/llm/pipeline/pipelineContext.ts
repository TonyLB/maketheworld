import type {
    AnyPipelineState,
    LlmAdapterStepDefinition,
    OrchestrationStepDefinition,
    PipelineStep,
} from './pipelineSteps';
import { runPipeline } from './pipelineRunner';
import type { RunPipelineFn } from './pipelineRunner';

/**
 * Bundle of step constructors and runner, all fixed to a single state type `S`.
 */
export type PipelineContext<S extends AnyPipelineState> = {
    defineOrchestrationStep: (step: OrchestrationStepDefinition<S>) => PipelineStep<S>;
    defineLlmStep: (step: LlmAdapterStepDefinition<S>) => PipelineStep<S>;
    runPipeline: RunPipelineFn<S>;
};

/**
 * Generic factory type: fixes `S` and yields {@link PipelineContext} for that pipeline.
 */
export type CreatePipelineContextFn = <S extends AnyPipelineState>() => PipelineContext<S>;

export function createPipelineContext<S extends AnyPipelineState>(): PipelineContext<S> {
    return {
        defineOrchestrationStep: (step: OrchestrationStepDefinition<S>): PipelineStep<S> => ({
            kind: 'orchestration',
            ...step,
        }),
        defineLlmStep: (step: LlmAdapterStepDefinition<S>): PipelineStep<S> => ({
            kind: 'llm',
            ...step,
        }),
        runPipeline,
    };
}
