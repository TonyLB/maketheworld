import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { buildPositionAdjacencyDataCategory } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { publishLudicCacheInvalidatedStreamEvent, type PositionsPublishedPayload } from '../../publishedEvents'
import { charactersRowItemsFor } from '../../ludicCache/charactersRow'
import { roomsInvalidatedByHosts } from '../../ludicCache/roomsInvalidatedByHosts'
import { ludicCacheMarkerBumpItems } from '../../ludicCache/store'
import { EphemeraLudicGraph, graphFromMeta, hostDataCategory } from '../../ludicGraph'
import { parentHostOf } from '../../ludicGraph/presenceParent'
import { streamObjectMembershipFact } from '../membership/streamObjectMembershipFact'
import { streamMembershipFact } from '../membership/streamMembershipFact'
import { streamObjectRelationalFact } from '../relational/streamObjectRelationalFact'
import { applyStepSequenceCore } from './applyStepSequenceCore'
import { computeStepSequenceFootprint, createdHostsOf } from './computeStepSequenceFootprint'
import { factForRelationalEdge, factsForStep, isFactOfRelationalEdge, movedFactsFor } from './factsForStep'
import { membershipChangesOf } from './membershipChanges'
import type { MembershipChange } from './membershipChanges'
import type { RelationalEdgeFactSource } from './factsForStep'
import type { MutationKernelCreateComponentStep, MutationKernelStep } from './kernelStep'
import type { MutationKernelCaptures, MutationKernelCommitResult } from './types'

export type CommitStepSequenceDeps = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    getCurrentHost: (id: EphemeraLudicTerminalPrimitive) => EphemeraMembershipHostId | undefined
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
     * Character-route Migrate row: resolved character display names for any moved character, so `factsForStep` (synchronous) can build a fully-populated
     * `Character Moved` fact without fetching anything itself. Only `orchestrateCharacterMove.ts`
     * populates this today; every other caller's steps move no character, so it's a no-op.
     */
    characterNames?: ReadonlyMap<EphemeraCharacterId, string>
    /**
     * The relational edges these steps realize, for a caller that commits whole edges. Each
     * supplied edge yields one `Object Relation Changed`, streamed after every step fact, in place
     * of its steps' own: a crossing's legs all have a port endpoint and name no real pair, and a
     * one-leg chain's leg fact is skipped as the same edge. Every other relational step with
     * primitive endpoints (a move's containment strip or containment establish, in the same
     * attempt) still yields its own fact in step order. Gated by `suppressRelationalFacts` like
     * any relational fact.
     */
    relationalEdges?: readonly RelationalEdgeFactSource[]
    /**
     * Runs once the transaction has persisted, after the graph memos are seeded and before any fact
     * streams: a creating caller's own cache write-through (the rows it passed as `existenceItems`),
     * under the same cache-before-facts ordering `seedGraphMemos` follows.
     */
    afterPersist?: () => void
}

/** DynamoDB's cap on actions in one `TransactWriteItems` call. */
const TRANSACT_ACTION_LIMIT = 100

export type CommitStepSequenceTransactItem = Parameters<typeof ephemeraDB.transactWrite>[0][number]

const seedGraphMemos = (graphs: EphemeraLudicGraph[]): void => {
    for (const graph of graphs) {
        if (isEphemeraRoomId(graph.hostId)) {
            internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
            internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        }
        internalCache.Positions.set(graph)
    }
}

/**
 * Adjacency rows (`positionAdjacency#<hostId>`) for every mover whose membership changed, read from
 * the sequence's net change (`membershipChangesOf`): a `Delete` for each host it left, a `Put` for each
 * host it arrived at. Membership counts bindings, so a host that keeps another binding of the mover
 * keeps its row. Plain, unconditioned sibling items; they ride the `MultiKeyUpdate`'s `cascade`
 * because only that sees the reducer's output. The same change list drives the rooms' `LudicCache::Characters`
 * rows (`charactersRowItemsFor`), dual-written beside the room graph.
 */
const adjacencyItemsFor = (changes: readonly MembershipChange[]): CommitStepSequenceTransactItem[] => changes.flatMap(({ entityId, left, arrived }) => [
    ...left.map((hostId) => ({ Delete: { EphemeraId: entityId, DataCategory: buildPositionAdjacencyDataCategory(hostId) } })),
    ...arrived.map((hostId) => ({ Put: { EphemeraId: entityId, DataCategory: buildPositionAdjacencyDataCategory(hostId) } })),
])

/**
 * The hosts the cache should list as a mover's containers after the sequence: every host one of its
 * own committed bindings points at (none for a hostless or destroyed whole).
 */
const containersAfter = (
    entityId: EphemeraMembershipHostId,
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): EphemeraMembershipHostId[] => [...new Set(
    (graphs.get(entityId)?.presenceNodes ?? []).flatMap((node) => {
        const host = parentHostOf(node)
        return host === undefined ? [] : [host]
    })
)]

/**
 * BD-27c's unified commit entry point --- one `commitStepSequence` replaces both
 * `applyObjectSetTransfer.ts`'s and `applyObjectRelationalChangeWithTransfer.ts`'s call surface,
 * rather than two route-specific thin wrappers (splitting by route would recreate, one layer up,
 * the exact organization BD-27c exists to retire). Structurally cloned from those two kernels'
 * existing `MultiKeyUpdate`/`exponentialBackoffWrapper`/`seedGraphMemos` shape, generalized to walk
 * an arbitrary `MutationKernelStep[]` through one shared `applyStepSequenceCore` reducer body instead of
 * each kernel inlining its own.
 *
 * BD-31 interim policy: both non-`legal` verdicts from `applyStepSequenceCore`
 * (`repairable`, `stale`) and the structural throws it can raise (BD-33 host mismatch, a
 * Room/Feature departing a host, `RelationalEdgeStillReferencedError`) abort the reducer
 * identically --- collapsed into
 * one generic transact failure, matching today's two live kernels' behavior, until BD-18's
 * backtrack channel lands. The verdicts are distinguishable at the type boundary as of 2026-09-08
 * and this is the one caller that still throws the distinction away; lifting that is BD-18's, not
 * a matter of reading `outcome.verdict` here.
 *
 * Now wired to every live route: `commitAttempt` (take/drop/give, via
 * `planObjectMoveTransfer`'s dry-run-then-plan --- 3d, 2026-09-08, replacing `executeMembershipTransfer`'s
 * retired `honorDefer` mode), `executeMembershipTransfer` itself (the object-lifecycle Migrate row:
 * destroy/edit/spawn/place/drift-repair; this absorbed `applyObjectClearMembership`/
 * `applyObjectRoomMembership`/`executeObjectMove` into it, 2026-09-07),
 * `applyObjectRelationalChange` (establish/dissolve), and --- character-route
 * Migrate row --- `orchestrateCharacterMove` (navigate/connect/disconnect, via
 * `commitAndPresentStepSequence`).
 * `applyHostEffects` and its transact-item builders have no remaining callers and are retired.
 *
 * **Created hosts** (`createComponent`) have no row to fetch, so they are left out of the
 * `MultiKeyUpdate` keys; the step seeds them inside the reducer, and the wrapper's `cascade` (which
 * runs after the reducer, in the same `TransactWriteItems` call) writes each as a `Put` of the
 * step's `meta` plus its committed `ludicGraph`. `existenceItems` (a creating caller's own rows,
 * opaque here) ride the same `cascade`, so creation, its rows and its placement commit together.
 *
 * **Stale-marking.** The `cascade` also carries one marker bump per room whose stored
 * `ludicCache` the sequence can change, so the graph write and its stale-mark commit together or
 * not at all; the same room set is published afterwards as `Ludic Cache Invalidated`. The rooms
 * are resolved *before* the transact (the cascade is synchronous and cannot read ancestor graphs)
 * from the hosts the sequence writes (a capture only reads), against the pre-commit graphs. The
 * footprint already holds every host a move leaves or arrives at, and a destroyed host's pre-commit
 * graph still walks up to its former parents. A container moved between that resolution and the
 * commit gives a slightly wrong set: over-marking is harmless, and a missed room is what
 * `ludicCache/invalidationCompleteness.integration.test.ts` watches for.
 */
export const commitStepSequence = async (
    args: { steps: readonly MutationKernelStep[]; existenceItems?: readonly CommitStepSequenceTransactItem[] },
    deps: CommitStepSequenceDeps
): Promise<MutationKernelCommitResult> => {
    const { steps } = args
    if (steps.length === 0) {
        return { ok: true, beatAnchorTime: getCurrentTimestamp(), steps: [], captures: new Map() }
    }

    const transactWrite = deps.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const footprint = computeStepSequenceFootprint(steps, deps.getCurrentHost)
    const created = createdHostsOf(steps)
    const createSteps = steps.filter((step): step is MutationKernelCreateComponentStep => step.kind === 'createComponent')
    const writtenHosts = computeStepSequenceFootprint(steps.filter((step) => step.kind !== 'capture'), deps.getCurrentHost)
    let invalidatedRooms: EphemeraRoomId[]
    try {
        invalidatedRooms = await roomsInvalidatedByHosts(
            [...writtenHosts].filter((hostId) => !created.has(hostId)),
            (hostId) => internalCache.Positions.getLudicGraph(hostId as Parameters<typeof internalCache.Positions.getLudicGraph>[0])
        )
    }
    catch (error) {
        // A commit that cannot say which caches it stales must not commit.
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[mtw.ephemera.positions] commitStepSequence could not resolve invalidated rooms: ${message}`)
        return { ok: false, errorCode: 'STEP_SEQUENCE_TRANSACT_FAILED', errorMessage: message }
    }
    const movesMembership = steps.some((step) => step.kind === 'addPresenceBinding' || step.kind === 'movePresenceBinding' || step.kind === 'releasePresenceBinding' || step.kind === 'repairPresenceBinding')

    let committedGraphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph> | undefined
    // Assignment, not append --- the reducer body can run more than once under
    // `exponentialBackoffWrapper`'s retry, so this is overwritten whole on every invocation, never
    // accumulated across attempts.
    let committedCaptures: MutationKernelCaptures | undefined
    // Pre-apply snapshot, captured for fact-building only: a dissolveRelation step's endpoint can be
    // entirely removed from the footprint by a later departure (a release, then destroyComponent) in the same
    // sequence (object-lifecycle destroy), leaving it absent from every post-apply graph. `factsForStep`
    // falls back to this snapshot to re-derive that endpoint's host --- the host it actually held the
    // edge on, right before removal --- rather than throwing.
    let priorGraphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph> | undefined
    // Overwritten whole per reducer run, like `committedGraphs`.
    let destroyedHosts: EphemeraMembershipHostId[] = []

    const multiKeyItem: CommitStepSequenceTransactItem = {
        MultiKeyUpdate: {
            Keys: [...footprint]
                .filter((hostId) => !created.has(hostId))
                .map((hostId) => ({ EphemeraId: hostId, DataCategory: hostDataCategory(hostId) })),
            updateKeys: ['ludicGraph'],
            reducer: (draft: Record<string, any>) => {
                const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
                for (const hostId of footprint) {
                    if (created.has(hostId)) {
                        continue
                    }
                    const entry = Object.values(draft).find(
                        (item: any) => item.EphemeraId === hostId && item.DataCategory === hostDataCategory(hostId)
                    )
                    if (!entry) {
                        throw new Error(`commitStepSequence: MultiKeyUpdate fetch missing footprint host ${hostId}`)
                    }
                    graphs.set(hostId, graphFromMeta(entry, hostId))
                }
                priorGraphs = graphs
                destroyedHosts = []

                const outcome = applyStepSequenceCore(steps, graphs)
                if (outcome.verdict !== 'legal') {
                    // BD-31 interim: collapse repairable/stale into one generic abort. Note that
                    // this makes a `stale` verdict *terminal* --- the throw is not a
                    // `TransactionCanceledException`, so `exponentialBackoffWrapper` below does not
                    // retry it, and nothing re-fetches and re-checks. See AGENT.contract.md's
                    // "Current limitations".
                    throw new Error(
                        `commitStepSequence: step sequence no longer legal at commit time (${outcome.reasonCode}) --- stale candidate, concurrent modification detected`
                    )
                }

                // A fetched host the outcome no longer holds was destroyed: removing its draft entry
                // makes the wrapper delete the row, conditioned on the graph it read.
                for (const hostId of footprint) {
                    if (created.has(hostId) || outcome.graphs.has(hostId)) {
                        continue
                    }
                    const draftKey = Object.keys(draft).find(
                        (key) => draft[key].EphemeraId === hostId && draft[key].DataCategory === hostDataCategory(hostId)
                    )
                    if (draftKey !== undefined) {
                        delete draft[draftKey]
                    }
                    destroyedHosts.push(hostId)
                }
                for (const [hostId, graph] of outcome.graphs) {
                    // written by `cascade` below: there is no fetched row to update.
                    if (created.has(hostId)) {
                        continue
                    }
                    const entry = Object.values(draft).find(
                        (item: any) => item.EphemeraId === hostId && item.DataCategory === hostDataCategory(hostId)
                    )!
                    entry.ludicGraph = graph.toStored()
                }
                committedGraphs = new Map(outcome.graphs)
                // Capture values are already plain `EphemeraCharacterId[]`, never Immer
                // draft-backed, so a fresh `Map` copy here is enough --- no per-entry plain-copy needed.
                committedCaptures = new Map(outcome.captures)
            },
            ...((createSteps.length > 0 || movesMembership || (args.existenceItems ?? []).length > 0 || invalidatedRooms.length > 0)
                ? {
                    cascade: () => {
                        const changes = membershipChangesOf(steps, priorGraphs!, committedGraphs!)
                        const items = [
                            ...createSteps.map((step) => ({
                                Put: { ...step.meta, ludicGraph: committedGraphs!.get(step.hostId)!.toStored() },
                            })),
                            ...adjacencyItemsFor(changes),
                            ...charactersRowItemsFor(changes, committedGraphs!),
                            ...(args.existenceItems ?? []),
                            ...ludicCacheMarkerBumpItems(invalidatedRooms),
                        ]
                        const actions = items.length + footprint.size - created.size
                        if (actions > TRANSACT_ACTION_LIMIT) {
                            throw new Error(`commitStepSequence: ${actions} transact actions exceed DynamoDB's limit of ${TRANSACT_ACTION_LIMIT}`)
                        }
                        return items
                    },
                }
                : {}),
        },
    } as CommitStepSequenceTransactItem

    let persisted = false
    try {
        await exponentialBackoffWrapper(
            async () => {
                await transactWrite([multiKeyItem])
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

    if (!persisted || !committedGraphs || !committedCaptures) {
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
    for (const hostId of destroyedHosts) {
        internalCache.Positions.invalidate(hostId as Parameters<typeof internalCache.Positions.invalidate>[0])
    }
    deps.afterPersist?.()

    const changes = membershipChangesOf(steps, priorGraphs!, committedGraphs)
    for (const { entityId } of changes) {
        internalCache.Positions.setMembershipContainers({
            componentId: entityId as Parameters<typeof internalCache.Positions.setMembershipContainers>[0]['componentId'],
            containers: containersAfter(entityId, committedGraphs),
        })
    }

    const streamFact = async (fact: ReturnType<typeof factsForStep>[number] | ReturnType<typeof movedFactsFor>[number]): Promise<void> => {
        if (fact.type === 'Object Relation Changed' && (deps.relationalEdges ?? []).some((edge) => isFactOfRelationalEdge(fact, edge))) {
            return
        }
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

    // A mover's moved fact streams right after its last presence step: after the dissolve facts that
    // precede that step (BD-28), before the establish facts that follow it.
    for (const [index, step] of steps.entries()) {
        for (const fact of factsForStep(step, committedGraphs, beatAnchorTime, priorGraphs)) {
            await streamFact(fact)
        }
        for (const change of changes.filter(({ anchor }) => anchor === index)) {
            for (const fact of movedFactsFor(change, beatAnchorTime, deps.characterNames)) {
                await streamFact(fact)
            }
        }
    }

    if (!deps.suppressRelationalFacts) {
        for (const edge of deps.relationalEdges ?? []) {
            await streamObjectRelationalFact(
                factForRelationalEdge(edge, committedGraphs, beatAnchorTime, priorGraphs),
                { streamEvent: deps.streamEvent }
            )
        }
    }

    if (invalidatedRooms.length > 0) {
        await publishLudicCacheInvalidatedStreamEvent(deps.streamEvent, { type: 'Ludic Cache Invalidated', roomIds: invalidatedRooms })
    }

    for (const hostId of footprint) {
        if (isEphemeraRoomId(hostId)) {
            deps.messageBus.publish({ type: 'RoomUpdate', roomId: hostId })
        }
    }

    return { ok: true, beatAnchorTime, steps, captures: committedCaptures }
}
