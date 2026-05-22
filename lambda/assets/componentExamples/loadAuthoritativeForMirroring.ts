import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    authoritativeFromParticipationOrder,
    type AuthoritativeComponentData,
} from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import internalCache from '../internalCache'

const dedupeSortedAssets = (assetIds: AssetUUID[]): AssetUUID[] =>
    Array.from(new Set(assetIds)).sort()

/**
 * Derives a bounded participation order for legacy mirroring without partition enumerate.
 * Uses import-vertical hop endpoints plus the event asset; ordering is ascending AssetUUID
 * (interim until graph-derived participation order lands in gateways).
 */
export const deriveMirroringParticipationOrder = async (
    universalKey: ComponentUUID,
    eventAssetId: AssetUUID
): Promise<AssetUUID[]> => {
    const [{ hops }] = await internalCache.ComponentVerticals.get([universalKey as EphemeraId])
    const fromHops = hops.flatMap((hop) => [hop.parentAssetId, hop.childAssetId])
    return dedupeSortedAssets([eventAssetId, ...fromHops])
}

/** Legacy mirroring pair load; pipeline retirement tracked in on-demand examples plan. */
export const loadAuthoritativeForMirroring = async (
    universalKey: ComponentUUID,
    eventAssetId: AssetUUID,
    mergeParticipationOrder?: readonly AssetUUID[]
): Promise<AuthoritativeComponentData> => {
    const order =
        mergeParticipationOrder ?? (await deriveMirroringParticipationOrder(universalKey, eventAssetId))
    if (order.length === 0) {
        return {
            ComponentId: universalKey as EphemeraId,
            byAssets: [],
        }
    }
    return authoritativeFromParticipationOrder(universalKey, order, internalCache.ComponentData)
}

export const loadAuthoritativeBatchForMirroring = async (
    universalKeys: ComponentUUID[],
    eventAssetId: AssetUUID,
    mergeParticipationOrder?: readonly AssetUUID[]
): Promise<AuthoritativeComponentData[]> =>
    Promise.all(
        universalKeys.map((universalKey) =>
            loadAuthoritativeForMirroring(universalKey, eventAssetId, mergeParticipationOrder)
        )
    )
