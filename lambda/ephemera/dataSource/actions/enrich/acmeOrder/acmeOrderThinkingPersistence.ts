import { jobEphemeraId } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    THINKING_RESULT_HEADER_TYPE,
    THINKING_SCHEMA_VERSION_INITIAL,
    ThinkingEventSerializer,
    type ThinkingResultEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { v4 as uuidv4 } from 'uuid'

import type { InvokeBedrockAcmeOrderEnrichResult } from '../../../../generateExample/invokeBedrockAcmeOrderEnrich'
import type { StreamingEventMessage, MessageBus } from '../../../../messageBus/baseClasses'
import type { ParseCommandAcmeOrderResult, ParseCommandErrorResult } from '../../baseClasses'
import {
    sendPutThinkingJobCreate,
    sendPutThinkingJobError,
    sendPutThinkingSchedule,
} from '../../../apiEphemera'

/** Matches `ACME_ORDER_COYOTE_MAX_OBJECTS` in enrich `index.ts` (not imported to avoid enrich ↔ persistence cycle). */
const ACME_ORDER_PLACEMENT_CAP = 20

/** Publisher key for Actions `Thinking Result` bus envelopes (consumer: mtw.ephemera.thinking.results). */
export const EPHEMERA_ACTIONS_DATA_SOURCE_KEY = 'mtw.ephemera.actions' as const

export const ACME_ORDER_ENRICH_SEGMENT = 'acmeOrderEnrich' as const

const thinkingResultSerializer = new ThinkingEventSerializer()

export type AcmeOrderEnrichFailureKind =
    | 'placed_objects_cap'
    | 'invoke_failed'
    | 'parse_failed'
    | 'finalize_failed'
    | 'unknown'

export type AcmeOrderThinkingIds = {
    generationId: string
    workItems: { acmeOrderEnrich: string }
}

export type AcmeOrderThinkingBootstrapDeps = {
    messageBus: Pick<MessageBus, 'send' | 'flush'>
}

export type AcmeOrderThinkingResultDeps = AcmeOrderThinkingBootstrapDeps

export type AcmeOrderThinkingResultOutcome = {
    ok: boolean
    verbose?: unknown
    errorCode?: string
    errorMessage?: string
}

export type FinalizeAcmeOrderThinkingOnFailureInput = {
    ids: AcmeOrderThinkingIds
    errorCode: string
    errorMessage: string
    verbose?: unknown
}

export type AcmeOrderEnrichThinkingVerboseInput = {
    command: string
    occupiedStableKeys?: readonly string[]
    intentRawOrders?: readonly string[]
    intentConfidence?: number
    enrichInvoke?: InvokeBedrockAcmeOrderEnrichResult
    enrichRawBody?: string
    enrichReasoningMarkdown?: string
    enrichResponse?: AcmeOrderEnrichModelResponse | null
    parseFailureReason?: string
    result?: ParseCommandAcmeOrderResult | ParseCommandErrorResult
    tropeFailureReasons?: string[]
    placedObjectsCount?: number
}

export type AcmeOrderEnrichThinkingVerbose = Record<string, unknown>

export function acmeOrderEnrichErrorCodeForFailureKind(kind: AcmeOrderEnrichFailureKind): string {
    switch (kind) {
        case 'placed_objects_cap':
            return 'acme_enrich_placed_objects_cap'
        case 'invoke_failed':
            return 'acme_enrich_invoke_failed'
        case 'parse_failed':
            return 'acme_enrich_parse_failed'
        case 'finalize_failed':
            return 'acme_enrich_finalize_failed'
        default:
            return 'acme_enrich_unknown'
    }
}

export function errorMessageFromUnknown(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}

export function thinkingStreamKey(generationId: string): string {
    return jobEphemeraId(generationId)
}

export function thinkingResultsLaneId(generationId: string): string {
    return `thinkingResults:${generationId}`
}

export function mintAcmeOrderThinkingIds(): AcmeOrderThinkingIds {
    return {
        generationId: uuidv4(),
        workItems: { acmeOrderEnrich: uuidv4() },
    }
}

export function summarizeAcmeEnrichInvokeForVerbose(
    result: InvokeBedrockAcmeOrderEnrichResult
): Record<string, unknown> {
    return {
        success: result.success,
        bodyLength: result.success ? result.body.length : undefined,
        usage: result.success ? result.usage : undefined,
        errorMessage: result.success ? undefined : result.errorMessage,
    }
}

function baseVerboseFields(input: AcmeOrderEnrichThinkingVerboseInput): AcmeOrderEnrichThinkingVerbose {
    const verbose: AcmeOrderEnrichThinkingVerbose = {
        command: input.command.trim(),
    }
    if (input.intentRawOrders !== undefined) {
        verbose.intentRawOrders = [...input.intentRawOrders]
    }
    if (input.occupiedStableKeys !== undefined) {
        verbose.occupiedStableKeys = [...input.occupiedStableKeys]
    }
    if (input.intentConfidence !== undefined) {
        verbose.intentConfidence = input.intentConfidence
    }
    if (input.enrichInvoke !== undefined) {
        verbose.enrichInvoke = summarizeAcmeEnrichInvokeForVerbose(input.enrichInvoke)
    }
    if (input.enrichRawBody !== undefined) {
        verbose.enrichRawBody = input.enrichRawBody
    }
    if (input.enrichReasoningMarkdown !== undefined && input.enrichReasoningMarkdown.length > 0) {
        verbose.enrichReasoningMarkdown = input.enrichReasoningMarkdown
    }
    if (input.enrichResponse !== undefined && input.enrichResponse !== null) {
        verbose.enrichResponse = input.enrichResponse
    }
    if (input.parseFailureReason !== undefined) {
        verbose.parseFailureReason = input.parseFailureReason
    }
    if (input.tropeFailureReasons !== undefined) {
        verbose.tropeFailureReasons = input.tropeFailureReasons
    }
    return verbose
}

export function buildAcmeOrderEnrichSuccessVerbose(
    input: AcmeOrderEnrichThinkingVerboseInput
): AcmeOrderEnrichThinkingVerbose {
    const verbose = baseVerboseFields(input)
    const result = input.result
    verbose.resultType = result?.type ?? 'unknown'
    if (result?.type === 'AcmeOrder') {
        verbose.validOrdersCount = result.orders.filter(({ valid }) => valid).length
        verbose.invalidOrdersCount = result.orders.filter(({ valid }) => !valid).length
    }
    return verbose
}

export function buildAcmeOrderEnrichFailureVerbose(
    input: AcmeOrderEnrichThinkingVerboseInput
): AcmeOrderEnrichThinkingVerbose {
    const verbose = buildAcmeOrderEnrichSuccessVerbose(input)
    if (input.placedObjectsCount !== undefined) {
        verbose.placedObjectsCount = input.placedObjectsCount
        verbose.placementCap = ACME_ORDER_PLACEMENT_CAP
    }
    const result = input.result
    if (result !== undefined) {
        verbose.resultType = result.type
    }
    return verbose
}

function postAcmeOrderThinkingResult(
    deps: AcmeOrderThinkingResultDeps,
    ids: AcmeOrderThinkingIds,
    outcome: AcmeOrderThinkingResultOutcome,
    laneId: string
): void {
    const workItemId = ids.workItems.acmeOrderEnrich
    const streamKey = thinkingStreamKey(ids.generationId)
    const event: ThinkingResultEvent = {
        schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
        generationId: ids.generationId,
        workItemId,
        segment: ACME_ORDER_ENRICH_SEGMENT,
        ok: outcome.ok,
        completedAt: new Date().toISOString(),
        ...(outcome.verbose !== undefined ? { verbose: outcome.verbose } : {}),
        ...(outcome.errorCode !== undefined ? { errorCode: outcome.errorCode } : {}),
        ...(outcome.errorMessage !== undefined ? { errorMessage: outcome.errorMessage } : {}),
    }
    sendActionsThinkingResult(deps.messageBus, streamKey, event, laneId)
}

export function sendActionsThinkingResult(
    bus: Pick<MessageBus, 'send'>,
    streamKey: string,
    event: ThinkingResultEvent,
    laneId?: string
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: THINKING_RESULT_HEADER_TYPE,
    }
    const envelope = createInternalOriginEnvelope(header, event, thinkingResultSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
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

export async function emitAcmeOrderThinkingResult(
    deps: AcmeOrderThinkingResultDeps,
    ids: AcmeOrderThinkingIds,
    outcome: AcmeOrderThinkingResultOutcome
): Promise<void> {
    const laneId = thinkingResultsLaneId(ids.generationId)
    const streamKey = thinkingStreamKey(ids.generationId)
    postAcmeOrderThinkingResult(deps, ids, outcome, laneId)
    if (outcome.ok) {
        sendPutThinkingSchedule(
            deps.messageBus,
            streamKey,
            {
                schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
                generationId: ids.generationId,
                workItemId: ids.workItems.acmeOrderEnrich,
                segment: ACME_ORDER_ENRICH_SEGMENT,
                scheduleStatus: 'completed',
            },
            laneId
        )
    }
    await deps.messageBus.flush(laneId)
}

export async function finalizeAcmeOrderThinkingOnFailure(
    deps: AcmeOrderThinkingResultDeps,
    input: FinalizeAcmeOrderThinkingOnFailureInput
): Promise<void> {
    const { ids, errorCode, errorMessage, verbose } = input
    const streamKey = thinkingStreamKey(ids.generationId)
    const laneId = thinkingResultsLaneId(ids.generationId)
    const bus = deps.messageBus
    const workItemId = ids.workItems.acmeOrderEnrich

    postAcmeOrderThinkingResult(
        deps,
        ids,
        {
            ok: false,
            verbose,
            errorCode,
            errorMessage,
        },
        laneId
    )

    sendPutThinkingJobError(
        bus,
        streamKey,
        {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: ids.generationId,
            jobStatus: 'failed',
            failedAt: new Date().toISOString(),
            errorCode,
            errorMessage,
            lastFailedWorkItemId: workItemId,
        },
        laneId
    )

    await bus.flush(laneId)
}

export async function bootstrapAcmeOrderThinkingAtRunStart(
    deps: AcmeOrderThinkingBootstrapDeps
): Promise<AcmeOrderThinkingIds> {
    const ids = mintAcmeOrderThinkingIds()
    const streamKey = thinkingStreamKey(ids.generationId)
    const bootstrapLaneId = `thinkingBootstrap:${uuidv4()}`
    const bus = deps.messageBus
    const createdAt = new Date().toISOString()
    const enqueuedAt = createdAt
    const workItemId = ids.workItems.acmeOrderEnrich

    sendPutThinkingJobCreate(
        bus,
        streamKey,
        {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: ids.generationId,
            workItemIds: [workItemId],
            jobStatus: 'running',
            createdAt,
        },
        bootstrapLaneId
    )

    sendPutThinkingSchedule(
        bus,
        streamKey,
        {
            schemaVersion: THINKING_SCHEMA_VERSION_INITIAL,
            generationId: ids.generationId,
            workItemId,
            segment: ACME_ORDER_ENRICH_SEGMENT,
            scheduleStatus: 'scheduled',
            enqueuedAt,
        },
        bootstrapLaneId
    )

    await bus.flush(bootstrapLaneId)
    return ids
}
