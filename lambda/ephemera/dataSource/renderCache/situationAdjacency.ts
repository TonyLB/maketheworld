/**
 * Situation adjacency partition CRUD (`SITUATION#` / `Link::${host}::Cache::${perspectiveKey}`).
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    buildSituationAdjacencyDataCategory,
    EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX,
    isSituationCacheAdjacencyRow,
    type EphemeraCacheComponentId,
    type SituationCacheAdjacencyRow,
} from './baseClasses'

export async function queryAdjacencyLinksForSituation(
    situationId: EphemeraSituationId
): Promise<SituationCacheAdjacencyRow[]> {
    const raw = await ephemeraDB.query<SituationCacheAdjacencyRow>({
        Key: { EphemeraId: situationId },
        KeyConditionExpression: 'begins_with(DataCategory, :linkPrefix)',
        ExpressionAttributeValues: { ':linkPrefix': EPHEMERA_SITUATION_ADJACENCY_LINK_PREFIX },
        allFields: true,
    })
    return raw.filter(isSituationCacheAdjacencyRow)
}

export async function putSituationAdjacencyLink(row: SituationCacheAdjacencyRow): Promise<void> {
    await ephemeraDB.putItem(row)
}

export async function deleteSituationAdjacencyLink(
    situationId: EphemeraSituationId,
    hostEphemeraId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<void> {
    await ephemeraDB.deleteItem({
        EphemeraId: situationId,
        DataCategory: buildSituationAdjacencyDataCategory(hostEphemeraId, perspectiveKey),
    })
}

export async function deleteAllAdjacencyLinksForSituation(situationId: EphemeraSituationId): Promise<void> {
    const links = await queryAdjacencyLinksForSituation(situationId)
    await Promise.all(
        links.map((link) =>
            ephemeraDB.deleteItem({
                EphemeraId: link.EphemeraId,
                DataCategory: link.DataCategory,
            })
        )
    )
}

export type UpsertAdjacencyForAuthoredSliceParams = {
    situationId: EphemeraSituationId;
    hostEphemeraId: EphemeraCacheComponentId;
    perspectiveKey: string;
    assetStack: AssetUUID[];
};

/** S4: maintain adjacency when hydrate upserts an authored slice. */
export async function upsertAdjacencyForAuthoredSlice(
    params: UpsertAdjacencyForAuthoredSliceParams
): Promise<void> {
    await putSituationAdjacencyLink({
        EphemeraId: params.situationId,
        DataCategory: buildSituationAdjacencyDataCategory(params.hostEphemeraId, params.perspectiveKey),
        assetStack: [...params.assetStack],
    })
}

export type DeleteAdjacencyForRemovedSliceParams = {
    situationId: EphemeraSituationId;
    hostEphemeraId: EphemeraCacheComponentId;
    perspectiveKey: string;
};

/** S4: maintain adjacency when hydrate delete-by-absence removes a slice. */
export async function deleteAdjacencyForRemovedSlice(
    params: DeleteAdjacencyForRemovedSliceParams
): Promise<void> {
    await deleteSituationAdjacencyLink(
        params.situationId,
        params.hostEphemeraId,
        params.perspectiveKey
    )
}
