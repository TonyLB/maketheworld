import type {
    AnyPipelineState,
    LlmAdapterStepDefinition,
    OrchestrationStepDefinition,
    PipelineStep,
} from './pipelineSteps';
import type { RunPipelineFn } from './pipelineRunner';

/**
 * Bundle of step constructors and runner, all fixed to a single state type `S`.
 * Phase 2 provides a runtime implementation; Phase 1 defines the contract only.
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
