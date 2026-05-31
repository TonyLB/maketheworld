/**
 * Affordance orchestration handler: intake and topology preflight (see D32) will live here.
 * Outcomes will be published on **`mtw.ephemera.affordanceOrchestration`** via `streamEvent` only.
 *
 * {@link orchestrateAffordanceRequest} is the unified entry for affordance orchestration (M4 scaffold: stub).
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { computePerspectiveKey as defaultComputePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { MessageBus } from '../../messageBus/baseClasses'
import type { AffordancesRequested } from './localApiEvents'
import type { AffordanceOrchestrationPublishedPayload } from './publishedEvents'

export type OrchestrationHandlerDependencies = {
    computePerspectiveKey?: typeof defaultComputePerspectiveKey;
    /** Tests / later slices: override hydrate preflight; default will be ensureAffordanceTopology from affordanceCache. */
    ensureAffordanceTopology?: (input: {
        roomId: AffordancesRequested['roomId'];
        perspective: AffordancesRequested['perspective'];
    }) => Promise<void>;
};

/**
 * Single-item affordance orchestration (scaffold): log ingress context; no stream outbounds yet.
 */
export const orchestrateAffordanceRequest = async (
    {
        payload,
        messageBus: _messageBus,
        streamEvent: _streamEvent,
    }: {
        payload: AffordancesRequested;
        messageBus: MessageBus;
        streamEvent: StreamEventFunction<AffordanceOrchestrationPublishedPayload>;
    },
    _deps?: OrchestrationHandlerDependencies
): Promise<void> => {
    const computePerspectiveKey = _deps?.computePerspectiveKey ?? defaultComputePerspectiveKey
    const perspectiveKey = computePerspectiveKey(payload.perspective.assetStack)

    console.log('[mtw.ephemera.affordanceOrchestration] Affordances Requested', {
        roomId: payload.roomId,
        reason: payload.reason,
        perspectiveKey,
    })

    // TODO(intake): intakeAffordancesRequested(payload) -- validate reason / perspective policy
    // TODO(D32): await ensureAffordanceTopology({ roomId, perspective }) when catalog stale + reason needs topology
    // TODO(stream): publish Slice Ready / Orchestration Error via streamEvent; affordanceCache subscribes
}
