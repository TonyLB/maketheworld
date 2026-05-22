import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import type { ComponentDataCache } from './componentDataCache'
import type { AuthoritativeComponentData } from './dynamoStandardComponents'

export class ParticipationBatchError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ParticipationBatchError'
    }
}

/**
 * Builds {@link AuthoritativeComponentData} from pair-addressed reads only, scoped to
 * `mergeParticipationOrder` (no partition enumerate).
 */
export async function authoritativeFromParticipationOrder(
    universalKey: ComponentUUID,
    mergeParticipationOrder: readonly AssetUUID[],
    componentData: ComponentDataCache
): Promise<AuthoritativeComponentData> {
    if (mergeParticipationOrder.length === 0) {
        throw new ParticipationBatchError('Empty merge participation order')
    }

    const byAssetMap = await componentData.getAcrossAssets(universalKey, [...mergeParticipationOrder])

    return {
        ComponentId: universalKey as EphemeraId,
        byAssets: mergeParticipationOrder.map((assetId) => ({
            AssetId: assetId,
            component: byAssetMap[assetId]!,
        })),
    }
}
