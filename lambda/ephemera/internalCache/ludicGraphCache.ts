/**
 * Ephemera invocation memo for play position graphs.
 * Wraps mtw-gateways PositionsCacheHandler; exposes EphemeraLudicGraph at the read/write boundary.
 */
import {
    createPositionsCacheHandler,
    type PositionsCacheHandler,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPositionsReadDB } from '@tonylb/mtw-gateways/ts/ephemera/positions/fetch'
import type { MembershipContainersCacheSetParams } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraAreaId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../dataSource/positions/ludicGraph'

export type { MembershipContainersCacheSetParams }

/**
 * KNOWN GAP (LP0, 2026-08-16; narrowed MK2, MK3, MK4): `EphemeraMembershipHostId` was widened to
 * admit `Object`, `Feature`, and `Area` hosts. MK2 taught this gateway about Object; MK3 taught it
 * about Feature; MK4 taught it about Area. All five host kinds now pass through --- see
 * `AGENT.membershipHostKernel.planning.md`, MK6 for retiring this comment once cleanup lands.
 */
const assertForwardHostId = (
    hostId: EphemeraMembershipHostId
): EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId => {
    if (isEphemeraRoomId(hostId) || isEphemeraCharacterId(hostId) || isEphemeraObjectId(hostId) || isEphemeraFeatureId(hostId) || isEphemeraAreaId(hostId)) {
        return hostId
    }
    throw new Error(`Positions cache requires forward host ROOM#, CHARACTER#, OBJECT#, FEATURE#, or AREA#; got ${hostId}`)
}

export class EphemeraLudicGraphCacheData {
    private readonly _gateway: PositionsCacheHandler

    constructor(db: EphemeraPositionsReadDB) {
        this._gateway = createPositionsCacheHandler(db)
    }

    async getLudicGraph(
        componentId: EphemeraMembershipHostId
    ): Promise<EphemeraLudicGraph> {
        const forwardId = assertForwardHostId(componentId)
        const envelope = await this._gateway.getLudicGraph(forwardId)
        return EphemeraLudicGraph.fromPlayEnvelope(forwardId, envelope)
    }

    set(graph: EphemeraLudicGraph): void {
        const componentId = assertForwardHostId(graph.hostId)
        this._gateway.set({
            componentId,
            graph: graph.toPlayEnvelope(),
        })
    }

    async getMembershipContainers(
        componentId: EphemeraPositionAdjacencyContainedId
    ): Promise<EphemeraMembershipHostId[]> {
        return this._gateway.getMembershipContainers(componentId)
    }

    setMembershipContainers(params: MembershipContainersCacheSetParams): void {
        this._gateway.setMembershipContainers(params)
    }

    invalidate(componentId: EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId): void {
        this._gateway.invalidate(componentId)
    }

    invalidateMembershipContainers(componentId: EphemeraPositionAdjacencyContainedId): void {
        this._gateway.invalidateMembershipContainers(componentId)
    }

    clear(): void {
        this._gateway.clear()
    }

    async flush(): Promise<void> {
        await this._gateway.flush()
    }
}

export const createEphemeraLudicGraphCacheData = (db: EphemeraPositionsReadDB): EphemeraLudicGraphCacheData =>
    new EphemeraLudicGraphCacheData(db)
