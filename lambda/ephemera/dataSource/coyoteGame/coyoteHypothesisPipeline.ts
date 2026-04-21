import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta';

import type { CoyoteGameIntentRecord } from '../../internalCache/coyoteGame';
import {
    createPipelineContext,
    type PipelineRunFailure,
    type PipelineRunResult,
    type PipelineStep,
} from '../../llm/pipeline';

import { buildHypothesisStageOnePromptParts } from './buildHypothesisStageOnePrompt';
import { buildHypothesisStageTwoPromptParts } from './buildHypothesisStageTwoPrompt';
import {
    combineHypothesisClusters,
    renderCombinedHypothesisForStageTwo,
} from './combineHypothesisClusters';
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectsByRoom } from './coyoteRoomObjectSnapshot';
import {
    invokeBedrockHypothesisStageOne,
    invokeBedrockHypothesisStageTwo,
    type InvokeBedrockHypothesisResult,
} from './invokeBedrockHypothesis';
import { parseHypothesisModelOutput, type ParseHypothesisModelOutputOptions } from './parseHypothesisModelOutput';
import { parseHypothesisStageOneOutput } from './parseHypothesisStageOneOutput';

/** Failure policy (two-round pipeline): any stage-1/stage-2 Bedrock failure, invalid seam, or combine failure yields stub intent only — no partial hypothesis to players. */

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>;
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom;
};

export type GenerateHypothesisPipelineResult = {
    record: CoyoteGameIntentRecord;
    stageOneResult: InvokeBedrockHypothesisResult;
    stageTwoResult: InvokeBedrockHypothesisResult | null;
    /** Stage Two extended-reasoning text when Bedrock returned it (not stored on CoyoteGameIntentRecord). */
    stageTwoReasoningContent?: string;
};

export type CoyoteHypothesisPipelineState = {
    roomObjectsByRoom?: CoyoteRoomObjectsByRoom;
    combinedMarkdown?: string;
    stageOneResult?: InvokeBedrockHypothesisResult;
    stageTwoResult?: InvokeBedrockHypothesisResult | null;
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
            name: 'hypothesisStageTwoLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const combinedMarkdown = draft.combinedMarkdown;
                if (!roomObjectsByRoom || combinedMarkdown === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisStageTwoLlm preconditions');
                }
                const stageTwoParts = buildHypothesisStageTwoPromptParts({
                    roomObjectsByRoom,
                    combinedMarkdown,
                });
                const stageTwoResult = await invokeBedrockHypothesisStageTwo(stageTwoParts);
                draft.stageTwoResult = stageTwoResult;
                if (!stageTwoResult.success) {
                    abort();
                }
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'parseStageTwoRecord',
            run: async (draft) => {
                const stageTwoResult = draft.stageTwoResult;
                if (!stageTwoResult?.success) {
                    throw new Error('CoyoteHypothesisPipeline: parseStageTwoRecord preconditions');
                }
                const parseOptions: ParseHypothesisModelOutputOptions = {
                    reasoningContentProvided: Boolean(stageTwoResult.reasoningContent),
                };
                draft.record = parseHypothesisModelOutput(stageTwoResult.body, parseOptions);
                if (
                    stageTwoResult.reasoningContent !== undefined &&
                    stageTwoResult.reasoningContent.length > 0
                ) {
                    draft.stageTwoReasoningContent = stageTwoResult.reasoningContent;
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
        stageTwoResult: state.stageTwoResult !== undefined ? state.stageTwoResult : null,
    };
}

function pipelineSuccessToResult(
    state: CoyoteHypothesisPipelineState
): GenerateHypothesisPipelineResult {
    const stageOneResult = state.stageOneResult;
    const stageTwoResult = state.stageTwoResult;
    const record = state.record;

    if (!stageOneResult || stageTwoResult === undefined || stageTwoResult === null || !record) {
        throw new Error('CoyoteHypothesisPipeline: incomplete success state');
    }

    return {
        record,
        stageOneResult,
        stageTwoResult,
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
