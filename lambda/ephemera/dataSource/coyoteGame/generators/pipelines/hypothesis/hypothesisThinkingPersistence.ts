import { jobEphemeraId } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    THINKING_RESULT_HEADER_TYPE,
    THINKING_SCHEMA_VERSION_INITIAL,
    ThinkingEventSerializer,
    type ThinkingResultEvent,
    type ThinkingSegment,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { v4 as uuidv4 } from 'uuid'

import type { CoyoteGameIntentRecord } from '../../../../../internalCache/coyoteGame'
import type { StreamingEventMessage } from '../../../../../messageBus/baseClasses'
import type { MessageBus } from '../../../../../messageBus/baseClasses'
import {
    sendPutThinkingJobCreate,
    sendPutThinkingJobError,
    sendPutThinkingSchedule,
} from '../../../../apiEphemera'
import { bedrockPromptForVerbose } from '../../../../../llm/bedrockPromptForVerbose'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
import type { CoyotePromptParts } from './promptTypes'
import type { CombineCandidateOutputReturn } from './candidates/combineCandidateOutput'
import type { InvokeBedrockHypothesisResult } from './invokeBedrockHypothesis'
import type { PlanSelectOutput } from './planSelect/parsePlanSelectOutput'

/** Publisher key for CoyoteGame `Thinking Result` bus envelopes (consumer: mtw.ephemera.thinking.results). */
export const EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY = 'mtw.ephemera.coyoteGame' as const

const thinkingResultSerializer = new ThinkingEventSerializer()

/** Mirrors {@link CoyoteHypothesisPipelineHarnessOptions} without importing the pipeline module. */
export type HypothesisThinkingHarnessOptions = {
    testOnly: ThinkingSegment
    harnessRunKind: 'runUntil' | 'runOnly'
}

export type HypothesisThinkingIds = {
    generationId: string
    workItems: Partial<Record<ThinkingSegment, string>>
}

export type HypothesisThinkingBootstrapDeps = {
    messageBus: Pick<MessageBus, 'publish'>
}

export type HypothesisThinkingResultDeps = HypothesisThinkingBootstrapDeps

export type HypothesisThinkingResultOutcome = {
    ok: boolean
    verbose?: unknown
    errorCode?: string
    errorMessage?: string
}

/** Pipeline draft fields needed to build failure verbose payloads (avoids importing the pipeline module). */
export type HypothesisThinkingPipelineStateSnapshot = {
    roomObjectsByRoom?: CoyoteRoomObjectsByRoom
    combined?: CombineCandidateOutputReturn
    stageOnePromptParts?: CoyotePromptParts
    planSelectPromptParts?: CoyotePromptParts
    narrativeBeatPromptParts?: CoyotePromptParts
    stageOneResult?: InvokeBedrockHypothesisResult
    planSelectionResult?: InvokeBedrockHypothesisResult | null
    narrativeBeatResult?: InvokeBedrockHypothesisResult | null
    planSelectOutput?: PlanSelectOutput
    selectionBody?: string
    record?: CoyoteGameIntentRecord
    narrativeBeatsStructuredJson?: string
    narrativeBeatsStructuredValidationReason?: string
    narrativeBeatReasoningContent?: string
}

export type FinalizeHypothesisThinkingOnRunFailureInput = {
    ids: HypothesisThinkingIds
    failedStepName: string
    failedStepIndex: number
    error: unknown
    state: HypothesisThinkingPipelineStateSnapshot
    thinkingHarness?: HypothesisThinkingHarnessOptions
}

const ALL_SEGMENTS: ThinkingSegment[] = ['candidates', 'planSelect', 'narrativeBeats']

const FAILED_STEP_TO_SEGMENT: Record<string, ThinkingSegment> = {
    hypothesisCandidatesLlm: 'candidates',
    seamCombineRender: 'candidates',
    hypothesisPlanSelectionLlm: 'planSelect',
    parsePlanSelectionHandoff: 'planSelect',
    hypothesisNarrativeBeatLlm: 'narrativeBeats',
    parseNarrativeBeatRecord: 'narrativeBeats',
}

export function thinkingSegmentForFailedStepName(failedStepName: string): ThinkingSegment | undefined {
    return FAILED_STEP_TO_SEGMENT[failedStepName]
}

export function errorMessageFromUnknown(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}

export function deriveHypothesisFailureErrorCode(
    failedStepName: string,
    state: HypothesisThinkingPipelineStateSnapshot
): string {
    switch (failedStepName) {
        case 'hypothesisCandidatesLlm':
            return 'stage_one_invoke_failed'
        case 'seamCombineRender':
            return 'stage_one_parse_failed'
        case 'hypothesisPlanSelectionLlm':
            return 'plan_selection_invoke_failed'
        case 'parsePlanSelectionHandoff':
            if (state.planSelectOutput !== undefined && state.planSelectOutput.selectedCandidate === undefined) {
                return 'plan_selection_missing_selected_candidate'
            }
            return 'plan_selection_handoff_parse_failed'
        case 'hypothesisNarrativeBeatLlm':
            return 'narrative_beat_invoke_failed'
        case 'loadRoomObjects':
            return 'load_room_objects_failed'
        default:
            return 'pipeline_step_failed'
    }
}

export function thinkingStreamKey(generationId: string): string {
    return jobEphemeraId(generationId)
}

export function activeThinkingSegmentsForRun(harness?: HypothesisThinkingHarnessOptions): ThinkingSegment[] {
    if (harness === undefined) {
        return [...ALL_SEGMENTS]
    }
    const { testOnly, harnessRunKind } = harness
    if (harnessRunKind === 'runOnly') {
        return [testOnly]
    }
    if (testOnly === 'candidates') {
        return ['candidates']
    }
    if (testOnly === 'planSelect') {
        return ['candidates', 'planSelect']
    }
    return [...ALL_SEGMENTS]
}

export function mintHypothesisThinkingIds(segments: ThinkingSegment[]): HypothesisThinkingIds {
    const generationId = uuidv4()
    const workItems: Partial<Record<ThinkingSegment, string>> = {}
    for (const segment of segments) {
        workItems[segment] = uuidv4()
    }
    return { generationId, workItems }
}

export function summarizeInvokeResultForThinkingVerbose(
    result: InvokeBedrockHypothesisResult
): Record<string, unknown> {
    return {
        success: result.success,
        bodyLength: result.success ? result.body.length : undefined,
        usage: result.success ? result.usage : undefined,
        errorMessage: result.success ? undefined : result.errorMessage,
    }
}

export type CandidatesThinkingResultVerbose = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    stageOneResult: Record<string, unknown>
    stageOneBody?: string
    combined: CombineCandidateOutputReturn
    bedrockPrompt?: ReturnType<typeof bedrockPromptForVerbose>
}

export function buildCandidatesThinkingResultVerbose(input: {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    stageOneResult: InvokeBedrockHypothesisResult
    combined: CombineCandidateOutputReturn
    stageOnePromptParts?: CoyotePromptParts
}): CandidatesThinkingResultVerbose {
    const verbose: CandidatesThinkingResultVerbose = {
        roomObjectsByRoom: input.roomObjectsByRoom,
        stageOneResult: summarizeInvokeResultForThinkingVerbose(input.stageOneResult),
        combined: input.combined,
    }
    if (input.stageOnePromptParts !== undefined) {
        verbose.bedrockPrompt = bedrockPromptForVerbose(input.stageOnePromptParts)
    }
    if (input.stageOneResult.success) {
        verbose.stageOneBody = input.stageOneResult.body
    }
    return verbose
}

export type PlanSelectThinkingResultVerbose = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combined: CombineCandidateOutputReturn
    planSelectionResult: Record<string, unknown>
    planSelectOutput: PlanSelectOutput
    selectionBody: string
    bedrockPrompt?: ReturnType<typeof bedrockPromptForVerbose>
}

export function buildPlanSelectThinkingResultVerbose(input: {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combined: CombineCandidateOutputReturn
    planSelectionResult: InvokeBedrockHypothesisResult
    planSelectOutput: PlanSelectOutput
    selectionBody: string
    planSelectPromptParts?: CoyotePromptParts
}): PlanSelectThinkingResultVerbose {
    const verbose: PlanSelectThinkingResultVerbose = {
        roomObjectsByRoom: input.roomObjectsByRoom,
        combined: input.combined,
        planSelectionResult: summarizeInvokeResultForThinkingVerbose(input.planSelectionResult),
        planSelectOutput: input.planSelectOutput,
        selectionBody: input.selectionBody,
    }
    if (input.planSelectPromptParts !== undefined) {
        verbose.bedrockPrompt = bedrockPromptForVerbose(input.planSelectPromptParts)
    }
    return verbose
}

export type NarrativeBeatsThinkingResultVerbose = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    planSelectOutput: PlanSelectOutput
    narrativeBeatResult: Record<string, unknown>
    record: CoyoteGameIntentRecord
    narrativeBeatsStructuredJson?: string
    narrativeBeatsStructuredValidationReason?: string
    narrativeBeatReasoningContent?: string
    bedrockPrompt?: ReturnType<typeof bedrockPromptForVerbose>
}

export function buildNarrativeBeatsThinkingResultVerbose(input: {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    planSelectOutput: PlanSelectOutput
    narrativeBeatResult: InvokeBedrockHypothesisResult
    record: CoyoteGameIntentRecord
    narrativeBeatsStructuredJson?: string
    narrativeBeatsStructuredValidationReason?: string
    narrativeBeatReasoningContent?: string
    narrativeBeatPromptParts?: CoyotePromptParts
}): NarrativeBeatsThinkingResultVerbose {
    const verbose: NarrativeBeatsThinkingResultVerbose = {
        roomObjectsByRoom: input.roomObjectsByRoom,
        planSelectOutput: input.planSelectOutput,
        narrativeBeatResult: summarizeInvokeResultForThinkingVerbose(input.narrativeBeatResult),
        record: input.record,
    }
    if (input.narrativeBeatPromptParts !== undefined) {
        verbose.bedrockPrompt = bedrockPromptForVerbose(input.narrativeBeatPromptParts)
    }
    if (input.narrativeBeatsStructuredJson !== undefined) {
        verbose.narrativeBeatsStructuredJson = input.narrativeBeatsStructuredJson
    }
    if (input.narrativeBeatsStructuredValidationReason !== undefined) {
        verbose.narrativeBeatsStructuredValidationReason = input.narrativeBeatsStructuredValidationReason
    }
    if (input.narrativeBeatReasoningContent !== undefined && input.narrativeBeatReasoningContent.length > 0) {
        verbose.narrativeBeatReasoningContent = input.narrativeBeatReasoningContent
    }
    return verbose
}

export function buildHypothesisFailureVerbose(
    state: HypothesisThinkingPipelineStateSnapshot,
    segment: ThinkingSegment,
    failedStepName: string
): unknown {
    const roomObjectsByRoom = state.roomObjectsByRoom
    if (segment === 'candidates') {
        if (roomObjectsByRoom !== undefined && state.stageOneResult !== undefined) {
            const combined = state.combined ?? { candidates: [] }
            return buildCandidatesThinkingResultVerbose({
                roomObjectsByRoom,
                stageOneResult: state.stageOneResult,
                combined,
                ...(state.stageOnePromptParts !== undefined
                    ? { stageOnePromptParts: state.stageOnePromptParts }
                    : {}),
            })
        }
        return {
            ...(roomObjectsByRoom !== undefined ? { roomObjectsByRoom } : {}),
            failedStepName,
            ...(state.stageOnePromptParts !== undefined
                ? { bedrockPrompt: bedrockPromptForVerbose(state.stageOnePromptParts) }
                : {}),
            ...(state.stageOneResult !== undefined
                ? { stageOneResult: summarizeInvokeResultForThinkingVerbose(state.stageOneResult) }
                : {}),
        }
    }
    if (segment === 'planSelect') {
        if (
            roomObjectsByRoom !== undefined &&
            state.combined !== undefined &&
            state.planSelectionResult !== undefined &&
            state.planSelectionResult !== null &&
            state.planSelectionResult.success &&
            state.planSelectOutput !== undefined
        ) {
            return buildPlanSelectThinkingResultVerbose({
                roomObjectsByRoom,
                combined: state.combined,
                planSelectionResult: state.planSelectionResult,
                planSelectOutput: state.planSelectOutput,
                selectionBody: state.selectionBody ?? state.planSelectionResult.body,
                ...(state.planSelectPromptParts !== undefined
                    ? { planSelectPromptParts: state.planSelectPromptParts }
                    : {}),
            })
        }
        return {
            ...(roomObjectsByRoom !== undefined ? { roomObjectsByRoom } : {}),
            failedStepName,
            ...(state.planSelectPromptParts !== undefined
                ? { bedrockPrompt: bedrockPromptForVerbose(state.planSelectPromptParts) }
                : {}),
            ...(state.combined !== undefined ? { combined: state.combined } : {}),
            ...(state.planSelectionResult !== undefined && state.planSelectionResult !== null
                ? {
                      planSelectionResult: summarizeInvokeResultForThinkingVerbose(state.planSelectionResult),
                  }
                : {}),
            ...(state.selectionBody !== undefined ? { selectionBody: state.selectionBody } : {}),
            ...(state.planSelectOutput !== undefined ? { planSelectOutput: state.planSelectOutput } : {}),
        }
    }
    if (segment === 'narrativeBeats') {
        if (
            roomObjectsByRoom !== undefined &&
            state.planSelectOutput !== undefined &&
            state.narrativeBeatResult !== undefined &&
            state.narrativeBeatResult !== null &&
            state.record !== undefined
        ) {
            return buildNarrativeBeatsThinkingResultVerbose({
                roomObjectsByRoom,
                planSelectOutput: state.planSelectOutput,
                narrativeBeatResult: state.narrativeBeatResult,
                record: state.record,
                narrativeBeatsStructuredJson: state.narrativeBeatsStructuredJson,
                narrativeBeatsStructuredValidationReason: state.narrativeBeatsStructuredValidationReason,
                narrativeBeatReasoningContent: state.narrativeBeatReasoningContent,
                ...(state.narrativeBeatPromptParts !== undefined
                    ? { narrativeBeatPromptParts: state.narrativeBeatPromptParts }
                    : {}),
            })
        }
        return {
            ...(roomObjectsByRoom !== undefined ? { roomObjectsByRoom } : {}),
            failedStepName,
            ...(state.narrativeBeatPromptParts !== undefined
                ? { bedrockPrompt: bedrockPromptForVerbose(state.narrativeBeatPromptParts) }
                : {}),
            ...(state.planSelectOutput !== undefined ? { planSelectOutput: state.planSelectOutput } : {}),
            ...(state.narrativeBeatResult !== undefined && state.narrativeBeatResult !== null
                ? {
                      narrativeBeatResult: summarizeInvokeResultForThinkingVerbose(state.narrativeBeatResult),
                  }
                : {}),
        }
    }
    return { failedStepName }
}

function postHypothesisThinkingResult(
    deps: HypothesisThinkingResultDeps,
    ids: HypothesisThinkingIds,
    segment: ThinkingSegment,
    outcome: HypothesisThinkingResultOutcome
): void {
    const workItemId = ids.workItems[segment]
    if (workItemId === undefined) {
        throw new Error(`HypothesisThinkingPersistence: missing workItemId for segment ${segment}`)
    }
    const streamKey = thinkingStreamKey(ids.generationId)
    const event: ThinkingResultEvent = {
        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
        generationId: ids.generationId,
        workItemId,
        segment,
        ok: outcome.ok,
        completedAt: new Date().toISOString(),
        ...(outcome.verbose !== undefined ? { verbose: outcome.verbose } : {}),
        ...(outcome.errorCode !== undefined ? { errorCode: outcome.errorCode } : {}),
        ...(outcome.errorMessage !== undefined ? { errorMessage: outcome.errorMessage } : {}),
    }
    sendCoyoteThinkingResult(deps.messageBus, streamKey, event)
}

export function sendCoyoteThinkingResult(
    bus: Pick<MessageBus, 'publish'>,
    streamKey: string,
    event: ThinkingResultEvent
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: THINKING_RESULT_HEADER_TYPE,
    }
    const envelope = createInternalOriginEnvelope(header, event, thinkingResultSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: EPHEMERA_COYOTE_GAME_DATA_SOURCE_KEY,
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    bus.publish(message)
}

export function emitHypothesisThinkingResult(
    deps: HypothesisThinkingResultDeps,
    ids: HypothesisThinkingIds,
    segment: ThinkingSegment,
    outcome: HypothesisThinkingResultOutcome
): void {
    const streamKey = thinkingStreamKey(ids.generationId)
    postHypothesisThinkingResult(deps, ids, segment, outcome)
    if (outcome.ok) {
        const workItemId = ids.workItems[segment]
        if (workItemId === undefined) {
            throw new Error(`HypothesisThinkingPersistence: missing workItemId for segment ${segment}`)
        }
        sendPutThinkingSchedule(deps.messageBus, streamKey, {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: ids.generationId,
            workItemId,
            segment,
            scheduleStatus: 'completed',
        })
    }
}

export function finalizeHypothesisThinkingOnRunFailure(
    deps: HypothesisThinkingResultDeps,
    input: FinalizeHypothesisThinkingOnRunFailureInput
): void {
    const { ids, failedStepName, error, state, thinkingHarness } = input
    const streamKey = thinkingStreamKey(ids.generationId)
    const bus = deps.messageBus
    const errorCode = deriveHypothesisFailureErrorCode(failedStepName, state)
    const errorMessage = errorMessageFromUnknown(error)
    const segment = thinkingSegmentForFailedStepName(failedStepName)

    if (
        segment !== undefined &&
        activeThinkingSegmentsForRun(thinkingHarness).includes(segment)
    ) {
        postHypothesisThinkingResult(deps, ids, segment, {
            ok: false,
            verbose: buildHypothesisFailureVerbose(state, segment, failedStepName),
            errorCode,
            errorMessage,
        })
    }

    const lastFailedWorkItemId =
        segment !== undefined ? ids.workItems[segment] : undefined

    sendPutThinkingJobError(bus, streamKey, {
        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
        generationId: ids.generationId,
        jobStatus: 'failed',
        failedAt: new Date().toISOString(),
        errorCode,
        errorMessage,
        ...(lastFailedWorkItemId !== undefined ? { lastFailedWorkItemId } : {}),
    })
}

export function bootstrapHypothesisThinkingAtRunStart(
    deps: HypothesisThinkingBootstrapDeps,
    harness?: HypothesisThinkingHarnessOptions
): HypothesisThinkingIds {
    const segments = activeThinkingSegmentsForRun(harness)
    const ids = mintHypothesisThinkingIds(segments)
    const streamKey = thinkingStreamKey(ids.generationId)
    const bus = deps.messageBus
    const createdAt = new Date().toISOString()
    const enqueuedAt = createdAt

    const workItemIds = segments.map((segment) => {
        const workItemId = ids.workItems[segment]
        if (workItemId === undefined) {
            throw new Error(`HypothesisThinkingPersistence: missing workItemId for segment ${segment}`)
        }
        return workItemId
    })

    sendPutThinkingJobCreate(bus, streamKey, {
        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
        generationId: ids.generationId,
        workItemIds,
        jobStatus: 'running',
        createdAt,
    })

    for (const segment of segments) {
        const workItemId = ids.workItems[segment]
        if (workItemId === undefined) {
            throw new Error(`HypothesisThinkingPersistence: missing workItemId for segment ${segment}`)
        }
        sendPutThinkingSchedule(bus, streamKey, {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: ids.generationId,
            workItemId,
            segment,
            scheduleStatus: 'scheduled',
            enqueuedAt,
        })
    }

    return ids
}
