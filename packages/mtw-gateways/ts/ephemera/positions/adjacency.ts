import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    EPHEMERA_POSITION_ADJACENCY_PREFIX,
    isEphemeraPositionAdjacencyRow,
    parsePositionAdjacencyDataCategory,
    type EphemeraPositionAdjacencyRow,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export {
    buildPositionAdjacencyDataCategory,
    EPHEMERA_POSITION_ADJACENCY_PREFIX,
    isEphemeraPositionAdjacencyRow,
    parsePositionAdjacencyDataCategory,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
export type { EphemeraPositionAdjacencyRow } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

export type EphemeraPositionsAdjacencyReadDB = {
    query<Item extends Record<string, unknown>>(props: {
        Key: { EphemeraId: string };
        KeyConditionExpression: string;
        ExpressionAttributeValues: Record<string, string>;
    }): Promise<Item[]>
}

export async function queryMembershipContainersFromDynamo(
    db: EphemeraPositionsAdjacencyReadDB,
    characterId: EphemeraCharacterId
): Promise<EphemeraRoomId[]> {
    const raw = await db.query<EphemeraPositionAdjacencyRow>({
        Key: { EphemeraId: characterId },
        KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
        ExpressionAttributeValues: {
            ':prefix': EPHEMERA_POSITION_ADJACENCY_PREFIX,
        },
    })
    const containers: EphemeraRoomId[] = []
    for (const row of raw) {
        if (!isEphemeraPositionAdjacencyRow(row)) {
            continue
        }
        const hostId = parsePositionAdjacencyDataCategory(row.DataCategory)
        if (hostId) {
            containers.push(hostId)
        }
    }
    return containers
}
