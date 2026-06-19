import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses';
import type { ThinkingSegment } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking';

import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame';
import type { MessageBus } from '../../../../../messageBus/baseClasses';

/** Deferred require breaks internalCache -> generateHypothesis -> messageBus init cycle. */
const getDefaultMessageBus = (): Pick<MessageBus, 'publish'> =>
    require('../../../../../messageBus').default as MessageBus
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
import type { BuildHypothesisPromptInput, CoyotePromptParts } from './promptTypes';
import {
    combineCandidateOutput,
    planSelectOutliersForCandidate,
    type CombineCandidateOutputReturn,
} from './candidates/combineCandidateOutput';
import type { CoyoteHarnessNarrativeBeatsInject, CoyoteHarnessPlanSelectInject } from './coyoteHarnessInjectTypes';
import { parsePlanSelectOutput, type PlanSelectOutput } from './planSelect/parsePlanSelectOutput';
import { buildNarrativeBeatValidationContext } from './narrativeBeats/narrativeBeatValidationContext';
import { loadCoyoteRoomObjectsByRoom, type CoyoteRoomObjectSnapshotDeps, type CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot';
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
import { tropeSequenceFromAssignments } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan';
import { parseCandidateOutput, truncateCoyoteGimmickEcho } from './candidates/parseCandidateOutput';
import { hypothesisDebugLog } from '../../../utilities/hypothesisDebug';
import {
    activeThinkingSegmentsForRun,
    bootstrapHypothesisThinkingAtRunStart,
    buildCandidatesThinkingResultVerbose,
    buildNarrativeBeatsThinkingResultVerbose,
    buildPlanSelectThinkingResultVerbose,
    emitHypothesisThinkingResult,
    finalizeHypothesisThinkingOnRunFailure,
    type HypothesisThinkingHarnessOptions,
} from './hypothesisThinkingPersistence';

/**
 * Failure policy: Bedrock failure on Stage One, plan-selection hop, or narrative beat hop; invalid seam / combine;
 * or planSelect output parse failure yields stub intent only --- no partial hypothesis to players.
 * Hop-2 narrative-beats JSON validation failure does **not** abort when prose Hypothesis still parses (**Decided: structured validation failure**).
 */

export type GenerateHypothesisDeps = CoyoteRoomObjectSnapshotDeps & {
    roomObjectsByRoomOverride?: CoyoteRoomObjectsByRoom;
    messageBus?: Pick<MessageBus, 'publish'>;
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
    stageOnePromptParts?: CoyotePromptParts;
    planSelectPromptParts?: CoyotePromptParts;
    narrativeBeatPromptParts?: CoyotePromptParts;
    stageOneResult?: InvokeBedrockHypothesisResult;
    planSelectionResult?: InvokeBedrockHypothesisResult | null;
    narrativeBeatResult?: InvokeBedrockHypothesisResult | null;
    planSelectOutput?: PlanSelectOutput;
    selectionBody?: string;
    narrativeBeatsStructuredJson?: string;
    narrativeBeatsStructuredValidationReason?: string;
    record?: CoyoteGameIntentRecord;
    narrativeBeatReasoningContent?: string;
    thinking?: {
        generationId: string;
        workItems: Partial<Record<ThinkingSegment, string>>;
    };
};

const PRODUCT_ABORT_ERROR_MESSAGE = 'CoyoteHypothesisPipelineAbort';

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

/** Indices match [`buildCoyoteHypothesisSteps`] order. End at thinking-result boundaries per segment. */
const RUN_UNTIL_LAST_STEP_INDEX: Record<CoyoteHypothesisTestPhase, number> = {
    /** Through {@link seamCombineRender} (candidates result emit). */
    candidates: 2,
    /** Through {@link parsePlanSelectionHandoff} (planSelect result emit). */
    planSelect: 4,
    /** Includes {@link parseNarrativeBeatRecord} after {@link hypothesisNarrativeBeatLlm}. */
    narrativeBeats: 6,
};

async function emitThinkingResultForSegmentIfActive(
    state: CoyoteHypothesisPipelineState,
    deps: GenerateHypothesisDeps,
    thinkingHarness: HypothesisThinkingHarnessOptions | undefined,
    segment: ThinkingSegment,
    verbose: unknown
): Promise<void> {
    const thinking = state.thinking;
    if (thinking === undefined) {
        return;
    }
    if (!activeThinkingSegmentsForRun(thinkingHarness).includes(segment)) {
        return;
    }
    const bus = deps.messageBus ?? getDefaultMessageBus();
    await emitHypothesisThinkingResult({ messageBus: bus }, thinking, segment, { ok: true, verbose });
}

type HypothesisFewShotOptions = Pick<BuildHypothesisPromptInput, 'includeIconicFewShots'>;

function buildCoyoteHypothesisSteps(
    ctx: ReturnType<typeof createPipelineContext<CoyoteHypothesisPipelineState>>,
    deps: GenerateHypothesisDeps,
    thinkingHarness?: HypothesisThinkingHarnessOptions,
    fewShotOptions?: HypothesisFewShotOptions
): PipelineStep<CoyoteHypothesisPipelineState>[] {
    return [
        ctx.defineOrchestrationStep({
            name: 'loadRoomObjects',
            run: async (state) => {
                const roomObjectsByRoom =
                    deps.roomObjectsByRoomOverride ?? (await loadCoyoteRoomObjectsByRoom(deps));
                return { state: { ...state, roomObjectsByRoom } };
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisCandidatesLlm',
            run: async (state) => {
                const roomObjectsByRoom = state.roomObjectsByRoom;
                if (!roomObjectsByRoom) {
                    throw new Error('CoyoteHypothesisPipeline: missing roomObjectsByRoom');
                }
                const stageOneParts = buildCandidatePrompt({
                    roomObjectsByRoom,
                    includeIconicFewShots: fewShotOptions?.includeIconicFewShots,
                });
                const stageOneResult = await invokeBedrockHypothesisStageOne(stageOneParts);
                const nextState: CoyoteHypothesisPipelineState = {
                    ...state,
                    stageOnePromptParts: stageOneParts,
                    stageOneResult,
                };
                hypothesisDebugLog('stage one invoke complete', summarizeInvokeResult(stageOneResult));
                if (!stageOneResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'stageOneInvokeFailed' });
                    return { state: nextState, abort: true };
                }
                return { state: nextState };
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'seamCombineRender',
            run: async (state) => {
                const roomObjectsByRoom = state.roomObjectsByRoom;
                const stageOneResult = state.stageOneResult;
                if (!roomObjectsByRoom || !stageOneResult?.success) {
                    throw new Error('CoyoteHypothesisPipeline: seamCombineRender preconditions');
                }
                const seamParsed = parseCandidateOutput(stageOneResult.body, roomObjectsByRoom);
                if (!seamParsed.ok) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'stageOneParseFailed',
                        parseErrorMessage: seamParsed.errorMessage,
                    });
                    return { state, abort: true };
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
                    return { state, abort: true };
                }
                const nextState: CoyoteHypothesisPipelineState = {
                    ...state,
                    combined: combinedResult.combined,
                };
                await emitThinkingResultForSegmentIfActive(
                    nextState,
                    deps,
                    thinkingHarness,
                    'candidates',
                    buildCandidatesThinkingResultVerbose({
                        roomObjectsByRoom: nextState.roomObjectsByRoom!,
                        stageOneResult: nextState.stageOneResult!,
                        combined: nextState.combined!,
                        stageOnePromptParts: nextState.stageOnePromptParts,
                    })
                );
                return { state: nextState };
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisPlanSelectionLlm',
            run: async (state) => {
                const roomObjectsByRoom = state.roomObjectsByRoom;
                const combined = state.combined;
                if (!roomObjectsByRoom || combined === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisPlanSelectionLlm preconditions');
                }
                const parts = buildPlanSelectPrompt({
                    roomObjectsByRoom,
                    combined,
                    includeIconicFewShots: fewShotOptions?.includeIconicFewShots,
                });
                const planSelectionResult = await invokeBedrockHypothesisPlanSelection(parts);
                const nextState: CoyoteHypothesisPipelineState = {
                    ...state,
                    planSelectPromptParts: parts,
                    planSelectionResult,
                };
                hypothesisDebugLog('plan selection invoke complete', summarizeInvokeResult(planSelectionResult));
                if (!planSelectionResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'planSelectionInvokeFailed' });
                    return { state: nextState, abort: true };
                }
                return { state: nextState };
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'parsePlanSelectionHandoff',
            run: async (state) => {
                const planSelectionResult = state.planSelectionResult;
                const roomObjectsByRoom = state.roomObjectsByRoom;
                const combined = state.combined;
                if (!planSelectionResult?.success || !roomObjectsByRoom || combined === undefined) {
                    throw new Error('CoyoteHypothesisPipeline: parsePlanSelectionHandoff preconditions');
                }
                const selectionBody = planSelectionResult.body;
                let nextState: CoyoteHypothesisPipelineState = { ...state, selectionBody };
                const handoff = parsePlanSelectOutput(selectionBody);
                if (!handoff.ok) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'planSelectionHandoffParseFailed',
                        parseReason: handoff.reason,
                    });
                    return { state: nextState, abort: true };
                }
                let planSelectOutput = handoff.handoff;
                const selected = planSelectOutput.selectedCandidate;
                if (selected) {
                    const matched = combined.candidates.find((c) => c.candidateId === selected.candidateId);
                    if (!matched) {
                        hypothesisDebugLog('planSelectHandoff missing canonical merge', {
                            candidateId: selected.candidateId,
                            reason: 'no_combine_row_for_candidateId',
                        });
                    }
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
                nextState = { ...nextState, planSelectOutput };
                const winner = planSelectOutput.selectedCandidate;
                if (winner !== undefined && !(winner.gimmick?.trim() ?? '')) {
                    hypothesisDebugLog('planSelectHandoff missing gimmick on winner', {
                        candidateId: winner.candidateId,
                    });
                }
                if (!planSelectOutput.selectedCandidate) {
                    hypothesisDebugLog('aborting hypothesis pipeline', {
                        reason: 'planSelectionMissingSelectedCandidate',
                    });
                    return { state: nextState, abort: true };
                }
                await emitThinkingResultForSegmentIfActive(
                    nextState,
                    deps,
                    thinkingHarness,
                    'planSelect',
                    buildPlanSelectThinkingResultVerbose({
                        roomObjectsByRoom: nextState.roomObjectsByRoom!,
                        combined: nextState.combined!,
                        planSelectionResult: planSelectionResult,
                        planSelectOutput: nextState.planSelectOutput!,
                        selectionBody: nextState.selectionBody!,
                        planSelectPromptParts: nextState.planSelectPromptParts,
                    })
                );
                return { state: nextState };
            },
        }),
        ctx.defineLlmStep({
            name: 'hypothesisNarrativeBeatLlm',
            run: async (state) => {
                const roomObjectsByRoom = state.roomObjectsByRoom;
                const handoff = state.planSelectOutput;
                if (!roomObjectsByRoom || !handoff?.selectedCandidate) {
                    throw new Error('CoyoteHypothesisPipeline: hypothesisNarrativeBeatLlm preconditions');
                }
                // selectedCandidate.gimmick is optional; buildNarrativeBeatPrompt degrades to executionSummary + tropeAssignments.
                const parts = buildNarrativeBeatPrompt({
                    roomObjectsByRoom,
                    planSelectOutput: handoff as PlanSelectOutputWithWinner,
                    includeIconicFewShots: fewShotOptions?.includeIconicFewShots,
                });
                const narrativeBeatResult = await invokeBedrockHypothesisNarrativeBeat(parts);
                const nextState: CoyoteHypothesisPipelineState = {
                    ...state,
                    narrativeBeatPromptParts: parts,
                    narrativeBeatResult,
                };
                hypothesisDebugLog('narrative beat invoke complete', summarizeInvokeResult(narrativeBeatResult));
                if (!narrativeBeatResult.success) {
                    hypothesisDebugLog('aborting hypothesis pipeline', { reason: 'narrativeBeatInvokeFailed' });
                    return { state: nextState, abort: true };
                }
                return { state: nextState };
            },
        }),
        ctx.defineOrchestrationStep({
            name: 'parseNarrativeBeatRecord',
            run: async (state) => {
                const narrativeBeatResult = state.narrativeBeatResult;
                const roomObjectsByRoom = state.roomObjectsByRoom;
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
                const selectedCandidate = state.planSelectOutput?.selectedCandidate;
                const winnerGimmickRaw = selectedCandidate?.gimmick;
                const winnerGimmick =
                    typeof winnerGimmickRaw === 'string' && winnerGimmickRaw.trim().length > 0
                        ? truncateCoyoteGimmickEcho(winnerGimmickRaw)
                        : undefined;
                const winnerTropeSequence =
                    selectedCandidate !== undefined
                        ? tropeSequenceFromAssignments(selectedCandidate.tropeAssignments)
                        : [];
                const record: CoyoteGameIntentRecord = {
                    ...parsed.record,
                    ...(winnerGimmick !== undefined && winnerGimmick.length > 0
                        ? { gimmick: winnerGimmick }
                        : {}),
                    ...(winnerTropeSequence.length > 0 ? { tropeSequence: winnerTropeSequence } : {}),
                };
                const nextState: CoyoteHypothesisPipelineState = {
                    ...state,
                    record,
                    narrativeBeatsStructuredJson: parsed.narrativeBeatsStructuredJson,
                    narrativeBeatsStructuredValidationReason: parsed.narrativeBeatsStructuredValidationReason,
                    ...(narrativeBeatResult.reasoningContent !== undefined &&
                    narrativeBeatResult.reasoningContent.length > 0
                        ? { narrativeBeatReasoningContent: narrativeBeatResult.reasoningContent }
                        : {}),
                };
                hypothesisDebugLog('narrative beat parse complete', {
                    intent: parsed.record.intent,
                    hasWalkthrough: parsed.record.walkthrough !== undefined,
                    hasNarrativeBeatsStructured: parsed.record.narrativeBeatsStructured !== undefined,
                    hasGimmick: record.gimmick !== undefined,
                    narrativeBeatsStructuredValidationReason: parsed.narrativeBeatsStructuredValidationReason,
                    narrativeBeatsStructuredJsonPresent: parsed.narrativeBeatsStructuredJson !== undefined,
                });
                const planSelectOutput = nextState.planSelectOutput;
                if (!planSelectOutput) {
                    throw new Error('CoyoteHypothesisPipeline: parseNarrativeBeatRecord missing planSelectOutput');
                }
                await emitThinkingResultForSegmentIfActive(
                    nextState,
                    deps,
                    thinkingHarness,
                    'narrativeBeats',
                    buildNarrativeBeatsThinkingResultVerbose({
                        roomObjectsByRoom,
                        planSelectOutput,
                        narrativeBeatResult,
                        record: nextState.record!,
                        narrativeBeatsStructuredJson: nextState.narrativeBeatsStructuredJson,
                        narrativeBeatsStructuredValidationReason: nextState.narrativeBeatsStructuredValidationReason,
                        narrativeBeatReasoningContent: nextState.narrativeBeatReasoningContent,
                        narrativeBeatPromptParts: nextState.narrativeBeatPromptParts,
                    })
                );
                return { state: nextState };
            },
        }),
    ];
}

function pipelineFailureToStubResult(
    failure: PipelineRunFailure<CoyoteHypothesisPipelineState>
): GenerateHypothesisPipelineStubResult | null {
    const { state, abort } = failure;

    if (abort !== true) {
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
            abort: result.abort === true,
            ...(result.error !== undefined ? errorDetails(result.error) : {}),
        });
        return stub;
    }

    if (result.abort === true) {
        hypothesisDebugLog('pipeline mapper: rethrowing product abort without stub payload', {
            failedStepName: result.failedStepName,
            failedStepIndex: result.failedStepIndex,
        });
        throw new Error(PRODUCT_ABORT_ERROR_MESSAGE);
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
        return [allSteps[3], allSteps[4]];
    }
    /** Narrative beat LLM plus parse into intent / narrative-beats structured JSON (same slice tail as `runUntil` for this phase). */
    return [allSteps[5], allSteps[6]];
}

export async function runCoyoteHypothesisPipeline(
    deps: GenerateHypothesisDeps,
    harnessOptions?: CoyoteHypothesisPipelineHarnessOptions
): Promise<GenerateHypothesisPipelineResult> {
    const ctx = createPipelineContext<CoyoteHypothesisPipelineState>();

    let initialState: CoyoteHypothesisPipelineState = {};
    let mapContext: MapPipelineHarnessContext = { harness: undefined };
    let thinkingHarness: HypothesisThinkingHarnessOptions | undefined;

    if (harnessOptions !== undefined) {
        validateCoyoteHypothesisHarnessOptions(harnessOptions);
        thinkingHarness = {
            testOnly: harnessOptions.testOnly,
            harnessRunKind: harnessOptions.harnessRunKind,
        };
        mapContext = {
            harness: {
                testOnly: harnessOptions.testOnly,
                harnessRunKind: harnessOptions.harnessRunKind,
            },
        };
    }

    const fewShotOptions: HypothesisFewShotOptions | undefined =
        harnessOptions !== undefined ? { includeIconicFewShots: false } : undefined;
    const allSteps = buildCoyoteHypothesisSteps(ctx, deps, thinkingHarness, fewShotOptions);
    let steps = allSteps;

    if (harnessOptions !== undefined) {
        steps = selectHarnessSteps(allSteps, harnessOptions);
        if (harnessOptions.harnessRunKind === 'runOnly') {
            initialState = initialStateForRunOnly(harnessOptions.testOnly, harnessOptions.injectState);
        }
    }

    const bus = deps.messageBus ?? getDefaultMessageBus();
    const thinkingIds = await bootstrapHypothesisThinkingAtRunStart(
        { messageBus: bus },
        harnessOptions !== undefined
            ? {
                  testOnly: harnessOptions.testOnly,
                  harnessRunKind: harnessOptions.harnessRunKind,
              }
            : undefined
    );
    initialState = {
        ...initialState,
        thinking: thinkingIds,
    };

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
            abort: runResult.abort === true,
            failedStepName: runResult.failedStepName,
            failedStepIndex: runResult.failedStepIndex,
            ...(runResult.error !== undefined ? errorDetails(runResult.error) : {}),
        });
        if (runResult.state.thinking !== undefined) {
            const failureError =
                runResult.error ??
                (runResult.abort === true ? new Error(PRODUCT_ABORT_ERROR_MESSAGE) : undefined);
            await finalizeHypothesisThinkingOnRunFailure(
                { messageBus: bus },
                {
                    ids: runResult.state.thinking,
                    failedStepName: runResult.failedStepName,
                    failedStepIndex: runResult.failedStepIndex,
                    error: failureError,
                    state: runResult.state,
                    thinkingHarness,
                }
            );
        }
    }
    return mapPipelineRunToGenerateHypothesisResult(runResult, mapContext);
}
