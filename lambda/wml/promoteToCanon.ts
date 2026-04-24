/**
 * Promote-to-Canon coordination: step resolution and bus runner for the `promoteToCanon` API message.
 */
import type { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import { sendCanonizeAsset, sendMoveAsset } from './dataSource/subscribedEvents'
import type { StreamingEventMessage } from './messageBus/baseClasses'

export type PromoteToCanonStep =
    | { kind: 'moveAsset'; fromZone: Zone; toZone: 'Library' }
    | { kind: 'canonize' }

type WmlCoordinationBus = {
    send: (payload: StreamingEventMessage, laneId?: string) => void
    flush: (laneId?: string) => Promise<void>
}

const MAX_PROMOTE_TO_CANON_ITERATIONS = 8

/** Zone and optional player from the same refetch as coordination steps (e.g. AssetWorkspace.fromUUID). */
export type PromoteToCanonAssetContext = { zone: Zone; player?: string }

/** Refetch authoritative context between coordination steps. */
export type GetPromoteToCanonContext = () => Promise<PromoteToCanonAssetContext>

/** Ordered coordination steps for promote-to-Canon (caller must flush between each send). */
export function planPromoteToCanonSteps(currentZone: Zone): PromoteToCanonStep[] {
    if (currentZone === 'Canon') {
        return []
    }
    if (currentZone === 'Library') {
        return [{ kind: 'canonize' }]
    }
    return [
        { kind: 'moveAsset', fromZone: currentZone, toZone: 'Library' },
        { kind: 'canonize' },
    ]
}

/**
 * Enqueue one step at a time and flush after each so mtw-wml never batches competing handlers per asset.
 * Re-reads zone after each flush so only remaining work is enqueued (state-based idempotency).
 *
 * Uses a dedicated message-bus lane so `flush(laneId)` drains only this promotion's coordination
 * (and outbounds that inherit the inbound flush lane), not unrelated default-lane traffic.
 */
export async function runPromoteToCanonOnBus(
    bus: WmlCoordinationBus,
    streamKey: string,
    getContext: GetPromoteToCanonContext
): Promise<void> {
    const laneId = `promoteToCanon:${streamKey}:${uuidv4()}`
    for (let i = 0; i < MAX_PROMOTE_TO_CANON_ITERATIONS; i++) {
        const { zone: currentZone, player } = await getContext()
        const steps = planPromoteToCanonSteps(currentZone)
        if (steps.length === 0) {
            return
        }
        const step = steps[0]
        if (step.kind === 'moveAsset') {
            sendMoveAsset(
                bus,
                streamKey,
                {
                    fromZone: step.fromZone,
                    toZone: step.toZone,
                    player,
                },
                laneId
            )
        } else {
            sendCanonizeAsset(bus, streamKey, {}, laneId)
        }
        await bus.flush(laneId)
    }
    throw new Error(`promoteToCanon exceeded ${MAX_PROMOTE_TO_CANON_ITERATIONS} coordination iterations for ${streamKey}`)
}
