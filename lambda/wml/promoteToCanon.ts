/**
 * Promote-to-Canon coordination: step resolution and bus runner for the `promoteToCanon` API message.
 */
import type { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { sendCanonizeAsset, sendMoveAsset } from './dataSource/subscribedEvents'
import type { StreamingEventMessage } from './messageBus/baseClasses'

export type PromoteToCanonStep =
    | { kind: 'moveAsset'; fromZone: Zone; toZone: 'Library' }
    | { kind: 'canonize' }

type WmlCoordinationBus = {
    send: (payload: StreamingEventMessage) => void
    flush: () => Promise<void>
}

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

/** Enqueue one step at a time and flush after each so mtw-wml never batches competing handlers per asset. */
export async function runPromoteToCanonOnBus(bus: WmlCoordinationBus, streamKey: string, currentZone: Zone): Promise<void> {
    for (const step of planPromoteToCanonSteps(currentZone)) {
        if (step.kind === 'moveAsset') {
            sendMoveAsset(bus, streamKey, {
                fromZone: step.fromZone,
                toZone: step.toZone,
            })
        } else {
            sendCanonizeAsset(bus, streamKey, {})
        }
        await bus.flush()
    }
}
