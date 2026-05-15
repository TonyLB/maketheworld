import { jobEphemeraId } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import {
    THINKING_SCHEMA_VERSION_INITIAL,
    type ThinkingSegment,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { v4 as uuidv4 } from 'uuid'

import {
    sendPutThinkingJobCreate,
    sendPutThinkingSchedule,
} from '../../../../apiEphemera'
import type { MessageBus } from '../../../../../messageBus/baseClasses'

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

const ALL_SEGMENTS: ThinkingSegment[] = ['candidates', 'planSelect', 'narrativeBeats']

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
