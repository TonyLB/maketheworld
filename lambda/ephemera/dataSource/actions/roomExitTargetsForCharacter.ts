import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ExitFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/exit'

import internalCache from '../../internalCache'
import { ensureAffordanceTopology } from '../affordanceCache/ensureAffordanceTopology'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'

export type RoomExitTargetsForCharacter = {
    fromRoomId: EphemeraRoomId | null
    /** Distinct room ids reachable via an exit from the character's current room. */
    toRoomIds: EphemeraRoomId[]
    /** Exit labels from projected topology, normalized for deterministic parse matching. */
    exits: {
        normalizedName: string
        toRoomId: EphemeraRoomId
    }[]
}

export const normalizeExitName = (name: string): string => (
    name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
)

const exitLabelFromFacetPayload = (payload: { toJSON: () => unknown; _payload?: { plain?: { toJSON: () => string } } }): string => {
    const json = payload.toJSON()
    if (typeof json === 'string') {
        return json
    }
    return payload._payload?.plain?.toJSON() ?? ''
}

/**
 * Resolves the character's current room and exit destinations from the affordance topology slice.
 *
 * D34 sync bypass: calls {@link ensureAffordanceTopology} then reads
 * `internalCache.AffordanceCache.getAffordanceRow` --- not `Affordances Requested` / publish.
 *
 * Accepted v1 limitations:
 * 1. Synchronous command path --- may await hydrate and single-flight (D36) in-process.
 * 2. No affordance publish --- navigation does not refresh other occupants' affordance headers.
 * 3. Deterministic slice only --- future LLM enrichment rows are not consulted for nav.
 */
export async function getRoomExitTargetsForCharacter(
    characterId: EphemeraCharacterId
): Promise<RoomExitTargetsForCharacter> {
    const characterMeta = await internalCache.CharacterMeta.get(characterId) || {}
    const { RoomId, assets: characterAssets = [] } = characterMeta
    if (!RoomId || !isEphemeraRoomId(RoomId)) {
        return { fromRoomId: null, toRoomIds: [], exits: [] }
    }

    const resolvedPerspective = await resolveCharacterRoomPerspectiveForRoom(RoomId, characterAssets)
    if (resolvedPerspective === null) {
        return { fromRoomId: RoomId, toRoomIds: [], exits: [] }
    }

    const { perspective, perspectiveKey } = resolvedPerspective
    await ensureAffordanceTopology({ roomId: RoomId, perspective })

    const affordanceRow = await internalCache.AffordanceCache.getAffordanceRow(RoomId, perspectiveKey)
    if (affordanceRow === undefined) {
        throw new Error(
            `AFFORDANCE_TOPOLOGY_NOT_READY: ${RoomId} at ${perspectiveKey} (call ensureAffordanceTopology first)`
        )
    }

    const exitList = new ExitFacetList(affordanceRow.topology.exits)
    const exits = exitList.items.flatMap((exitFacet) => {
        const toRoomId = exitFacet.reference.universalKey || ''
        if (!isEphemeraRoomId(toRoomId)) {
            return []
        }
        const normalizedName = normalizeExitName(exitLabelFromFacetPayload(exitFacet.payload))
        if (!normalizedName) {
            return []
        }
        return [{ normalizedName, toRoomId }]
    })
    const toRoomIds = exits.map(({ toRoomId }) => toRoomId)

    return { fromRoomId: RoomId, toRoomIds: [...new Set(toRoomIds)], exits }
}
