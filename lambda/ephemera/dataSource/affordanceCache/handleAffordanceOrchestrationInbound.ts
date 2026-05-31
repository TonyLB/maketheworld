/**
 * Pass-through from mtw.ephemera.affordanceOrchestration stream events.
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import internalCache from '../../internalCache'
import type {
    AffordanceOrchestrationPublishedPayload,
    AffordanceOrchestrationSliceReadyPayload,
} from '../affordanceOrchestration/publishedEvents'
import type { AffordanceCacheUpdatePayload } from './publishedEvents'

async function handleSliceReadyPath(params: {
    content: AffordanceOrchestrationSliceReadyPayload;
    streamEvent: StreamEventFunction<AffordanceCacheUpdatePayload>;
}): Promise<void> {
    const { content, streamEvent } = params
    const roomId = content.roomId as EphemeraRoomId
    const { perspectiveKey } = content

    const affordanceRow = await internalCache.AffordanceCache.getAffordanceRow(roomId, perspectiveKey)
    if (affordanceRow === undefined) {
        console.error('[mtw.ephemera.affordanceCache] Slice Ready refetch miss after orchestration outbound', {
            roomId,
            perspectiveKey,
        })
        await streamEvent({
            streamKey: roomId,
            header: { type: 'Cache Error' },
            update: {
                type: 'Cache Error',
                roomId,
                perspectiveKey,
                errorCode: 'SLICE_NOT_READY',
                errorMessage: `No hydrated affordance row for ${roomId} at ${perspectiveKey}`,
            },
        })
        return
    }

    await streamEvent({
        streamKey: roomId,
        header: { type: 'Affordances Pertain' },
        update: {
            type: 'Affordances Pertain',
            roomId,
            perspective: content.perspective,
            perspectiveKey,
            affordanceRow,
            topology: affordanceRow.topology,
        },
    })
}

export async function handleAffordanceOrchestrationInbound(params: {
    content: AffordanceOrchestrationPublishedPayload;
    streamEvent: StreamEventFunction<AffordanceCacheUpdatePayload>;
}): Promise<void> {
    switch (params.content.type) {
        case 'Slice Ready':
            await handleSliceReadyPath({
                content: params.content,
                streamEvent: params.streamEvent,
            })
            return
        case 'Orchestration Error':
            return
        case 'Enrichment Started':
        case 'Enrichment Complete':
        case 'Enrichment Deferred':
            return
        default: {
            const _exhaustive: never = params.content
            return _exhaustive
        }
    }
}
