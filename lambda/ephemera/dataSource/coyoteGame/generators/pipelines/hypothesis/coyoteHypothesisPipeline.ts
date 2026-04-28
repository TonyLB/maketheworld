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
import type { CoyoteHarnessPhasePlanInject, CoyoteHarnessPlanSelectInject } from './coyoteHarnessInjectTypes';
import { parseHop1HandoffFromSelectionBody, type CoyoteHop1Handoff } from './coyoteHop1Handoff';
import { buildCoyotePhasePlanValidationContext } from './coyoteHypothesisPhasePlanContext';
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot';
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
import { hypothesisDebugLog } from '../../../utilities/hypothesisDebug';

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

/** Phase alias aligned with slash / harness (`testOnly`). */
export type CoyoteHypothesisTestPhase = 'clustering' | 'planSelect' | 'phasePlan';

/** Harness-only: prefix run vs isolated single LLM hop. */
export type CoyoteHypothesisHarnessRunKind = 'runUntil' | 'runOnly';

export type CoyoteHypothesisPipelineHarnessOptions = {
    testOnly: CoyoteHypothesisTestPhase;
    harnessRunKind: CoyoteHypothesisHarnessRunKind;
    /** Required for **`runOnly`** **`planSelect`** / **`phasePlan`**; omit for **`runUntil`** and **`runOnly`** **`clustering`**. */
    injectState?: Partial<CoyoteHypothesisPipelineState>;
};

/** Shared payload fields on full completion (successful parse of phase-plan hop). */
type GenerateHypothesisPipelineOkFields = {
    record: CoyoteGameIntentRecord;
    stageOneResult: InvokeBedrockHypothesisResult;
    planSelectionResult: InvokeBedrockHypothesisResult;
    phasePlanHopResult: InvokeBedrockHypothesisResult;
    selectionBody?: string;
    phasePlanJson?: string;
    phasePlanValidationReason?: string;
    stageTwoReasoningContent?: string;
};

export type GenerateHypothesisPipelineFullResult = { kind: 'full' } & GenerateHypothesisPipelineOkFields;

export type GenerateHypothesisPipelineHarnessPartialResult = {
    kind: 'harnessPartial';
    testOnly: CoyoteHypothesisTestPhase;
    harnessRunKind: CoyoteHypothesisHarnessRunKind;
    record: CoyoteGameIntentRecord;
    stageOneResult?: InvokeBedrockHypothesisResult;
    planSelectionResult?: InvokeBedrockHypothesisResult | null;
    phasePlanHopResult?: InvokeBedrockHypothesisResult | null;
    selectionBody?: string;
    phasePlanJson?: string;
    phasePlanValidationReason?: string;
    stageTwoReasoningContent?: string;
};

export type GenerateHypothesisPipelineStubResult = {
    kind: 'stub';
    record: CoyoteGameIntentRecord;
    stageOneResult: InvokeBedrockHypothesisResult;
    planSelectionResult: InvokeBedrockHypothesisResult | null;
    phasePlanHopResult: InvokeBedrockHypothesisResult | null;
    selectionBody?: string;
    phasePlanJson?: string;
    phasePlanValidationReason?: string;
};

export type GenerateHypothesisPipelineResult =
    | GenerateHypothesisPipelineFullResult
    | GenerateHypothesisPipelineHarnessPartialResult
    | GenerateHypothesisPipelineStubResult;

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

function summarizeInvokeResult(result: InvokeBedrockHypothesisResult): Record<string, unknown> {
    return {
        success: result.success,
        bodyLength: result.success ? result.body.length : undefined,
        usage: result.success ? result.usage : undefined,
        errorMessage: result.success ? undefined : result.errorMessage,
    };
}

function errorDetails(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
        return { errorName: error.name, errorMessage: error.message };
    }
    return { errorName: typeof error, errorMessage: String(error) };
}

function assertRunOnlyInjectPlanSelect(
    inject: Partial<CoyoteHypothesisPipelineState> | undefined
): CoyoteHarnessPlanSelectInject {
    const roomObjectsByRoom = inject?.roomObjectsByRoom;
    const combinedMarkdown = inject?.combinedMarkdown;
    if (!roomObjectsByRoom || combinedMarkdown === undefined) {
        throw new Error(
            'CoyoteHypothesisPipeline: runOnly planSelect requires injectState with roomObjectsByRoom and combinedMarkdown'
        );
    }
    return { roomObjectsByRoom, combinedMarkdown };
}

function assertRunOnlyInjectPhasePlan(
    inject: Partial<CoyoteHypothesisPipelineState> | undefined
): CoyoteHarnessPhasePlanInject {
    const base = assertRunOnlyInjectPlanSelect(inject);
    const hop1Handoff = inject?.hop1Handoff;
    if (!hop1Handoff) {
        throw new Error(
            'CoyoteHypothesisPipeline: runOnly phasePlan requires injectState with hop1Handoff, roomObjectsByRoom, and combinedMarkdown'
        );
    }
    return { ...base, hop1Handoff };
}

export function validateCoyoteHypothesisHarnessOptions(options: CoyoteHypothesisPipelineHarnessOptions): void {
    const { testOnly, harnessRunKind, injectState } = options;
    if (harnessRunKind === 'runOnly') {
        if (testOnly === 'planSelect') {
            assertRunOnlyInjectPlanSelect(injectState);
            return;
        }
        if (testOnly === 'phasePlan') {
            assertRunOnlyInjectPhasePlan(injectState);
            return;
        }
        if (injectState !== undefined && Object.keys(injectState).length > 0) {
            throw new Error(
                'CoyoteHypothesisPipeline: runOnly clustering does not accept injectState; use roomObjectsByRoomOverride on deps'
            );
        }
        return;
    }
    if (injectState !== undefined && Object.keys(injectState).length > 0) {
        throw new Error('CoyoteHypothesisPipeline: injectState is only valid for harnessRunKind runOnly planSelect / phasePlan');
    }
}

/** Indices match [`buildCoyoteHypothesisSteps`] order. */
const RUN_UNTIL_LAST_STEP_INDEX: Record<CoyoteHypothesisTestPhase, number> = {
    clustering: 1,
    planSelect: 3,
    phasePlan: 5,
};

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
                hypothesisDebugLog('stage one invoke complete', summarizeInvokeResult(stageOneResult));
                if (!stageOneResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'stageOneInvokeFailed' });
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
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'stageOneParseFailed',
                        parseErrorMessage: seamParsed.errorMessage,
                    });
                    abort();
                }
                const combinedResult = combineHypothesisClusters(
                    seamParsed.candidates,
                    roomObjectsByRoom
                );
                if (!combinedResult.ok) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'combineFailed',
                        combineErrorMessage: combinedResult.errorMessage,
                    });
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
                hypothesisDebugLog('plan selection invoke complete', summarizeInvokeResult(planSelectionResult));
                if (!planSelectionResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'planSelectionInvokeFailed' });
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
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'planSelectionHandoffParseFailed',
                        parseReason: handoff.reason,
                    });
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
                hypothesisDebugLog('phase plan hop invoke complete', summarizeInvokeResult(phasePlanHopResult));
                if (!phasePlanHopResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'phasePlanInvokeFailed' });
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
                hypothesisDebugLog('phase plan hop parse complete', {
                    intent: parsed.record.intent,
                    hasWalkthrough: parsed.record.walkthrough !== undefined,
                    hasPhasePlan: parsed.record.phasePlan !== undefined,
                    phasePlanValidationReason: parsed.phasePlanValidationReason,
                    phasePlanJsonPresent: parsed.phasePlanJson !== undefined,
                });
            },
        }),
    ];
}

function pipelineFailureToStubResult(
    failure: PipelineRunFailure<CoyoteHypothesisPipelineState>
): GenerateHypothesisPipelineStubResult | null {
    const { state, error } = failure;

    if (!(error instanceof CoyoteHypothesisPipelineAbortError)) {
        return null;
    }

    const stageOneResult = state.stageOneResult;
    if (stageOneResult === undefined) {
        return null;
    }

    return {
        kind: 'stub',
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

function pipelineSuccessToFullResult(state: CoyoteHypothesisPipelineState): GenerateHypothesisPipelineFullResult {
    const stageOneResult = state.stageOneResult;
    const planSelectionResult = state.planSelectionResult;
    const phasePlanHopResult = state.phasePlanHopResult;
    const record = state.record;

    if (
        !stageOneResult ||
        planSelectionResult === undefined ||
        planSelectionResult === null ||
        phasePlanHopResult === undefined ||
        phasePlanHopResult === null ||
        !record
    ) {
        throw new Error('CoyoteHypothesisPipeline: incomplete success state');
    }

    return {
        kind: 'full',
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

function pipelineSuccessToHarnessPartial(
    state: CoyoteHypothesisPipelineState,
    harness: { testOnly: CoyoteHypothesisTestPhase; harnessRunKind: CoyoteHypothesisHarnessRunKind }
): GenerateHypothesisPipelineHarnessPartialResult {
    return {
        kind: 'harnessPartial',
        testOnly: harness.testOnly,
        harnessRunKind: harness.harnessRunKind,
        record: state.record ?? { intent: 'Hypothesis: Stubbed' },
        ...(state.stageOneResult !== undefined ? { stageOneResult: state.stageOneResult } : {}),
        ...(state.planSelectionResult !== undefined ? { planSelectionResult: state.planSelectionResult } : {}),
        ...(state.phasePlanHopResult !== undefined ? { phasePlanHopResult: state.phasePlanHopResult } : {}),
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

export type MapPipelineHarnessContext =
    | { harness: undefined }
    | {
          harness: {
              testOnly: CoyoteHypothesisTestPhase;
              harnessRunKind: CoyoteHypothesisHarnessRunKind;
          };
      };

export function mapPipelineRunToGenerateHypothesisResult(
    result: PipelineRunResult<CoyoteHypothesisPipelineState>,
    context: MapPipelineHarnessContext = { harness: undefined }
): GenerateHypothesisPipelineResult {
    if (result.ok) {
        hypothesisDebugLog('pipeline mapper: success result', {
            hasRecord: result.state.record !== undefined,
            intent: result.state.record?.intent,
            hasWalkthrough: result.state.record?.walkthrough !== undefined,
            hasPhasePlan: result.state.record?.phasePlan !== undefined,
        });
        if (context.harness !== undefined) {
            return pipelineSuccessToHarnessPartial(result.state, context.harness);
        }
        return pipelineSuccessToFullResult(result.state);
    }

    const stub = pipelineFailureToStubResult(result);
    if (stub !== null) {
        hypothesisDebugLog('pipeline mapper: abort fallback to stub', {
            failedStepName: result.failedStepName,
            failedStepIndex: result.failedStepIndex,
            ...errorDetails(result.error),
        });
        return stub;
    }

    hypothesisDebugLog('pipeline mapper: rethrowing non-abort error', {
        failedStepName: result.failedStepName,
        failedStepIndex: result.failedStepIndex,
        ...errorDetails(result.error),
    });
    throw result.error;
}

function initialStateForRunOnly(
    testOnly: CoyoteHypothesisTestPhase,
    injectState: Partial<CoyoteHypothesisPipelineState> | undefined
): CoyoteHypothesisPipelineState {
    if (testOnly === 'clustering') {
        return {};
    }
    if (testOnly === 'planSelect') {
        const inject = assertRunOnlyInjectPlanSelect(injectState);
        return {
            roomObjectsByRoom: inject.roomObjectsByRoom,
            combinedMarkdown: inject.combinedMarkdown,
        };
    }
    const inject = assertRunOnlyInjectPhasePlan(injectState);
    return {
        roomObjectsByRoom: inject.roomObjectsByRoom,
        combinedMarkdown: inject.combinedMarkdown,
        hop1Handoff: inject.hop1Handoff,
    };
}

function selectHarnessSteps(
    allSteps: PipelineStep<CoyoteHypothesisPipelineState>[],
    harness: CoyoteHypothesisPipelineHarnessOptions
): PipelineStep<CoyoteHypothesisPipelineState>[] {
    const { testOnly, harnessRunKind } = harness;
    if (harnessRunKind === 'runUntil') {
        const last = RUN_UNTIL_LAST_STEP_INDEX[testOnly];
        return allSteps.slice(0, last + 1);
    }
    if (testOnly === 'clustering') {
        return allSteps.slice(0, 2);
    }
    if (testOnly === 'planSelect') {
        return [allSteps[3]];
    }
    return [allSteps[5]];
}

export async function runCoyoteHypothesisPipeline(
    deps: GenerateHypothesisDeps,
    harnessOptions?: CoyoteHypothesisPipelineHarnessOptions
): Promise<GenerateHypothesisPipelineResult> {
    const ctx = createPipelineContext<CoyoteHypothesisPipelineState>();
    const allSteps = buildCoyoteHypothesisSteps(ctx, deps);

    let initialState: CoyoteHypothesisPipelineState = {};
    let steps = allSteps;
    let mapContext: MapPipelineHarnessContext = { harness: undefined };

    if (harnessOptions !== undefined) {
        validateCoyoteHypothesisHarnessOptions(harnessOptions);
        mapContext = {
            harness: {
                testOnly: harnessOptions.testOnly,
                harnessRunKind: harnessOptions.harnessRunKind,
            },
        };
        steps = selectHarnessSteps(allSteps, harnessOptions);
        if (harnessOptions.harnessRunKind === 'runOnly') {
            initialState = initialStateForRunOnly(harnessOptions.testOnly, harnessOptions.injectState);
        }
    }

    const runResult = await ctx.runPipeline(initialState, steps, {
        onStepStart: (stepName, stepIndex) => {
            hypothesisDebugLog('pipeline step start', { stepName, stepIndex });
        },
        onStepEnd: (stepName, stepIndex) => {
            hypothesisDebugLog('pipeline step end', { stepName, stepIndex });
        },
    });
    if (runResult.ok) {
        hypothesisDebugLog('pipeline run complete', { ok: true });
    } else {
        hypothesisDebugLog('pipeline run complete', {
            ok: false,
            failedStepName: runResult.failedStepName,
            failedStepIndex: runResult.failedStepIndex,
            ...errorDetails(runResult.error),
        });
    }
    return mapPipelineRunToGenerateHypothesisResult(runResult, mapContext);
}
