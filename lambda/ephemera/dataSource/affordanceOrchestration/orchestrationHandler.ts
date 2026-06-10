/**
 * Affordance orchestration handler: intake, topology preflight (D32), stream outbounds.
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { computePerspectiveKey as defaultComputePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import { ensureAffordanceTopology } from '../affordanceCache/ensureAffordanceTopology'
import { isCatalogRowStale } from '../affordanceCache/catalogGuards'
import { getAffordanceRow } from '../affordanceCache/catalogRow'
import type { AffordancesRequested } from './localApiEvents'
import type { AffordanceOrchestrationPublishedPayload } from './publishedEvents'
import { publishAffordanceOrchestrationStreamEvent } from './publishedEvents'

export type OrchestrationHandlerDependencies = {
    computePerspectiveKey?: typeof defaultComputePerspectiveKey;
    ensureAffordanceTopology?: typeof ensureAffordanceTopology;
};

const reasonNeedsTopologyHydrate = (
    reason: AffordancesRequested['reason'],
    catalogStale: boolean
): boolean => reason === 'topology' || catalogStale

/**
 * Single-item affordance orchestration: ensure topology when needed, emit Slice Ready.
 */
export const orchestrateAffordanceRequest = async (
    {
        payload,
        streamEvent,
    }: {
        payload: AffordancesRequested;
        streamEvent: StreamEventFunction<AffordanceOrchestrationPublishedPayload>;
    },
    deps?: OrchestrationHandlerDependencies
): Promise<void> => {
    const computePerspectiveKey = deps?.computePerspectiveKey ?? defaultComputePerspectiveKey
    const ensureTopology = deps?.ensureAffordanceTopology ?? ensureAffordanceTopology
    const perspectiveKey = computePerspectiveKey(payload.perspective.assetStack)
    const { roomId, perspective, reason } = payload

    try {
        const existingRow = await getAffordanceRow(roomId, perspectiveKey)
        const catalogStale = existingRow === undefined || isCatalogRowStale(existingRow)

        if (reasonNeedsTopologyHydrate(reason, catalogStale)) {
            await ensureTopology({ roomId, perspective })
        }

        await publishAffordanceOrchestrationStreamEvent(streamEvent, roomId, {
            type: 'Slice Ready',
            roomId,
            perspective,
            perspectiveKey,
        })
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('[mtw.ephemera.affordanceOrchestration] orchestration error', {
            roomId,
            perspectiveKey,
            reason,
            errorMessage,
        })
        await publishAffordanceOrchestrationStreamEvent(streamEvent, roomId, {
            type: 'Orchestration Error',
            roomId,
            perspective,
            perspectiveKey,
            errorCode: 'ORCHESTRATION_FAILED',
            errorMessage,
        })
    }
}
