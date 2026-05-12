import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta';

import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame';
import {
    createPipelineContext,
    type PipelineRunFailure,
    type PipelineRunResult,
    type PipelineStep,
} from '../../../../../llm/pipeline';

import {
    buildNarrativeBeatPrompt,
    type PlanSelectOutputWithWinner,
} from './narrativeBeats/buildNarrativeBeatPrompt';
import { buildPlanSelectPrompt } from './planSelect/buildPlanSelectPrompt';
import { buildCandidatePrompt } from './candidates/buildCandidatePrompt';
import {
    combineCandidateOutput,
    planSelectOutliersForCandidate,
    type CombineCandidateOutputReturn,
} from './candidates/combineCandidateOutput';
import type { CoyoteHarnessNarrativeBeatsInject, CoyoteHarnessPlanSelectInject } from './coyoteHarnessInjectTypes';
import { parsePlanSelectOutput, type PlanSelectOutput } from './planSelect/parsePlanSelectOutput';
import { buildNarrativeBeatValidationContext } from './narrativeBeats/narrativeBeatValidationContext';
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot';
import {
    invokeBedrockHypothesisNarrativeBeat,
    invokeBedrockHypothesisPlanSelection,
    invokeBedrockHypothesisStageOne,
    type InvokeBedrockHypothesisResult,
} from './invokeBedrockHypothesis';
import {
    parseNarrativeBeatOutput,
    type ParseHypothesisModelOutputOptions,
} from '../../sharedParsers/parseHypothesisModelOutput';
import { parseCandidateOutput } from './candidates/parseCandidateOutput';
import { hypothesisDebugLog } from '../../../utilities/hypothesisDebug';

/**
 * Failure policy: Bedrock failure on Stage One, plan-selection hop, or narrative beat hop; invalid seam / combine;
 * or planSelect output parse failure yields stub intent only --- no partial hypothesis to players.
 * Hop-2 narrative-beats JSON validation failure does **not** abort when prose Hypothesis still parses (**Decided: structured validation failure**).
 */

export type GenerateHypothesisDeps = {
    getGameRooms: () => Promise<string[]>;
    getRoomMeta: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom;
};

/** Phase alias aligned with slash / harness (`testOnly`). */
export type CoyoteHypothesisTestPhase = 'candidates' | 'planSelect' | 'narrativeBeats';

/** Harness-only: prefix run vs isolated single LLM hop. */
export type CoyoteHypothesisHarnessRunKind = 'runUntil' | 'runOnly';

export type CoyoteHypothesisPipelineHarnessOptions = {
    testOnly: CoyoteHypothesisTestPhase;
    harnessRunKind: CoyoteHypothesisHarnessRunKind;
    /** Required for **`runOnly`** **`planSelect`** / **`narrativeBeats`**; omit for **`runUntil`** and **`runOnly`** **`candidates`**. */
    injectState?: Partial<CoyoteHypothesisPipelineState>;
};

/** Shared payload fields on full completion (successful parse of narrative beat output). */
type GenerateHypothesisPipelineOkFields = {
    record: CoyoteGameIntentRecord;
    stageOneResult: InvokeBedrockHypothesisResult;
    planSelectionResult: InvokeBedrockHypothesisResult;
    narrativeBeatResult: InvokeBedrockHypothesisResult;
    selectionBody?: string;
    narrativeBeatsStructuredJson?: string;
    narrativeBeatsStructuredValidationReason?: string;
    narrativeBeatReasoningContent?: string;
};

export type GenerateHypothesisPipelineFullResult = { kind: 'full' } & GenerateHypothesisPipelineOkFields;

export type GenerateHypothesisPipelineHarnessPartialResult = {
    kind: 'harnessPartial';
    testOnly: CoyoteHypothesisTestPhase;
    harnessRunKind: CoyoteHypothesisHarnessRunKind;
    record: CoyoteGameIntentRecord;
    stageOneResult?: InvokeBedrockHypothesisResult;
    planSelectionResult?: InvokeBedrockHypothesisResult | null;
    narrativeBeatResult?: InvokeBedrockHypothesisResult | null;
    selectionBody?: string;
    narrativeBeatsStructuredJson?: string;
    narrativeBeatsStructuredValidationReason?: string;
    narrativeBeatReasoningContent?: string;
};

export type GenerateHypothesisPipelineStubResult = {
    kind: 'stub';
    record: CoyoteGameIntentRecord;
    stageOneResult: InvokeBedrockHypothesisResult;
    planSelectionResult: InvokeBedrockHypothesisResult | null;
    narrativeBeatResult: InvokeBedrockHypothesisResult | null;
    selectionBody?: string;
    narrativeBeatsStructuredJson?: string;
    narrativeBeatsStructuredValidationReason?: string;
};

export type GenerateHypothesisPipelineResult =
    | GenerateHypothesisPipelineFullResult
    | GenerateHypothesisPipelineHarnessPartialResult
    | GenerateHypothesisPipelineStubResult;

export type CoyoteHypothesisPipelineState = {
    roomObjectsByRoom?: CoyoteRoomObjectsByRoom;
    /** Combined trope candidates after {@link combineCandidateOutput} (plan-select JSON input; outlier rehydration for {@link parsePlanSelectionHandoff}). */
    combined?: CombineCandidateOutputReturn;
    stageOneResult?: InvokeBedrockHypothesisResult;
    planSelectionResult?: InvokeBedrockHypothesisResult | null;
    narrativeBeatResult?: InvokeBedrockHypothesisResult | null;
    planSelectOutput?: PlanSelectOutput;
    selectionBody?: string;
    narrativeBeatsStructuredJson?: string;
    narrativeBeatsStructuredValidationReason?: string;
    record?: CoyoteGameIntentRecord;
    narrativeBeatReasoningContent?: string;
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
    const combined = inject?.combined;
    if (!roomObjectsByRoom || combined === undefined) {
        throw new Error(
            'CoyoteHypothesisPipeline: runOnly planSelect requires injectState with roomObjectsByRoom and combined'
        );
    }
    return { roomObjectsByRoom, combined };
}

function assertRunOnlyInjectPhasePlan(
    inject: Partial<CoyoteHypothesisPipelineState> | undefined
): CoyoteHarnessNarrativeBeatsInject {
    const roomObjectsByRoom = inject?.roomObjectsByRoom;
    const planSelectOutput = inject?.planSelectOutput;
    if (!roomObjectsByRoom || !planSelectOutput) {
        throw new Error(
            'CoyoteHypothesisPipeline: runOnly narrativeBeats requires injectState with roomObjectsByRoom and planSelectOutput'
        );
    }
    if (!planSelectOutput.selectedCandidate) {
        throw new Error(
            'CoyoteHypothesisPipeline: runOnly narrativeBeats requires planSelectOutput.selectedCandidate'
        );
    }
    return { roomObjectsByRoom, planSelectOutput: planSelectOutput as PlanSelectOutputWithWinner };
}

export function validateCoyoteHypothesisHarnessOptions(options: CoyoteHypothesisPipelineHarnessOptions): void {
    const { testOnly, harnessRunKind, injectState } = options;
    if (harnessRunKind === 'runOnly') {
        if (testOnly === 'planSelect') {
            assertRunOnlyInjectPlanSelect(injectState);
            return;
        }
        if (testOnly === 'narrativeBeats') {
            assertRunOnlyInjectPhasePlan(injectState);
            return;
        }
        if (injectState !== undefined && Object.keys(injectState).length > 0) {
            throw new Error(
                'CoyoteHypothesisPipeline: runOnly candidates does not accept injectState; use roomObjectsByRoomOverride on deps'
            );
        }
        return;
    }
    if (injectState !== undefined && Object.keys(injectState).length > 0) {
        throw new Error('CoyoteHypothesisPipeline: injectState is only valid for harnessRunKind runOnly planSelect / narrativeBeats');
    }
}

/** Indices match [`buildCoyoteHypothesisSteps`] order. */
const RUN_UNTIL_LAST_STEP_INDEX: Record<CoyoteHypothesisTestPhase, number> = {
    candidates: 1,
    planSelect: 3,
    /** Includes {@link parseNarrativeBeatRecord} after {@link hypothesisNarrativeBeatLlm}. */
    narrativeBeats: 6,
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
            name: 'hypothesisCandidatesLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                if (!roomObjectsByRoom) {
                    throw new Error('CoyoteHypothesisPipeline: missing roomObjectsByRoom');
                }
                const stageOneParts = buildCandidatePrompt({ roomObjectsByRoom });
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
                const seamParsed = parseCandidateOutput(stageOneResult.body, roomObjectsByRoom);
                if (!seamParsed.ok) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'stageOneParseFailed',
                        parseErrorMessage: seamParsed.errorMessage,
                    });
                    abort();
                }
                const combinedResult = combineCandidateOutput(
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
                draft.combined = combinedResult.combined;
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisPlanSelectionLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const combined = draft.combined;
                if (!roomObjectsByRoom || combined === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisPlanSelectionLlm preconditions');
                }
                const parts = buildPlanSelectPrompt({
                    roomObjectsByRoom,
                    combined,
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
                const combined = draft.combined;
                if (!planSelectionResult?.success || !roomObjectsByRoom || combined === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: parsePlanSelectionHandoff preconditions');
                }
                draft.selectionBody = planSelectionResult.body;
                const handoff = parsePlanSelectOutput(planSelectionResult.body);
                if (!handoff.ok) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'planSelectionHandoffParseFailed',
                        parseReason: handoff.reason,
                    });
                    abort();
                }
                let planSelectOutput = handoff.handoff;
                const selected = planSelectOutput.selectedCandidate;
                if (selected) {
                    const matched = combined.candidates.find((c) => c.candidateId === selected.candidateId);
                    if (matched) {
                        if (
                            selected.gimmick !== undefined
                            && selected.gimmick !== matched.gimmick
                        ) {
                            hypothesisDebugLog('planSelect selectedCandidate gimmick normalized from combine', {
                                candidateId: selected.candidateId,
                                modelGimmick: selected.gimmick,
                                canonicalGimmick: matched.gimmick,
                            });
                        }
                        planSelectOutput = {
                            ...planSelectOutput,
                            selectedCandidate: {
                                ...selected,
                                gimmick: matched.gimmick,
                                outliers: planSelectOutliersForCandidate(matched, roomObjectsByRoom),
                            },
                        };
                    }
                }
                draft.planSelectOutput = planSelectOutput;
                if (!planSelectOutput.selectedCandidate) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'planSelectionMissingSelectedCandidate',
                    });
                    abort();
                }
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisNarrativeBeatLlm',
            run: async (draft) => {
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                const handoff = draft.planSelectOutput;
                if (!roomObjectsByRoom || !handoff?.selectedCandidate) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisNarrativeBeatLlm preconditions');
                }
                const parts = buildNarrativeBeatPrompt({
                    roomObjectsByRoom,
                    planSelectOutput: handoff as PlanSelectOutputWithWinner,
                });
                const narrativeBeatResult = await invokeBedrockHypothesisNarrativeBeat(parts);
                draft.narrativeBeatResult = narrativeBeatResult;
                hypothesisDebugLog('narrative beat invoke complete', summarizeInvokeResult(narrativeBeatResult));
                if (!narrativeBeatResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'narrativeBeatInvokeFailed' });
                    abort();
                }
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'parseNarrativeBeatRecord',
            run: async (draft) => {
                const narrativeBeatResult = draft.narrativeBeatResult;
                const roomObjectsByRoom = draft.roomObjectsByRoom;
                if (!narrativeBeatResult?.success || !roomObjectsByRoom) {
                    throw new Error('CoyoteHypothesisPipeline: parseNarrativeBeatRecord preconditions');
                }
                const parseOptions: ParseHypothesisModelOutputOptions = {
                    reasoningContentProvided: Boolean(narrativeBeatResult.reasoningContent),
                };
                const narrativeBeatsCtx = buildNarrativeBeatValidationContext(roomObjectsByRoom);
                const parsed = parseNarrativeBeatOutput(
                    narrativeBeatResult.body,
                    narrativeBeatsCtx,
                    parseOptions
                );
                draft.record = parsed.record;
                draft.narrativeBeatsStructuredJson = parsed.narrativeBeatsStructuredJson;
                draft.narrativeBeatsStructuredValidationReason = parsed.narrativeBeatsStructuredValidationReason;
                if (
                    narrativeBeatResult.reasoningContent !== undefined &&
                    narrativeBeatResult.reasoningContent.length > 0
                ) {
                    draft.narrativeBeatReasoningContent = narrativeBeatResult.reasoningContent;
                }
                hypothesisDebugLog('narrative beat parse complete', {
                    intent: parsed.record.intent,
                    hasWalkthrough: parsed.record.walkthrough !== undefined,
                    hasNarrativeBeatsStructured: parsed.record.narrativeBeatsStructured !== undefined,
                    narrativeBeatsStructuredValidationReason: parsed.narrativeBeatsStructuredValidationReason,
                    narrativeBeatsStructuredJsonPresent: parsed.narrativeBeatsStructuredJson !== undefined,
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
        record: { intent: 'Hypothesis: Something went wrong' },
        stageOneResult,
        planSelectionResult: state.planSelectionResult !== undefined ? state.planSelectionResult : null,
        narrativeBeatResult: state.narrativeBeatResult !== undefined ? state.narrativeBeatResult : null,
        ...(state.selectionBody !== undefined ? { selectionBody: state.selectionBody } : {}),
        ...(state.narrativeBeatsStructuredJson !== undefined
            ? { narrativeBeatsStructuredJson: state.narrativeBeatsStructuredJson }
            : {}),
        ...(state.narrativeBeatsStructuredValidationReason !== undefined
            ? { narrativeBeatsStructuredValidationReason: state.narrativeBeatsStructuredValidationReason }
            : {}),
    };
}

function pipelineSuccessToFullResult(state: CoyoteHypothesisPipelineState): GenerateHypothesisPipelineFullResult {
    const stageOneResult = state.stageOneResult;
    const planSelectionResult = state.planSelectionResult;
    const narrativeBeatResult = state.narrativeBeatResult;
    const record = state.record;

    if (
        !stageOneResult ||
        planSelectionResult === undefined ||
        planSelectionResult === null ||
        narrativeBeatResult === undefined ||
        narrativeBeatResult === null ||
        !record
    ) {
        throw new Error('CoyoteHypothesisPipeline: incomplete success state');
    }

    return {
        kind: 'full',
        record,
        stageOneResult,
        planSelectionResult,
        narrativeBeatResult,
        ...(state.selectionBody !== undefined ? { selectionBody: state.selectionBody } : {}),
        ...(state.narrativeBeatsStructuredJson !== undefined
            ? { narrativeBeatsStructuredJson: state.narrativeBeatsStructuredJson }
            : {}),
        ...(state.narrativeBeatsStructuredValidationReason !== undefined
            ? { narrativeBeatsStructuredValidationReason: state.narrativeBeatsStructuredValidationReason }
            : {}),
        ...(state.narrativeBeatReasoningContent !== undefined && state.narrativeBeatReasoningContent.length > 0
            ? { narrativeBeatReasoningContent: state.narrativeBeatReasoningContent }
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
        record: state.record ?? { intent: 'Hypothesis: Something went wrong' },
        ...(state.stageOneResult !== undefined ? { stageOneResult: state.stageOneResult } : {}),
        ...(state.planSelectionResult !== undefined ? { planSelectionResult: state.planSelectionResult } : {}),
        ...(state.narrativeBeatResult !== undefined ? { narrativeBeatResult: state.narrativeBeatResult } : {}),
        ...(state.selectionBody !== undefined ? { selectionBody: state.selectionBody } : {}),
        ...(state.narrativeBeatsStructuredJson !== undefined
            ? { narrativeBeatsStructuredJson: state.narrativeBeatsStructuredJson }
            : {}),
        ...(state.narrativeBeatsStructuredValidationReason !== undefined
            ? { narrativeBeatsStructuredValidationReason: state.narrativeBeatsStructuredValidationReason }
            : {}),
        ...(state.narrativeBeatReasoningContent !== undefined && state.narrativeBeatReasoningContent.length > 0
            ? { narrativeBeatReasoningContent: state.narrativeBeatReasoningContent }
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
            hasNarrativeBeatsStructured: result.state.record?.narrativeBeatsStructured !== undefined,
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
    if (testOnly === 'candidates') {
        return {};
    }
    if (testOnly === 'planSelect') {
        const inject = assertRunOnlyInjectPlanSelect(injectState);
        return {
            roomObjectsByRoom: inject.roomObjectsByRoom,
            combined: inject.combined,
        };
    }
    const inject = assertRunOnlyInjectPhasePlan(injectState);
    return {
        roomObjectsByRoom: inject.roomObjectsByRoom,
        planSelectOutput: inject.planSelectOutput,
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
    if (testOnly === 'candidates') {
        return allSteps.slice(0, 2);
    }
    if (testOnly === 'planSelect') {
        return [allSteps[3]];
    }
    /** Narrative beat LLM plus parse into intent / narrative-beats structured JSON (same slice tail as `runUntil` for this phase). */
    return [allSteps[5], allSteps[6]];
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
