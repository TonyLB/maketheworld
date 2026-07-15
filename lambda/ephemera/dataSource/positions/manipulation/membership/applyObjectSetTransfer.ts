import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import { EphemeraPositionGraph, fromCharacterMeta, fromRoomMeta } from '../../positionGraph'
import { computeObjectSetTransfer } from './computeObjectSetTransfer'
import type { DropSetApplyResult, ObjectSetMembershipDiff, TakeHoldSetApplyResult } from './types'

export type ApplyObjectSetTransferDirection = 'takeHold' | 'drop'

export type ApplyObjectSetTransferArgs = {
    direction: ApplyObjectSetTransferDirection;
    objectIds: EphemeraObjectId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}

export type ApplyObjectSetTransferDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getPositionGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraPositionGraph>;
    transactWrite?: typeof ephemeraDB.transactWrite;
}

type ObjectSetTransferTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const defaultGetPositionGraph = async (hostId: EphemeraMembershipHostId): Promise<EphemeraPositionGraph> =>
    internalCache.Positions.getPositionGraph(hostId)

const hostDataCategory = (hostId: EphemeraMembershipHostId): 'Meta::Room' | 'Meta::Character' =>
    isEphemeraRoomId(hostId) ? 'Meta::Room' : 'Meta::Character'

const graphFromMeta = (meta: Record<string, unknown>, hostId: EphemeraMembershipHostId): EphemeraPositionGraph =>
    isEphemeraRoomId(hostId) ? fromRoomMeta(meta, hostId) : fromCharacterMeta(meta, hostId)

const seedGraphMemos = (graphs: EphemeraPositionGraph[]): void => {
    for (const graph of graphs) {
        if (isEphemeraRoomId(graph.hostId)) {
            internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
            internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        }
        internalCache.Positions.set(graph)
    }
}

/**
 * Object-*set*-aware take-hold/drop apply, built on `transactWrite`'s
 * `MultiKeyUpdate` request kind (Pipeline A -> B migration, Slice 3 redesign,
 * 2026-07-15) --- supersedes the `applyHostEffects` + precomputed-diff approach
 * (Slice 1) for this operation. Take-hold/drop are inherently 2-key operations
 * (departure host + arrival host); `MultiKeyUpdate` gives one reducer
 * simultaneous, freshly-fetched access to both, so it can rerun
 * `boundaryEdgeOutcomes`/internal-edge computation live at commit time and
 * reject a stale transfer candidate (built at selection time, possibly racing
 * a concurrent modification) instead of blindly applying a precomputed diff.
 * `computeObjectSetTransfer` is the shared pure function run once here (as a
 * pre-check, to fail fast and build the result diff) and again inside the
 * reducer itself (against the fetch `MultiKeyUpdate` performs at commit time).
 *
 * No `carriedEdges` parameter: internal relational edges among the transfer
 * set are derived fresh from the source graph inside the reducer, not passed
 * in --- removing the staleness risk a precomputed `HostRelationalEdgeCarry[]`
 * would otherwise carry. A `dissolve`-classified boundary edge (e.g. `tray On
 * table` when the tray leaves) needs no explicit handling --- already proven
 * (Slice 1) to self-resolve via `EphemeraPositionGraph.removeObject`'s own
 * edge-stripping.
 *
 * The paired `positionAdjacency#<hostId>` rows are built as plain, unconditioned
 * sibling `Delete`/`Put` items in the same `transactWrite` array (not via
 * `cascade`): the transfer set and both host ids are known to the caller before
 * the reducer runs, so nothing about the adjacency rows depends on the
 * reducer's computed output. If the reducer throws (stale candidate detected),
 * the whole item array's construction throws before any `TransactWriteItemsCommand`
 * is assembled, so the adjacency items never fire either.
 */
export const applyObjectSetTransfer = async (
    args: ApplyObjectSetTransferArgs,
    deps: ApplyObjectSetTransferDependencies
): Promise<TakeHoldSetApplyResult | DropSetApplyResult> => {
    const objectIds = new Set(args.objectIds)
    const fromHostId: EphemeraMembershipHostId = args.direction === 'takeHold' ? args.roomId : args.characterId
    const toHostId: EphemeraMembershipHostId = args.direction === 'takeHold' ? args.characterId : args.roomId

    if (objectIds.size === 0) {
        return { ok: true, diffs: [] }
    }

    const getPositionGraph = deps.getPositionGraph ?? defaultGetPositionGraph
    const transactWrite = deps.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    let priorSourceGraph: EphemeraPositionGraph
    let priorDestGraph: EphemeraPositionGraph
    try {
        [priorSourceGraph, priorDestGraph] = await Promise.all([
            getPositionGraph(fromHostId),
            getPositionGraph(toHostId),
        ])
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorCode: 'OBJECT_SET_TRANSFER_FETCH_FAILED', errorMessage: message }
    }

    let precheckPlan
    try {
        precheckPlan = computeObjectSetTransfer(priorSourceGraph, priorDestGraph, objectIds)
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorCode: 'OBJECT_SET_TRANSFER_VALIDATION_FAILED', errorMessage: message }
    }

    const diffs: ObjectSetMembershipDiff[] = args.objectIds.map((objectId) => ({
        objectId,
        froms: [fromHostId],
        to: toHostId,
        changed: true,
    }))

    const multiKeyItem: ObjectSetTransferTransactItem = {
        MultiKeyUpdate: {
            Keys: [
                { EphemeraId: fromHostId, DataCategory: hostDataCategory(fromHostId) },
                { EphemeraId: toHostId, DataCategory: hostDataCategory(toHostId) },
            ],
            updateKeys: ['positionGraph'],
            reducer: (draft: Record<string, any>) => {
                const fromEntry = Object.values(draft).find(
                    (item: any) => item.EphemeraId === fromHostId && item.DataCategory === hostDataCategory(fromHostId)
                )
                const toEntry = Object.values(draft).find(
                    (item: any) => item.EphemeraId === toHostId && item.DataCategory === hostDataCategory(toHostId)
                )
                if (!fromEntry || !toEntry) {
                    throw new Error('applyObjectSetTransfer: MultiKeyUpdate fetch missing an expected host item')
                }
                const sourceGraph = graphFromMeta(fromEntry, fromHostId)
                const destGraph = graphFromMeta(toEntry, toHostId)
                const freshPlan = computeObjectSetTransfer(sourceGraph, destGraph, objectIds)
                fromEntry.positionGraph = freshPlan.sourceGraph.toStored()
                toEntry.positionGraph = freshPlan.destGraph.toStored()
            },
        },
    } as ObjectSetTransferTransactItem

    const adjacencyItems: ObjectSetTransferTransactItem[] = args.objectIds.flatMap((objectId) => [
        { Delete: { EphemeraId: objectId, DataCategory: buildPositionAdjacencyDataCategory(fromHostId) } },
        { Put: { EphemeraId: objectId, DataCategory: buildPositionAdjacencyDataCategory(toHostId) } },
    ])

    // `exponentialBackoffWrapper` silently resolves to `undefined` (no throw) for a
    // non-retryable error outside DEVELOPER_MODE --- matching `applyHostEffects.ts`'s existing
    // convention, `persisted` is the only reliable signal that the transact actually committed
    // (needed here more than ever: a stale-candidate throw from the reducer is exactly the kind
    // of non-retryable failure this wrapper can swallow).
    let persisted = false
    try {
        await exponentialBackoffWrapper(
            async () => {
                await transactWrite([multiKeyItem, ...adjacencyItems])
                persisted = true
            },
            { retryErrors: ['TransactionCanceledException'] }
        )
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[mtw.ephemera.positions] applyObjectSetTransfer failed: ${message}`)
        return { ok: false, errorCode: 'OBJECT_SET_TRANSFER_TRANSACT_FAILED', errorMessage: message }
    }

    if (!persisted) {
        return {
            ok: false,
            errorCode: 'OBJECT_SET_TRANSFER_TRANSACT_FAILED',
            errorMessage: 'transactWrite did not persist (see logs)',
        }
    }

    const beatAnchorTime = getCurrentTimestamp()

    for (const diff of diffs) {
        const fact = buildObjectMovedFact({ objectId: diff.objectId, diff, beatAnchorTime })
        if (fact) {
            await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
        }
    }

    // Cache-seeding is derived from the pre-check fetch/plan, not a literal post-transaction
    // read --- consistent with applyHostEffects.ts's existing postApplyGraphs convention. A
    // legitimate concurrent write racing between the pre-check fetch and the reducer's own
    // (authoritative) fetch is a narrow, pre-existing class of cache staleness this shares with
    // that convention, not a new risk; the cache self-corrects on a subsequent read-through.
    seedGraphMemos([precheckPlan.sourceGraph, precheckPlan.destGraph])

    for (const objectId of args.objectIds) {
        internalCache.Positions.setMembershipContainers({
            componentId: objectId,
            containers: [toHostId],
        })
    }

    if (isEphemeraRoomId(fromHostId)) {
        deps.messageBus.publish({ type: 'RoomUpdate', roomId: fromHostId })
    }
    if (isEphemeraRoomId(toHostId)) {
        deps.messageBus.publish({ type: 'RoomUpdate', roomId: toHostId })
    }

    return { ok: true, diffs, beatAnchorTime }
}
