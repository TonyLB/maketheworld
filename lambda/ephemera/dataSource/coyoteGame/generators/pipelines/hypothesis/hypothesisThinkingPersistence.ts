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
    sendPutThinkingSchedule,
} from '../../../../apiEphemera'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'
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
    messageBus: Pick<MessageBus, 'send' | 'flush'>
}

export type HypothesisThinkingResultDeps = HypothesisThinkingBootstrapDeps

const ALL_SEGMENTS: ThinkingSegment[] = ['candidates', 'planSelect', 'narrativeBeats']

export function thinkingStreamKey(generationId: string): string {
    return jobEphemeraId(generationId)
}

export function thinkingResultsLaneId(generationId: string): string {
    return `thinkingResults:${generationId}`
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
}

export function buildCandidatesThinkingResultVerbose(input: {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    stageOneResult: InvokeBedrockHypothesisResult
    combined: CombineCandidateOutputReturn
}): CandidatesThinkingResultVerbose {
    const verbose: CandidatesThinkingResultVerbose = {
        roomObjectsByRoom: input.roomObjectsByRoom,
        stageOneResult: summarizeInvokeResultForThinkingVerbose(input.stageOneResult),
        combined: input.combined,
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
}

export function buildPlanSelectThinkingResultVerbose(input: {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combined: CombineCandidateOutputReturn
    planSelectionResult: InvokeBedrockHypothesisResult
    planSelectOutput: PlanSelectOutput
    selectionBody: string
}): PlanSelectThinkingResultVerbose {
    return {
        roomObjectsByRoom: input.roomObjectsByRoom,
        combined: input.combined,
        planSelectionResult: summarizeInvokeResultForThinkingVerbose(input.planSelectionResult),
        planSelectOutput: input.planSelectOutput,
        selectionBody: input.selectionBody,
    }
}

export type NarrativeBeatsThinkingResultVerbose = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    planSelectOutput: PlanSelectOutput
    narrativeBeatResult: Record<string, unknown>
    record: CoyoteGameIntentRecord
    narrativeBeatsStructuredJson?: string
    narrativeBeatsStructuredValidationReason?: string
    narrativeBeatReasoningContent?: string
}

export function buildNarrativeBeatsThinkingResultVerbose(input: {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    planSelectOutput: PlanSelectOutput
    narrativeBeatResult: InvokeBedrockHypothesisResult
    record: CoyoteGameIntentRecord
    narrativeBeatsStructuredJson?: string
    narrativeBeatsStructuredValidationReason?: string
    narrativeBeatReasoningContent?: string
}): NarrativeBeatsThinkingResultVerbose {
    const verbose: NarrativeBeatsThinkingResultVerbose = {
        roomObjectsByRoom: input.roomObjectsByRoom,
        planSelectOutput: input.planSelectOutput,
        narrativeBeatResult: summarizeInvokeResultForThinkingVerbose(input.narrativeBeatResult),
        record: input.record,
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

export function sendCoyoteThinkingResult(
    bus: Pick<MessageBus, 'send'>,
    streamKey: string,
    event: ThinkingResultEvent,
    laneId?: string
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
    if (laneId !== undefined && laneId !== '') {
        bus.send(message, laneId)
    } else {
        bus.send(message)
    }
}

export async function emitHypothesisThinkingResult(
    deps: HypothesisThinkingResultDeps,
    ids: HypothesisThinkingIds,
    segment: ThinkingSegment,
    verbose: unknown
): Promise<void> {
    const workItemId = ids.workItems[segment]
    if (workItemId === undefined) {
        throw new Error(`HypothesisThinkingPersistence: missing workItemId for segment ${segment}`)
    }
    const streamKey = thinkingStreamKey(ids.generationId)
    const laneId = thinkingResultsLaneId(ids.generationId)
    const event: ThinkingResultEvent = {
        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
        generationId: ids.generationId,
        workItemId,
        segment,
        ok: true,
        completedAt: new Date().toISOString(),
        verbose,
    }
    sendCoyoteThinkingResult(deps.messageBus, streamKey, event, laneId)
    await deps.messageBus.flush(laneId)
}

export async function bootstrapHypothesisThinkingAtRunStart(
    deps: HypothesisThinkingBootstrapDeps,
    harness?: HypothesisThinkingHarnessOptions
): Promise<HypothesisThinkingIds> {
    const segments = activeThinkingSegmentsForRun(harness)
    const ids = mintHypothesisThinkingIds(segments)
    const streamKey = thinkingStreamKey(ids.generationId)
    const bootstrapLaneId = `thinkingBootstrap:${uuidv4()}`
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

    sendPutThinkingJobCreate(
        bus,
        streamKey,
        {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: ids.generationId,
            workItemIds,
            jobStatus: 'running',
            createdAt,
        },
        bootstrapLaneId
    )

    for (const segment of segments) {
        const workItemId = ids.workItems[segment]
        if (workItemId === undefined) {
            throw new Error(`HypothesisThinkingPersistence: missing workItemId for segment ${segment}`)
        }
        sendPutThinkingSchedule(
            bus,
            streamKey,
            {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: ids.generationId,
                workItemId,
                segment,
                scheduleStatus: 'scheduled',
                enqueuedAt,
            },
            bootstrapLaneId
        )
    }

    await bus.flush(bootstrapLaneId)
    return ids
}
