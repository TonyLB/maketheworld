import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import {
    EphemeraCharacterId,
    EphemeraObjectId,
    EphemeraRoomId,
    IMPROVISATION_ASSET_ID,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import internalCache from '../../internalCache'
import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import { normalizeExitName } from './roomExitTargetsForCharacter'
import { shortNameFromComponent, shortNameFromMergedAggregate } from '../objects/objectShortName'

export type RoomInPlayObjectCatalogEntry = {
    objectId: EphemeraObjectId
    normalizedShortName: string
    /** Pre-attached at parse ingress via handleParseRequested (EM-6). */
    embedding?: SemanticEmbedding
}

export type RoomObjectCatalogForCharacter = {
    roomId: EphemeraRoomId | null
    entries: RoomInPlayObjectCatalogEntry[]
}

export type RoomObjectCatalogDeps = {
    getMembershipContainers: (characterId: EphemeraCharacterId) => Promise<string[]>
    /** Called once, to seed the walk from the room's own graph. */
    getLudicGraph: (roomId: EphemeraRoomId) => Promise<EphemeraLudicGraph>
    /**
     * Called per object by `collectNestedObjectIds` to check whether it hosts further objects.
     * Same underlying read as `getLudicGraph` (both hit `internalCache.Positions.getLudicGraph`,
     * which is host-kind-generic) --- kept as a separate, separately-typed dep rather than one
     * union-typed fetch so call sites stay unambiguous and tests can default this one to "hosts
     * nothing" (`testLudicGraph(objectId)`) without a runtime tag check in the mock.
     */
    getObjectLudicGraph: (objectId: EphemeraObjectId) => Promise<EphemeraLudicGraph>
    getCharacterAssets: (characterId: EphemeraCharacterId) => Promise<readonly string[]>
    resolvePerspective: (
        roomId: EphemeraRoomId,
        characterAssets: readonly string[]
    ) => Promise<{ assetStack: readonly string[] } | null>
    getComponentAggregate: ComponentAggregateMergedCache['get']
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

const defaultDeps = (): RoomObjectCatalogDeps => ({
    getMembershipContainers: (characterId) => internalCache.Positions.getMembershipContainers(characterId),
    getLudicGraph: (roomId) => internalCache.Positions.getLudicGraph(roomId),
    // Same call as getLudicGraph above, just id-narrowed for the object-recursion call site (see
    // RoomObjectCatalogDeps.getObjectLudicGraph).
    getObjectLudicGraph: (objectId) => internalCache.Positions.getLudicGraph(objectId),
    getCharacterAssets: async (characterId) => {
        const characterMeta = await internalCache.CharacterMeta.get(characterId)
        return characterMeta?.assets ?? []
    },
    resolvePerspective: async (roomId, characterAssets) => {
        const resolved = await resolveCharacterRoomPerspectiveForRoom(roomId, characterAssets)
        if (resolved === null) {
            return null
        }
        return { assetStack: resolved.perspective.assetStack }
    },
    getComponentAggregate: (perspectives) => internalCache.ComponentAggregate.get(perspectives),
    getImprovisationObject: (objectId) => internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
})

/**
 * Walks from a room's own object nodes into hosted objects' own `ludicGraph`s (CC3, PV1-1):
 * hosting kinds put a subordinate object in its host's own shard, so a nested object is not a
 * member of the room's graph at all --- it is only found by fetching its host's own graph.
 * `visited` terminates a cyclic hand-built fixture; `depthCap` (5, a testing bound rather than a
 * claim about real nesting depth) bounds BFS levels independently of cycles.
 */
export async function collectNestedObjectIds(
    initialIds: Iterable<EphemeraObjectId>,
    getObjectLudicGraph: RoomObjectCatalogDeps['getObjectLudicGraph'],
    depthCap = 5
): Promise<Set<EphemeraObjectId>> {
    const collected = new Set<EphemeraObjectId>(initialIds)
    const visited = new Set<EphemeraObjectId>()
    let frontier = [...initialIds]
    for (let depth = 0; depth < depthCap && frontier.length > 0; depth++) {
        const nextFrontier: EphemeraObjectId[] = []
        for (const objectId of frontier) {
            if (visited.has(objectId)) {
                continue
            }
            visited.add(objectId)
            const hostGraph = await getObjectLudicGraph(objectId)
            for (const hostedId of hostGraph.objectIds) {
                if (!collected.has(hostedId)) {
                    collected.add(hostedId)
                    nextFrontier.push(hostedId)
                }
            }
        }
        frontier = nextFrontier
    }
    return collected
}

/**
 * Merged-layer in-room object catalog for classify, enrich, and deterministic resolve (D6).
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

    const ludicGraph = await deps.getLudicGraph(roomId)
    const objectIds = [...await collectNestedObjectIds(ludicGraph.objectIds, deps.getObjectLudicGraph)]
    if (objectIds.length === 0) {
        return { roomId, entries: [] }
    }

    const characterAssets = await deps.getCharacterAssets(characterId)
    const resolvedPerspective = await deps.resolvePerspective(roomId, characterAssets)
    if (resolvedPerspective === null) {
        return { roomId, entries: [] }
    }

    const { assetStack } = resolvedPerspective
    const entries = (
        await Promise.all(objectIds.map(async (objectId): Promise<RoomInPlayObjectCatalogEntry | undefined> => {
            let shortName = await shortNameFromMergedAggregate(objectId, assetStack, deps)
            if (!shortName) {
                const pairRow = await deps.getImprovisationObject(objectId)
                shortName = shortNameFromComponent(pairRow?.component)
            }
            if (!shortName) {
                return undefined
            }
            const normalizedShortName = normalizeExitName(shortName)
            if (normalizedShortName.length === 0) {
                return undefined
            }
            return { objectId, normalizedShortName }
        }))
    ).filter((entry): entry is RoomInPlayObjectCatalogEntry => entry !== undefined)

    return { roomId, entries }
}

export function roomObjectLabelsFromCatalog(entries: readonly RoomInPlayObjectCatalogEntry[]): string[] {
    return [...new Set(entries.map(({ normalizedShortName }) => normalizedShortName))]
}
