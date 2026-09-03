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
    /** PV1-3c: test seams for the phase-1 chain-reachability dissolve pass. */
    getMembershipContainers?: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>;
    getGraph?: (hostId: EphemeraMembershipHostId) => ReturnType<typeof internalCache.Positions.getLudicGraph>;
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

    const objectIds = [...objectIdSet]
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
    // A stale relational edge from a real move that classified `defer` (PV1-3's own scope cut,
    // untouched here) can be left on a room/character host an object is no longer a current
    // member of --- unreachable from membership-only BFS. This clear already knows its whole
    // universe (the game rooms and active characters just enumerated above), so hand those in as
    // extra seeds rather than relying on current membership to rediscover them.
    const extraSeedHosts: EphemeraMembershipHostId[] = [...affectedRoomIds, ...activeCharacters]
    const reachableGraphs = await fetchRelationalReachability(objectIdSet, getMembershipContainers, getGraph, undefined, extraSeedHosts)
    const chains = findRelationalChainsTouching(objectIdSet, reachableGraphs)
    // TEMPORARY diagnostic (2026-09-03): tracing a live bug where phase 1 appears not to dissolve
    // a crossing that discovery finds correctly in isolation --- remove once root-caused.
    console.log('[mtw.ephemera.objects] clearCoyoteGameImprovisationObjects phase 1 raw graphs', {
        graphs: [...reachableGraphs.entries()].map(([hostId, graph]) => ({
            hostId,
            edges: graph.relationalEdges,
            ports: graph.ports,
            nodeIds: [...graph.nodeIds],
        })),
    })
    console.log('[mtw.ephemera.objects] clearCoyoteGameImprovisationObjects phase 1 diagnostic', {
        objectIds: [...objectIdSet],
        reachableGraphHosts: [...reachableGraphs.keys()],
        chainCount: chains.length,
        chainEndpoints: chains.map((chain) => chain.map((step) => (step.type === 'edge' ? { edgeFrom: step.edge.from, edgeTo: step.edge.to, hostId: step.hostId } : { portId: step.port.portId, hostId: step.hostId }))),
    })
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
        console.log('[mtw.ephemera.objects] clearCoyoteGameImprovisationObjects phase 1 dissolveSteps', dissolveSteps)
        const dissolveResult = await commitStepSequence(
            { steps: dissolveSteps },
            {
                messageBus: bus,
                streamEvent: positionsStreamEvent,
                getCurrentHost: (id) => hostByReferencedId.get(id),
            }
        )
        console.log('[mtw.ephemera.objects] clearCoyoteGameImprovisationObjects phase 1 dissolveResult', dissolveResult)
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
