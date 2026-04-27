import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame';
import {
    runCoyoteHypothesisPipeline,
    type GenerateHypothesisDeps,
    type GenerateHypothesisPipelineResult,
} from './coyoteHypothesisPipeline';

export type { GenerateHypothesisDeps, GenerateHypothesisPipelineResult } from './coyoteHypothesisPipeline';

/** Same as [`generateHypothesis`] but exposes per-stage Bedrock results (e.g. harness metrics). */
export async function generateHypothesisWithStageResults(
    deps: GenerateHypothesisDeps
): Promise<GenerateHypothesisPipelineResult> {
    return runCoyoteHypothesisPipeline(deps);
}

/** Generates hypothesis line plus optional scene-analysis scaffolding via two Bedrock round-trips (seam, then scene + Hypothesis). */
export async function generateHypothesis(deps: GenerateHypothesisDeps): Promise<CoyoteGameIntentRecord> {
    const { record } = await runCoyoteHypothesisPipeline(deps);
    return record;
}
