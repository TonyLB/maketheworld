import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame';
import {
    runCoyoteHypothesisPipeline,
    type CoyoteHypothesisPipelineHarnessOptions,
    type GenerateHypothesisDeps,
    type GenerateHypothesisPipelineResult,
} from './coyoteHypothesisPipeline';

export type {
    CoyoteHypothesisPipelineHarnessOptions,
    CoyoteHypothesisHarnessRunKind,
    CoyoteHypothesisTestPhase,
    GenerateHypothesisDeps,
    GenerateHypothesisPipelineFullResult,
    GenerateHypothesisPipelineHarnessPartialResult,
    GenerateHypothesisPipelineResult,
    GenerateHypothesisPipelineStubResult,
} from './coyoteHypothesisPipeline';

/** Same as [`generateHypothesis`] but exposes per-stage Bedrock results (e.g. harness metrics). */
export async function generateHypothesisWithStageResults(
    deps: GenerateHypothesisDeps,
    harnessOptions?: CoyoteHypothesisPipelineHarnessOptions
): Promise<GenerateHypothesisPipelineResult> {
    return runCoyoteHypothesisPipeline(deps, harnessOptions);
}

/** Generates hypothesis line plus optional scene-analysis scaffolding via two Bedrock round-trips (seam, then scene + Hypothesis). */
export async function generateHypothesis(deps: GenerateHypothesisDeps): Promise<CoyoteGameIntentRecord> {
    const result = await runCoyoteHypothesisPipeline(deps);
    if (result.kind === 'full' || result.kind === 'stub') {
        return result.record;
    }
    throw new Error('CoyoteHypothesisPipeline: unexpected harnessPartial without harness options');
}
