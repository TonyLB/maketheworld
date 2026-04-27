import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta';

import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame';
import {
    createPipelineContext,
    type PipelineRunFailure,
    type PipelineRunResult,
    type PipelineStep,
} from '../../../../../llm/pipeline';

import { buildHypothesisPhasePlanHopPromptParts } from './buildHypothesisPhasePlanHopPromptParts';
import { buildHypothesisPlanSelectionPromptParts } from './buildHypothesisPlanSelectionPromptParts';
import { buildHypothesisStageOnePromptParts } from './buildHypothesisStageOnePrompt';
import {
    combineHypothesisClusters,
    renderCombinedHypothesisForStageTwo,
} from './combineHypothesisClusters';
import { parseHop1HandoffFromSelectionBody, type CoyoteHop1Handoff } from './coyoteHop1Handoff';
import { buildCoyotePhasePlanValidationContext } from './coyoteHypothesisPhasePlanContext';
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectsByRoom } from '../../../coyoteRoomObjectSnapshot';
import {
    invokeBedrockHypothesisPhasePlanHop,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
    type InvokeBedrockHypothesisResult,
} from './invokeBedrockHypothesis';
import {
    parseHypothesisPhasePlanHopOutput,
    type ParseHypothesisModelOutputOptions,
} from '../../sharedParsers/parseHypothesisModelOutput';
import { parseHypothesisStageOneOutput } from './parseHypothesisStageOneOutput';

/**
 * Failure policy: Bedrock failure on Stage One, plan-selection hop, or phase-plan hop; invalid seam / combine;
 * or hop-1 handoff parse failure yields stub intent only --- no partial hypothesis to players.
 * Hop-2 phase-plan JSON validation failure does **not** abort when prose Hypothesis still parses (**Decided: structured validation failure**).
 */

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>;
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom;
};

export type GenerateHypothesisPipelineResult = {
    record: CoyoteGameIntentRecord;
    stageOneResult: InvokeBedrockHypothesisResult;
    /** Option A hop 1 (plan selection + rubric + JSON handoff). */
    planSelectionResult: InvokeBedrockHypothesisResult | null;
    /** Option A hop 2 (phase-plan JSON + "## Scene analysis" + fenced Hypothesis). */
    phasePlanHopResult: InvokeBedrockHypothesisResult | null;
    /** Hop 1 assistant body (plan selection); harness / tuning. */
    selectionBody?: string;
    /** Raw **` ```json ` ** interior that validated for **`phasePlan`**, when any. */
    phasePlanJson?: string;
    phasePlanValidationReason?: string;
    /** Phase-plan hop extended-reasoning text when Bedrock returned it (not stored on CoyoteGameIntentRecord). */
    stageTwoReasoningContent?: string;
};

export type CoyoteHypothesisPipelineState = {
    roomObjectsByRoom?: CoyoteRoomObjectsByRoom;
    combinedMarkdown?: string;
    stageOneResult?: InvokeBedrockHypothesisResult;
    planSelectionResult?: InvokeBedrockHypothesisResult | null;
    phasePlanHopResult?: InvokeBedrockHypothesisResult | null;
    hop1Handoff?: CoyoteHop1Handoff;
    selectionBody?: string;
    phasePlanJson?: string;
    phasePlanValidationReason?: string;
    record?: CoyoteGameIntentRecord;
    stageTwoReasoningContent?: string;
};

/** Thrown after partial state is written so [`runPipeline`] stops and the mapper returns a stub [`GenerateHypothesisPipelineResult`]. */
export class CoyoteHypothesisPipelineAbortError extends Error {
    constructor() {
        super('CoyoteHypothesisPipelineAbort');
        this.name = 'CoyoteHypothesisPipelineAbortError';
    }
}

function abort(): never {
    throw new CoyoteHypothesisPipelineAbortError();
}

function buildCoyoteHypothesisSteps(
    ctx: ReturnType<typeof createPipelineContext<CoyoteHypothesisPipelineState>>,
    deps: GenerateHypothesisDeps
): PipelineStep<CoyoteHypothesisPipelineState>[] {
    return [
        ctx.defineOrchestrationStep({
            name: 'loadRoomObjects',
            run: async (draft) => {
                draft.roomObjectsByRoom =
                    deps.roomObjectsByRoomOverride ?? (await loadCoyoteRoomObjectsByRoom(deps));
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisStageOneLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                if (!roomObjectsByRoom) {
                    throw new Error('CoyoteHypothesisPipeline: missing roomObjectsByRoom');
                }
                const stageOneParts = buildHypothesisStageOnePromptParts({ roomObjectsByRoom });
                const stageOneResult = await invokeBedrockHypothesisStageOne(stageOneParts);
                draft.stageOneResult = stageOneResult;
                if (!stageOneResult.success) {
                    abort();
                }
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'seamCombineRender',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const stageOneResult = draft.stageOneResult;
                if (!roomObjectsByRoom || !stageOneResult?.success) {
                    throw new Error('CoyoteHypothesisPipeline: seamCombineRender preconditions');
                }
                const seamParsed = parseHypothesisStageOneOutput(stageOneResult.body, roomObjectsByRoom);
                if (!seamParsed.ok) {
                    abort();
                }
                const combinedResult = combineHypothesisClusters(
                    seamParsed.clusters,
                    roomObjectsByRoom,
                    seamParsed.explicitOutliers
                );
                if (!combinedResult.ok) {
                    abort();
                }
                draft.combinedMarkdown = renderCombinedHypothesisForStageTwo(
                    combinedResult.combined,
                    roomObjectsByRoom
                );
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisPlanSelectionLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const combinedMarkdown = draft.combinedMarkdown;
                if (!roomObjectsByRoom || combinedMarkdown === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisPlanSelectionLlm preconditions');
                }
                const parts = buildHypothesisPlanSelectionPromptParts({
                    roomObjectsByRoom,
                    combinedMarkdown,
                });
                const planSelectionResult = await invokeBedrockHypothesisPlanSelection(parts);
                draft.planSelectionResult = planSelectionResult;
                if (!planSelectionResult.success) {
                    abort();
                }
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'parsePlanSelectionHandoff',
            run: async (draft) => {
                const planSelectionResult = draft.planSelectionResult;
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const combinedMarkdown = draft.combinedMarkdown;
                if (!planSelectionResult?.success || !roomObjectsByRoom || combinedMarkdown === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: parsePlanSelectionHandoff preconditions');
                }
                draft.selectionBody = planSelectionResult.body;
                const handoff = parseHop1HandoffFromSelectionBody(planSelectionResult.body);
                if (!handoff.ok) {
                    abort();
                }
                draft.hop1Handoff = handoff.handoff;
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisPhasePlanHopLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const combinedMarkdown = draft.combinedMarkdown;
                const handoff = draft.hop1Handoff;
                if (!roomObjectsByRoom || combinedMarkdown === undefined || !handoff) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisPhasePlanHopLlm preconditions');
                }
                const parts = buildHypothesisPhasePlanHopPromptParts({
                    roomObjectsByRoom,
                    combinedMarkdown,
                    hop1Handoff: handoff,
                });
                const phasePlanHopResult = await invokeBedrockHypothesisPhasePlanHop(parts);
                draft.phasePlanHopResult = phasePlanHopResult;
                if (!phasePlanHopResult.success) {
                    abort();
                }
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'parsePhasePlanHopRecord',
            run: async (draft) => {
                const phasePlanHopResult = draft.phasePlanHopResult;
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                if (!phasePlanHopResult?.success || !roomObjectsByRoom) {
                    throw new Error('CoyoteHypothesisPipeline: parsePhasePlanHopRecord preconditions');
                }
                const parseOptions: ParseHypothesisModelOutputOptions = {
                    reasoningContentProvided: Boolean(phasePlanHopResult.reasoningContent),
                };
                const phasePlanCtx = buildCoyotePhasePlanValidationContext(roomObjectsByRoom);
                const parsed = parseHypothesisPhasePlanHopOutput(
                    phasePlanHopResult.body,
                    phasePlanCtx,
                    parseOptions
                );
                draft.record = parsed.record;
                draft.phasePlanJson = parsed.phasePlanJson;
                draft.phasePlanValidationReason = parsed.phasePlanValidationReason;
                if (
                    phasePlanHopResult.reasoningContent !== undefined &&
                    phasePlanHopResult.reasoningContent.length > 0
                ) {
                    draft.stageTwoReasoningContent = phasePlanHopResult.reasoningContent;
                }
            },
        }),
    ];
}

function pipelineFailureToStubResult(
    failure: PipelineRunFailure<CoyoteHypothesisPipelineState>
): GenerateHypothesisPipelineResult | null {
    const { state, error } = failure;

    if (!(error instanceof CoyoteHypothesisPipelineAbortError)) {
        return null;
    }

    const stageOneResult = state.stageOneResult;
    if (stageOneResult === undefined) {
        return null;
    }

    return {
        record: { intent: 'Hypothesis: Stubbed' },
        stageOneResult,
        planSelectionResult: state.planSelectionResult !== undefined ? state.planSelectionResult : null,
        phasePlanHopResult: state.phasePlanHopResult !== undefined ? state.phasePlanHopResult : null,
        ...(state.selectionBody !== undefined ? { selectionBody: state.selectionBody } : {}),
        ...(state.phasePlanJson !== undefined ? { phasePlanJson: state.phasePlanJson } : {}),
        ...(state.phasePlanValidationReason !== undefined
            ? { phasePlanValidationReason: state.phasePlanValidationReason }
            : {}),
    };
}

function pipelineSuccessToResult(
    state: CoyoteHypothesisPipelineState
): GenerateHypothesisPipelineResult {
    const stageOneResult = state.stageOneResult;
    const planSelectionResult = state.planSelectionResult;
    const phasePlanHopResult = state.phasePlanHopResult;
    const record = state.record;

    if (
        !stageOneResult ||
        planSelectionResult === undefined ||
        phasePlanHopResult === undefined ||
        phasePlanHopResult === null ||
        !record
    ) {
        throw new Error('CoyoteHypothesisPipeline: incomplete success state');
    }

    return {
        record,
        stageOneResult,
        planSelectionResult,
        phasePlanHopResult,
        ...(state.selectionBody !== undefined ? { selectionBody: state.selectionBody } : {}),
        ...(state.phasePlanJson !== undefined ? { phasePlanJson: state.phasePlanJson } : {}),
        ...(state.phasePlanValidationReason !== undefined
            ? { phasePlanValidationReason: state.phasePlanValidationReason }
            : {}),
        ...(state.stageTwoReasoningContent !== undefined && state.stageTwoReasoningContent.length > 0
            ? { stageTwoReasoningContent: state.stageTwoReasoningContent }
            : {}),
    };
}

export function mapPipelineRunToGenerateHypothesisResult(
    result: PipelineRunResult<CoyoteHypothesisPipelineState>
): GenerateHypothesisPipelineResult {
    if (result.ok) {
        return pipelineSuccessToResult(result.state);
    }

    const stub = pipelineFailureToStubResult(result);
    if (stub !== null) {
        return stub;
    }

    throw result.error;
}

export async function runCoyoteHypothesisPipeline(
    deps: GenerateHypothesisDeps
): Promise<GenerateHypothesisPipelineResult> {
    const ctx = createPipelineContext<CoyoteHypothesisPipelineState>();
    const steps = buildCoyoteHypothesisSteps(ctx, deps);
    const runResult = await ctx.runPipeline({}, steps);
    return mapPipelineRunToGenerateHypothesisResult(runResult);
}
