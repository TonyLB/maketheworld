import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { EphemeraPositionGraph, graphFromMeta, hostDataCategory } from '../../positionGraph'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import { streamMembershipFact } from '../../membership/streamMembershipFact'
import { streamObjectRelationalFact } from '../relational/streamObjectRelationalFact'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import { computeStepSequenceFootprint } from './computeStepSequenceFootprint'
import { factsForStep } from './factsForStep'
import type { MutationKernelStep } from './kernelStep'
import type { MutationKernelCommitResult } from './types'

export type CommitStepSequenceDeps = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined
    transactWrite?: typeof ephemeraDB.transactWrite
    /**
     * Object-lifecycle Migrate row: gates only the `Object Relation Changed` half of the
     * fact-streaming loop below (`Object Moved` is unaffected either way). Default `false` (facts
     * stream) --- destroy/edit leaves this unset so BD-28's originally-silent dissolution finally
     * becomes visible; a drift-consistency repair sets it `true` since its dissolves are a silent
     * internal fixup, not a player-visible event, matching the precedent already set for other
     * repair paths.
     */
    suppressRelationalFacts?: boolean
    /**
     * Character-route Migrate row: resolved character display names for any `transferMembership`
     * step's character-kind `entityIds`, so `factsForStep` (synchronous) can build a fully-populated
     * `Character Moved` fact without fetching anything itself. Only `applyCharacterRoomMembership.ts`
     * populates this today; every other caller's steps carry no character entityIds, so it's a no-op.
     */
    characterNames?: ReadonlyMap<EphemeraCharacterId, string>
}

type CommitStepSequenceTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

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
 * BD-27c's unified commit entry point --- one `commitStepSequence` replaces both
 * `applyObjectSetTransfer.ts`'s and `applyObjectRelationalChangeWithTransfer.ts`'s call surface,
 * rather than two route-specific thin wrappers (splitting by route would recreate, one layer up,
 * the exact organization BD-27c exists to retire). Structurally cloned from those two kernels'
 * existing `MultiKeyUpdate`/`exponentialBackoffWrapper`/`seedGraphMemos` shape, generalized to walk
 * an arbitrary `MutationKernelStep[]` through one shared `applyStepSequenceCore` reducer body instead of
 * each kernel inlining its own.
 *
 * BD-31 interim policy: non-`legal` verdicts from `applyStepSequenceCore` and the structural throws
 * it can raise (BD-33 host mismatch, `RelationalEdgeStillReferencedError`) both abort the reducer
 * identically --- collapsed into one generic transact failure, matching today's two live kernels'
 * behavior, until BD-18's backtrack channel lands.
 *
 * Now wired to every live route: `executeObjectTakeHold`/`executeObjectDrop` (take/drop),
 * `applyObjectRelationalChange` (establish/dissolve), the object-lifecycle Migrate row
 * (`applyObjectClearMembership`/`applyObjectRoomMembership`, destroy/edit/spawn/place/drift-repair),
 * and --- character-route Migrate row --- `applyCharacterRoomMembership` (navigate/connect/
 * disconnect). `applyHostEffects` and its transact-item builders have no remaining callers and are
 * retired.
 */
export const commitStepSequence = async (
    args: { steps: readonly MutationKernelStep[] },
    deps: CommitStepSequenceDeps
): Promise<MutationKernelCommitResult> => {
    const { steps } = args
    if (steps.length === 0) {
        return { ok: true, beatAnchorTime: getCurrentTimestamp(), steps: [] }
    }

    const transactWrite = deps.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const footprint = computeStepSequenceFootprint(steps, deps.getCurrentHost)

    let committedGraphs: Map<EphemeraMembershipHostId, EphemeraPositionGraph> | undefined
    // Pre-apply snapshot, captured for fact-building only: a dissolveRelation step's endpoint can be
    // entirely removed from the footprint by a later pure-remove transferMembership step in the same
    // sequence (object-lifecycle destroy), leaving it absent from every post-apply graph. `factsForStep`
    // falls back to this snapshot to re-derive that endpoint's host --- the host it actually held the
    // edge on, right before removal --- rather than throwing.
    let priorGraphs: Map<EphemeraMembershipHostId, EphemeraPositionGraph> | undefined

    const multiKeyItem: CommitStepSequenceTransactItem = {
        MultiKeyUpdate: {
            Keys: [...footprint].map((hostId) => ({ EphemeraId: hostId, DataCategory: hostDataCategory(hostId) })),
            updateKeys: ['positionGraph'],
            reducer: (draft: Record<string, any>) => {
                const graphs = new Map<EphemeraMembershipHostId, EphemeraPositionGraph>()
                for (const hostId of footprint) {
                    const entry = Object.values(draft).find(
                        (item: any) => item.EphemeraId === hostId && item.DataCategory === hostDataCategory(hostId)
                    )
                    if (!entry) {
                        throw new Error(`commitStepSequence: MultiKeyUpdate fetch missing footprint host ${hostId}`)
                    }
                    graphs.set(hostId, graphFromMeta(entry, hostId))
                }
                priorGraphs = graphs

                const outcome = applyStepSequenceCore(steps, graphs)
                if (outcome.verdict !== 'legal') {
                    // BD-31 interim: collapse illegal/defer into one generic abort.
                    throw new Error(
                        `commitStepSequence: step sequence no longer legal at commit time (${outcome.reasonCode}) --- stale candidate, concurrent modification detected`
                    )
                }

                for (const [hostId, graph] of outcome.graphs) {
                    const entry = Object.values(draft).find(
                        (item: any) => item.EphemeraId === hostId && item.DataCategory === hostDataCategory(hostId)
                    )!
                    entry.positionGraph = graph.toStored()
                }
                committedGraphs = new Map(outcome.graphs)
            },
        },
    } as CommitStepSequenceTransactItem

    // Adjacency rows (positionAdjacency#<hostId>) for every entity moved by a transferMembership
    // step, built as plain, unconditioned sibling items --- same convention as the two live
    // kernels (transfer set and hosts are known before the reducer runs, so nothing depends on
    // the reducer's computed output; if the reducer throws, these never fire either). A `Delete`
    // per (entityId, fromHostId) pair across every departure host; a `Put` per entityId only when
    // `toHostId` is non-null (a pure remove, e.g. destroy, has no arrival row to write).
    const adjacencyItems: CommitStepSequenceTransactItem[] = steps
        .filter((step): step is Extract<MutationKernelStep, { kind: 'transferMembership' }> => step.kind === 'transferMembership')
        .flatMap((step) =>
            [...step.entityIds].flatMap((entityId) => [
                ...[...step.fromHostIds].map((fromHostId) => ({
                    Delete: { EphemeraId: entityId, DataCategory: buildPositionAdjacencyDataCategory(fromHostId) },
                })),
                ...(step.toHostId !== null
                    ? [{ Put: { EphemeraId: entityId, DataCategory: buildPositionAdjacencyDataCategory(step.toHostId) } }]
                    : []),
            ])
        )

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
        console.error(`[mtw.ephemera.positions] commitStepSequence failed: ${message}`)
        return { ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: message }
    }

    if (!persisted || !committedGraphs) {
        return {
            ok: false,
            errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED',
            errorMessage: 'transactWrite did not persist (see logs)',
        }
    }

    const beatAnchorTime = getCurrentTimestamp()

    // Cache write-through must land before any fact streams below --- see applyObjectSetTransfer.ts's
    // matching comment on the affordance-refresh race this ordering avoids.
    seedGraphMemos([...committedGraphs.values()])

    for (const step of steps) {
        if (step.kind !== 'transferMembership') {
            continue
        }
        for (const entityId of step.entityIds) {
            internalCache.Positions.setMembershipContainers({
                componentId: entityId,
                containers: step.toHostId !== null ? [step.toHostId] : [],
            })
        }
    }

    for (const step of steps) {
        for (const fact of factsForStep(step, committedGraphs, beatAnchorTime, priorGraphs, deps.characterNames)) {
            if (fact.type === 'Object Moved') {
                await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
            }
            else if (fact.type === 'Character Moved') {
                await streamMembershipFact(fact, { streamEvent: deps.streamEvent })
            }
            else if (!deps.suppressRelationalFacts) {
                await streamObjectRelationalFact(fact, { streamEvent: deps.streamEvent })
            }
        }
    }

    for (const hostId of footprint) {
        if (isEphemeraRoomId(hostId)) {
            deps.messageBus.publish({ type: 'RoomUpdate', roomId: hostId })
        }
    }

    return { ok: true, beatAnchorTime, steps }
}
