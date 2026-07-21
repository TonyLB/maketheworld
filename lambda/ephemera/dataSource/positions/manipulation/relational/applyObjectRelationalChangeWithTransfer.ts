import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
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
import { EphemeraPositionGraph, graphFromMeta, hostDataCategory } from '../../positionGraph'
import { applyTransferSet } from '../../positionGraph/expandValidate/applyTransferSet'
import { buildObjectRelationalFact } from './buildObjectRelationalFact'
import { streamObjectRelationalFact } from './streamObjectRelationalFact'
import type { RelationalApplyResult, RelationalIngressArgs } from './types'

export type ApplyObjectRelationalChangeWithTransferArgs = RelationalIngressArgs & {
    /** Where the subject currently is --- always distinct from `hostId`, per `expandSameHost`'s `repaired` verdict contract. */
    transferFromHostId: EphemeraMembershipHostId
}

export type ApplyObjectRelationalChangeWithTransferDependencies = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    transactWrite?: typeof ephemeraDB.transactWrite
}

type RelationalTransferTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

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
 * BD-16 `repaired`-verdict compound apply (2026-07-21): bundles the
 * `transferMembership` `expandSameHost` inserted with the `establishRelation`/
 * `dissolveRelation` itself into one `transactWrite`, mirroring
 * `applyObjectSetTransfer.ts`'s `MultiKeyUpdate` pattern (re-running
 * `applyTransferSet` live at commit time against freshly-fetched graphs,
 * rather than trusting the compile-time simulation `compileRelationalFromSkeleton.ts`
 * used to select this candidate). The relation always lands on the transfer's
 * *destination* host (`expandSameHost`'s `repaired.hostId === objectHost`), so
 * this only ever touches two host keys --- same shape as `applyObjectSetTransfer`,
 * plus one relational-edge write folded into the same reducer. On any failure
 * (stale transfer candidate, illegal transfer, or a `sameHost`/legality check
 * that no longer holds), the whole transact aborts: no partial fact streams.
 */
export const applyObjectRelationalChangeWithTransfer = async (
    args: ApplyObjectRelationalChangeWithTransferArgs,
    deps: ApplyObjectRelationalChangeWithTransferDependencies
): Promise<RelationalApplyResult> => {
    const fromHostId = args.transferFromHostId
    const toHostId = args.hostId

    const transactWrite = deps.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    let committedGraphs: { sourceGraph: EphemeraPositionGraph; destGraph: EphemeraPositionGraph } | undefined

    const multiKeyItem: RelationalTransferTransactItem = {
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
                    throw new Error('applyObjectRelationalChangeWithTransfer: MultiKeyUpdate fetch missing an expected host item')
                }

                const sourceGraph = graphFromMeta(fromEntry, fromHostId)
                const destGraph = graphFromMeta(toEntry, toHostId)

                if (!sourceGraph.objectIds.has(args.subjectId)) {
                    throw new Error(
                        `applyObjectRelationalChangeWithTransfer: object ${args.subjectId} not present on source host ${fromHostId} --- stale repair candidate`
                    )
                }
                if (destGraph.objectIds.has(args.subjectId)) {
                    throw new Error(
                        `applyObjectRelationalChangeWithTransfer: object ${args.subjectId} already present on destination host ${toHostId} --- stale repair candidate`
                    )
                }

                const transferOutcome = applyTransferSet(sourceGraph, destGraph, new Set([args.subjectId]))
                if (transferOutcome.verdict !== 'legal') {
                    throw new Error(
                        `applyObjectRelationalChangeWithTransfer: transfer no longer legal (${transferOutcome.reasonCode}) --- stale repair candidate, concurrent modification detected`
                    )
                }

                const relatedDestGraph = transferOutcome.destGraph.applyRelationalPatch({
                    hostId: toHostId,
                    edge: {
                        from: args.subjectId,
                        to: args.targetId,
                        kind: args.relationKind,
                        ...(args.relationLabel !== undefined ? { relationLabel: args.relationLabel } : {}),
                    },
                    op: args.operation === 'establish' ? 'add' : 'remove',
                })

                fromEntry.positionGraph = transferOutcome.sourceGraph.toStored()
                toEntry.positionGraph = relatedDestGraph.toStored()
                committedGraphs = { sourceGraph: transferOutcome.sourceGraph, destGraph: relatedDestGraph }
            },
        },
    } as RelationalTransferTransactItem

    const adjacencyItems: RelationalTransferTransactItem[] = [
        { Delete: { EphemeraId: args.subjectId, DataCategory: buildPositionAdjacencyDataCategory(fromHostId) } },
        { Put: { EphemeraId: args.subjectId, DataCategory: buildPositionAdjacencyDataCategory(toHostId) } },
    ]

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
        console.error(`[mtw.ephemera.positions] applyObjectRelationalChangeWithTransfer failed: ${message}`)
        return { ok: false, errorCode: 'RELATIONAL_TRANSFER_TRANSACT_FAILED', errorMessage: message }
    }

    if (!persisted || !committedGraphs) {
        return {
            ok: false,
            errorCode: 'RELATIONAL_TRANSFER_TRANSACT_FAILED',
            errorMessage: 'transactWrite did not persist (see logs)',
        }
    }

    const beatAnchorTime = getCurrentTimestamp()

    // Cache write-through must land before either fact streams below --- see
    // applyObjectSetTransfer.ts's matching comment on the same race.
    seedGraphMemos([committedGraphs.sourceGraph, committedGraphs.destGraph])
    internalCache.Positions.setMembershipContainers({ componentId: args.subjectId, containers: [toHostId] })

    const movedFact = buildObjectMovedFact({
        objectId: args.subjectId,
        diff: { froms: [fromHostId], to: toHostId, changed: true },
        beatAnchorTime,
    })
    if (movedFact) {
        await streamObjectMembershipFact(movedFact, { streamEvent: deps.streamEvent })
    }

    const relationalFact = buildObjectRelationalFact({
        subjectId: args.subjectId,
        targetId: args.targetId,
        hostId: toHostId,
        relationKind: args.relationKind,
        relationLabel: args.relationLabel,
        operation: args.operation,
        beatAnchorTime,
    })
    await streamObjectRelationalFact(relationalFact, { streamEvent: deps.streamEvent })

    if (isEphemeraRoomId(fromHostId)) {
        deps.messageBus.publish({ type: 'RoomUpdate', roomId: fromHostId })
    }
    if (isEphemeraRoomId(toHostId)) {
        deps.messageBus.publish({ type: 'RoomUpdate', roomId: toHostId })
    }

    return { ok: true, changed: true, beatAnchorTime }
}
