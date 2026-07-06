/**
 * Ephemera invocation memo for play position graphs.
 * Wraps mtw-gateways PositionsCacheHandler; exposes EphemeraPositionGraph at the read/write boundary.
 */
import {
    createPositionsCacheHandler,
    type PositionsCacheHandler,
} from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPositionsReadDB } from '@tonylb/mtw-gateways/ts/ephemera/positions/fetch'
import type { MembershipContainersCacheSetParams } from '@tonylb/mtw-gateways/ts/ephemera/positions/types'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraPositionGraph } from '../dataSource/positions/positionGraph'

export type { MembershipContainersCacheSetParams }

const assertForwardHostId = (
    hostId: EphemeraMembershipHostId
): EphemeraCharacterId | EphemeraRoomId => {
    if (isEphemeraRoomId(hostId) || isEphemeraCharacterId(hostId)) {
        return hostId
    }
    throw new Error(`Positions cache set requires forward host ROOM# or CHARACTER#; got ${hostId}`)
}

export class EphemeraPositionsCacheData {
    private readonly _gateway: PositionsCacheHandler

    constructor(db: EphemeraPositionsReadDB) {
        this._gateway = createPositionsCacheHandler(db)
    }

    async getPositionGraph(
        componentId: EphemeraCharacterId | EphemeraRoomId
    ): Promise<EphemeraPositionGraph> {
        const envelope = await this._gateway.getPositionGraph(componentId)
        return EphemeraPositionGraph.fromPlayEnvelope(componentId, envelope)
    }

    set(graph: EphemeraPositionGraph): void {
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

    invalidate(componentId: EphemeraCharacterId | EphemeraRoomId): void {
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

export const createEphemeraPositionsCacheData = (db: EphemeraPositionsReadDB): EphemeraPositionsCacheData =>
    new EphemeraPositionsCacheData(db)
