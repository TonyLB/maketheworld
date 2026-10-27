import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import internalCache from '../../internalCache'
import { ludicCacheRoomObjectHandles, type RoomObjectHandlesDeps } from '../positions/ludicCache/catalogHandles'
import { normalizeExitName } from './roomExitTargetsForCharacter'
import type { GroundedPresence } from './enrich/objectManipulation/plan/planStep'
import type { PresencePlacement } from './objectViews'

export type RoomInPlayObjectCatalogEntry = {
    objectId: EphemeraObjectId
    normalizedShortName: string
    /** Pre-attached at parse ingress via handleParseRequested (EM-6). */
    embedding?: SemanticEmbedding
    /** From the `ludicCache` node's reasoning gloss (`AGENT.concepts.md`'s `CommandAttempt` section); present only where authored or improvised. */
    gloss?: string
    /** Every place it is seen: its presence buckets, or the room it sits in directly (`GroundedPresence`). */
    presence?: GroundedPresence[]
    /** The structure `presence` is projected from (`audienceBuckets`): each own binding with the parents it sits under, which `readingsOf`/`defaultReading` (`objectViews.ts`) read. A held entry names only the part in hand (`heldPlacement`, read from the character's graph); absent, the object has no position to name. */
    placement?: PresencePlacement[]
}

export type RoomObjectCatalogForCharacter = {
    roomId: EphemeraRoomId | null
    entries: RoomInPlayObjectCatalogEntry[]
}

export type RoomObjectCatalogDeps = {
    getMembershipContainers: (characterId: EphemeraCharacterId) => Promise<string[]>
    /** Passed straight through to `ludicCacheRoomObjectHandles` (the stored-row read). */
    readLudicCache?: RoomObjectHandlesDeps['readLudicCache']
}

const defaultDeps = (): RoomObjectCatalogDeps => ({
    getMembershipContainers: (characterId) => internalCache.Positions.getMembershipContainers(characterId),
})

/**
 * Merged-layer in-room object catalog for classify, enrich, and deterministic resolve (D6).
 *
 * The candidate pool is read from the room's **stored** `ludicCache` (`catalogHandles.ts`),
 * so names are the Canon + Improvisation names every viewer shares:
 * a character's own non-Canon assets no longer rename an object here, and no perspective is
 * resolved. See this file's `AGENT.md` "Known gap" paragraph for what is (still, deliberately)
 * exhaustive rather than presence-bucket-filtered about this.
 */
export async function getRoomObjectCatalogForCharacter(
    characterId: EphemeraCharacterId,
    partialDeps: Partial<RoomObjectCatalogDeps> = {}
): Promise<RoomObjectCatalogForCharacter> {
    const deps: RoomObjectCatalogDeps = { ...defaultDeps(), ...partialDeps }
    const containers = await deps.getMembershipContainers(characterId)
    const roomId = containers[0]
    if (!roomId || !isEphemeraRoomId(roomId)) {
        return { roomId: null, entries: [] }
    }

    const handles = await ludicCacheRoomObjectHandles(roomId, { readLudicCache: deps.readLudicCache })

    const entries = handles
        .map(({ objectId, shortName, gloss, presence, placement }): RoomInPlayObjectCatalogEntry | undefined => {
            const normalizedShortName = normalizeExitName(shortName)
            if (normalizedShortName.length === 0) {
                return undefined
            }
            return {
                objectId,
                normalizedShortName,
                ...(gloss !== undefined ? { gloss } : {}),
                ...(presence !== undefined ? { presence } : {}),
                ...(placement !== undefined ? { placement } : {}),
            }
        })
        .filter((entry): entry is RoomInPlayObjectCatalogEntry => entry !== undefined)

    return { roomId, entries }
}
