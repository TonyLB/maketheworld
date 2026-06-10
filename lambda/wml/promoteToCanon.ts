/**
 * Promote-to-Canon coordination: step resolution and direct domain runner for the `promoteToCanon` API message.
 */
import type { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { MoveAssetRequest } from './dataSource/localApiEvents'
import type { WmlStreamEventFn } from './dataSource/mtw-wml'

export type PromoteToCanonStep =
    | { kind: 'moveAsset'; fromZone: Zone; toZone: 'Library' }
    | { kind: 'canonize' }

const MAX_PROMOTE_TO_CANON_ITERATIONS = 8

/** Zone and optional player from the same refetch as coordination steps (e.g. AssetWorkspace.fromUUID). */
export type PromoteToCanonAssetContext = { zone: Zone; player?: string }

/** Refetch authoritative context between coordination steps. */
export type GetPromoteToCanonContext = () => Promise<PromoteToCanonAssetContext>

export type PromoteToCanonDeps = {
    streamEvent: WmlStreamEventFn
    coordinateMoveAsset: (assetId: AssetUUID, request: MoveAssetRequest, streamEvent: WmlStreamEventFn) => Promise<void>
    coordinateCanonizeAsset: (assetId: AssetUUID, streamEvent: WmlStreamEventFn) => Promise<void>
}

/** Ordered coordination steps for promote-to-Canon. */
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
 * Run one coordination step at a time via direct domain helpers (no bus self-subscribe loop).
 * Re-reads zone after each step so only remaining work runs (state-based idempotency).
 */
export async function runPromoteToCanon(
    streamKey: string,
    getContext: GetPromoteToCanonContext,
    deps: PromoteToCanonDeps
): Promise<void> {
    const assetId = streamKey as AssetUUID
    const { streamEvent, coordinateMoveAsset, coordinateCanonizeAsset } = deps
    for (let i = 0; i < MAX_PROMOTE_TO_CANON_ITERATIONS; i++) {
        const { zone: currentZone, player } = await getContext()
        const steps = planPromoteToCanonSteps(currentZone)
        if (steps.length === 0) {
            return
        }
        const step = steps[0]
        if (step.kind === 'moveAsset') {
            await coordinateMoveAsset(
                assetId,
                {
                    fromZone: step.fromZone,
                    toZone: step.toZone,
                    player,
                },
                streamEvent
            )
        } else {
            await coordinateCanonizeAsset(assetId, streamEvent)
        }
    }
    throw new Error(`promoteToCanon exceeded ${MAX_PROMOTE_TO_CANON_ITERATIONS} coordination iterations for ${streamKey}`)
}

/** @deprecated Use runPromoteToCanon with PromoteToCanonDeps */
export const runPromoteToCanonOnBus = runPromoteToCanon
