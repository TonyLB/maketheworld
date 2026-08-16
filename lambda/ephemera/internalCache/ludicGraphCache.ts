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
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../dataSource/positions/ludicGraph'

export type { MembershipContainersCacheSetParams }

/**
 * KNOWN GAP (LP0, 2026-08-16): `EphemeraMembershipHostId` was widened to admit `Object`,
 * `Feature`, and `Area` hosts, but the play-position cache gateway still only stores
 * ROOM#/CHARACTER# envelopes --- there is no Object/Feature/Area ludicGraph cache entry yet.
 * Same gap as `hostDataCategory` in `dataSource/positions/ludicGraph/index.ts`: an Object-,
 * Feature-, or Area-hosted step now type-checks through grounding, then throws here instead of
 * at `commitStepSequence`'s `MultiKeyUpdate`, whichever runs first. Loud, not silent.
 */
const assertForwardHostId = (
    hostId: EphemeraMembershipHostId
): EphemeraCharacterId | EphemeraRoomId => {
    if (isEphemeraRoomId(hostId) || isEphemeraCharacterId(hostId)) {
        return hostId
    }
    throw new Error(`Positions cache requires forward host ROOM# or CHARACTER#; got ${hostId}`)
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

export const createEphemeraLudicGraphCacheData = (db: EphemeraPositionsReadDB): EphemeraLudicGraphCacheData =>
    new EphemeraLudicGraphCacheData(db)
