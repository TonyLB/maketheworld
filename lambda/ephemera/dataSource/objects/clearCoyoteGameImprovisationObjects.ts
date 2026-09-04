import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import messageBus from '../../messageBus'
import { collectActiveCharactersInCoyoteRooms } from '../coyoteGame/utilities/collectActiveCharactersInCoyoteRooms'
import { collectNestedObjectIds } from '../actions/roomObjectCatalogForCharacter'
import type { EphemeraLudicGraph } from '../positions/ludicGraph'
import { executeMembershipTransfer } from '../positions/manipulation/membership/executeObjectMove'
import { commitStepSequence } from '../positions/manipulation/kernel/commitStepSequence'
import type { PositionsPublishedPayload } from '../positions/publishedEvents'
import { streamEventFromMessageBus as streamPositionsEventFromMessageBus } from '../positions/publishedEvents'
import {
    defaultGetGraph,
    fetchRelationalReachability,
    findRelationalChainsTouching,
} from '../positions/manipulation/relational/findRelationalChainsForRemoval'
import { buildCrossingDissolveLegs } from '../actions/enrich/objectManipulation/synthesize/buildCrossingLegs'
import type { ObjectsChangedPayload } from './events'
import { streamObjectsChangedFact } from './events'
import { persistDeleteImprovisationObject } from './persistImprovisationObject'

export type ClearCoyoteGameImprovisationObjectsArgs = {
    getGameRooms?: () => Promise<string[]>;
    getRoomLudicGraph?: (roomId: EphemeraRoomId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
    getActiveCharactersInCoyoteRooms?: () => Promise<EphemeraCharacterId[]>;
    getCharacterLudicGraph?: (characterId: EphemeraCharacterId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
    /** test seams for the phase-1 chain-reachability dissolve pass. */
    getMembershipContainers?: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>;
    getGraph?: (hostId: EphemeraMembershipHostId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
    /** Descent into object-hosted shards when collecting the removal set (nested contents). */
    getObjectLudicGraph?: (objectId: EphemeraObjectId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
}

export type ClearCoyoteGameImprovisationObjectsResult =
    | { ok: true; persisted: false; destroyedIds: [] }
    | { ok: true; persisted: true; destroyedIds: EphemeraObjectId[] }
    | { ok: false; errorMessage: string }

export type ClearCoyoteGameImprovisationObjectsDependencies = {
    messageBus?: typeof messageBus;
    positionsStreamEvent?: StreamEventFunction<PositionsPublishedPayload>;
    objectsStreamEvent?: StreamEventFunction<ObjectsChangedPayload, StreamingEventHeader>;
    applyClearMembershipImpl?: typeof executeMembershipTransfer;
    deleteObjectImpl?: typeof persistDeleteImprovisationObject;
}

const roomIdsFromMembershipFroms = (froms: readonly string[]): EphemeraRoomId[] =>
    froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))

/**
 * Orders the removal set so an object always comes before whatever hosts it.
 *
 * Phase 2 deletes each object's whole `Meta::Object` row --- its own graph included --- so a host
 * removed first takes its contents' membership with it: the nested object's own clear then has to
 * remove it from a graph whose row is gone, the commit's footprint fetch fails, and it is stranded
 * exactly as if it had never been enumerated. Discovery order alone does not give this, since the
 * nested descent appends contents *after* the room members that led to them.
 *
 * Post-order DFS over "objects hosted in this object's own graph", restricted to the removal set
 * (a host outside the batch is nothing this clear may reorder around). `visited` terminates a
 * cyclic hand-built fixture; a host's own root node is excluded, since an object does not host
 * itself.
 */
const orderNestedContentsFirst = async (
    objectIds: ReadonlySet<EphemeraObjectId>,
    getObjectLudicGraph: (objectId: EphemeraObjectId) => Promise<EphemeraLudicGraph>
): Promise<EphemeraObjectId[]> => {
    const hostedByObject = new Map<EphemeraObjectId, EphemeraObjectId[]>()
    for (const objectId of objectIds) {
        const graph = await getObjectLudicGraph(objectId)
        hostedByObject.set(
            objectId,
            [...graph.objectIds].filter((hostedId) => hostedId !== objectId && objectIds.has(hostedId))
        )
    }

    const ordered: EphemeraObjectId[] = []
    const visited = new Set<EphemeraObjectId>()
    const visit = (objectId: EphemeraObjectId): void => {
        if (visited.has(objectId)) {
            return
        }
        visited.add(objectId)
        for (const hostedId of hostedByObject.get(objectId) ?? []) {
            visit(hostedId)
        }
        ordered.push(objectId)
    }
    for (const objectId of objectIds) {
        visit(objectId)
    }
    return ordered
}

/**
 * Coyote RoadRunner clear: remove all improvisation OBJECT# from game-room and active-character graphs, delete rows, emit I4 fact.
 */
export const clearCoyoteGameImprovisationObjects = async (
    args: ClearCoyoteGameImprovisationObjectsArgs = {},
    deps: ClearCoyoteGameImprovisationObjectsDependencies = {}
): Promise<ClearCoyoteGameImprovisationObjectsResult> => {
    const getGameRooms = args.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getRoomLudicGraph = args.getRoomLudicGraph
        ?? ((roomId: EphemeraRoomId) => internalCache.Positions.getLudicGraph(roomId))
    const getActiveCharacters = args.getActiveCharactersInCoyoteRooms ?? collectActiveCharactersInCoyoteRooms
    const getCharacterLudicGraph = args.getCharacterLudicGraph
        ?? ((characterId: EphemeraCharacterId) => internalCache.Positions.getLudicGraph(characterId))
    const getObjectLudicGraph = args.getObjectLudicGraph
        ?? ((objectId: EphemeraObjectId) => internalCache.Positions.getLudicGraph(objectId))

    const bus = deps.messageBus ?? messageBus
    const positionsStreamEvent = deps.positionsStreamEvent ?? streamPositionsEventFromMessageBus(bus)
    const applyClearMembership = deps.applyClearMembershipImpl ?? executeMembershipTransfer
    const deleteObject = deps.deleteObjectImpl ?? persistDeleteImprovisationObject

    const gameRooms = await getGameRooms()
    const affectedRoomIds = gameRooms.map((roomKey) => RoomKey(roomKey) as EphemeraRoomId)

    const objectIdSet = new Set<EphemeraObjectId>()
    for (const roomId of affectedRoomIds) {
        const graph = await getRoomLudicGraph(roomId)
        for (const objectId of graph.objectIds) {
            objectIdSet.add(objectId)
        }
    }

    const activeCharacters = await getActiveCharacters()
    for (const characterId of activeCharacters) {
        const graph = await getCharacterLudicGraph(characterId)
        for (const objectId of graph.objectIds) {
            objectIdSet.add(objectId)
        }
    }

    // Room and character graphs only name their *direct* members: an object hosted On/In/PartOf
    // another object lives in that host's own shard, not the room's graph (CC3/PV1-1). Scanning
    // the two graphs above therefore misses a cup on a table entirely --- it survived the clear,
    // and then lost its host's row underneath it (2026-09-03). `collectNestedObjectIds` is the
    // existing walker for exactly this descent, already used by the room object catalog.
    //
    // This is enumeration, not a containment-cascade policy: a *total* clear of the Coyote space
    // has no "where does the cup go" question to answer, so it does not settle what a single
    // object's removal should do with its contents (still deferred).
    const nestedObjectIds = await collectNestedObjectIds(objectIdSet, getObjectLudicGraph)
    for (const objectId of nestedObjectIds) {
        objectIdSet.add(objectId)
    }

    const objectIds = await orderNestedContentsFirst(objectIdSet, getObjectLudicGraph)
    if (objectIds.length === 0) {
        return { ok: true, persisted: false, destroyedIds: [] }
    }

    // PV1-3c, phase 1: dissolve every relational chain touching *any* object in the whole batch,
    // in one atomic transact, before removing anything. Front-loading this means a failure here
    // leaves nothing touched (clean failure, not a partial clear); a success guarantees phase 2's
    // removals below are edge-free regardless of per-object processing order --- the two failure
    // modes this row fixes (a leftover crossing aborting the whole clear, or a silently orphaned
    // port left on a removed host's own graph) both stemmed from that ordering dependency.
    const getMembershipContainers = args.getMembershipContainers
        ?? ((id: EphemeraObjectId | EphemeraCharacterId) => internalCache.Positions.getMembershipContainers(id))
    const getGraph = args.getGraph ?? defaultGetGraph
    const reachableGraphs = await fetchRelationalReachability(objectIdSet, getMembershipContainers, getGraph)
    const chains = findRelationalChainsTouching(objectIdSet, reachableGraphs)
    if (chains.length > 0) {
        const dissolveSteps = chains.flatMap((chain) => buildCrossingDissolveLegs(chain))
        const hostByReferencedId = new Map<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>()
        for (const step of dissolveSteps) {
            if (step.kind !== 'dissolveRelation') {
                continue
            }
            if (isEphemeraLudicTerminalPrimitive(step.subjectId)) {
                hostByReferencedId.set(step.subjectId, step.hostId)
            }
            if (isEphemeraLudicTerminalPrimitive(step.targetId)) {
                hostByReferencedId.set(step.targetId, step.hostId)
            }
        }
        const dissolveResult = await commitStepSequence(
            { steps: dissolveSteps },
            {
                messageBus: bus,
                streamEvent: positionsStreamEvent,
                getCurrentHost: (id) => hostByReferencedId.get(id),
            }
        )
        if (!dissolveResult.ok) {
            return { ok: false, errorMessage: dissolveResult.errorMessage }
        }
    }

    for (const objectId of objectIds) {
        const membershipResult = await applyClearMembership({
            entityId: objectId,
            target: null,
            messageBus: bus,
            streamEvent: positionsStreamEvent,
        })
        if (!membershipResult.ok) {
            return { ok: false, errorMessage: membershipResult.errorMessage ?? `executeMembershipTransfer failed for ${objectId}` }
        }

        const deleteAffectedRoomIds = [
            ...new Set([
                ...affectedRoomIds,
                ...roomIdsFromMembershipFroms(membershipResult.froms),
            ]),
        ]

        const deleteResult = await deleteObject({ objectId, affectedRoomIds: deleteAffectedRoomIds })
        if (!deleteResult.ok) {
            return { ok: false, errorMessage: deleteResult.errorMessage }
        }
    }

    if (deps.objectsStreamEvent) {
        const streamKey = objectIds[0] ?? affectedRoomIds[0]
        await streamObjectsChangedFact({
            streamEvent: deps.objectsStreamEvent,
            streamKey,
            createdIds: [],
            destroyedIds: objectIds,
        })
    }

    return { ok: true, persisted: true, destroyedIds: objectIds }
}
