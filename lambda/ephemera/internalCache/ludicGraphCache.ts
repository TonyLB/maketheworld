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
import {
    isEphemeraMembershipHostId,
    type EphemeraMembershipHostId,
    type EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../dataSource/positions/ludicGraph'

export type { MembershipContainersCacheSetParams }

/**
 * Refuses a graph whose host id is not a membership host (a forged or cast id): the gateway keys
 * its memo by host id, so a bad one would be cached under a key nothing reads.
 */
const assertForwardHostId = (hostId: EphemeraMembershipHostId): EphemeraMembershipHostId => {
    if (isEphemeraMembershipHostId(hostId)) {
        return hostId
    }
    throw new Error(`Positions cache requires a membership host id; got ${hostId}`)
}

export class EphemeraLudicGraphCacheData {
    private readonly _gateway: PositionsCacheHandler

    constructor(db: EphemeraPositionsReadDB) {
        this._gateway = createPositionsCacheHandler(db)
    }

    /**
     * `fromFieldPayload`/`toStored` --- the same lossless pair `commitStepSequence` reads and
     * writes through (`graphFromMeta`), so a graph round-tripping this memo keeps its `ports`,
     * `rootId` and full node list. Until 2026-09-03 this pair was `fromPlayEnvelope`/
     * `toPlayEnvelope`, which projected through the authored WML shape and emptied `ports` in
     * both directions --- invisible to every consumer, since the loss was silent and total.
     */
    async getLudicGraph(
        componentId: EphemeraMembershipHostId
    ): Promise<EphemeraLudicGraph> {
        const forwardId = assertForwardHostId(componentId)
        const payload = await this._gateway.getLudicGraph(forwardId)
        return EphemeraLudicGraph.fromFieldPayload(forwardId, payload)
    }

    set(graph: EphemeraLudicGraph): void {
        this._gateway.set({
            componentId: assertForwardHostId(graph.hostId),
            graph: graph.toStored(),
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

    invalidate(componentId: EphemeraMembershipHostId): void {
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
