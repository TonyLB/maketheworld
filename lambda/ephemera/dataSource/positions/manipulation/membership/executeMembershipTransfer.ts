import { ephemeraLudicTerminalsEqual, isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import internalCache from '../../../../internalCache'
import { boundaryEdgeOutcomes } from '../../ludicGraph/expandValidate/interactionUnderTransfer'
import { isKernelMutationStep } from '../kernel/kernelStep'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { CommitStepSequenceDeps } from '../kernel/commitStepSequence'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'
import { presencePortStepsForMove } from '../kernel/compile/presencePortStepsForMove'
import { buildObjectMoveOp } from '../../membership/buildObjectMoveOp'
import type { MutationKernelCaptures } from '../kernel/types'
import type { HostRelationalEdge } from '../types'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { buildCrossingDissolveLegs } from '../../../actions/enrich/objectManipulation/synthesize/buildCrossingLegs'
import {
    defaultGetGraph,
    fetchRelationalReachability,
    findRelationalChainsTouching,
} from '../relational/findRelationalChainsForRemoval'

/** AB-54: the three hosting kinds, each running member -> root (LD-16). */
const HOSTING_RELATION_KINDS = new Set(['On', 'In', 'PartOf'])

export type ExecuteMembershipTransferArgs = {
    entityId: EphemeraObjectId | EphemeraCharacterId
    /** null clears the entity from every current host (destroy/edit/disconnect) --- no arrival side. */
    target: EphemeraMembershipHostId | null
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    getMembershipContainers?: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>
    /** injectable for the same reason `getMembershipContainers` is --- test seams only. */
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    /** See `CommitStepSequenceDeps.suppressRelationalFacts`'s doc comment --- same gate, same default. */
    suppressRelationalFacts?: boolean
    /**
     * When supplied, called with the resolved diff to build the committed step sequence (the
     * compiler's `[capture, transfer, capture]` shape for navigate) instead of a bare
     * `transferMembership` step. Mirrors `MembershipApplyArgs.compileMutationSteps`. Not honored
     * when `carryClosureTransfer` is set --- no caller combines the two today.
     */
    compileMutationSteps?: (diff: { froms: EphemeraMembershipHostId[]; to: EphemeraMembershipHostId | null; changed: boolean }) => readonly MutationKernelStep[]
    characterNames?: CommitStepSequenceDeps['characterNames']
    transactWrite?: CommitStepSequenceDeps['transactWrite']

    /**
     * Take/drop/give's own mode (MS-8, 2026-09-07 unification of `executeObjectMove` into this
     * function). When true, the departure boundary is swept with a **single-hop, defer-aware**
     * check --- `boundaryEdgeOutcomes` against only the (sole) departure host's own graph, refusing
     * the whole move (`ok: false`) if any boundary edge classifies `'defer'` --- instead of the
     * **chain-aware, unconditional** sweep every other caller gets (`findRelationalChainsTouching`,
     * which follows crossing ports across hosts and dissolves everything it finds, with no legality
     * concept at all). These are genuinely different mechanisms, not two spellings of one: a
     * take/drop is a player action that can be refused ("you can't take that, it's under the
     * lamp"), while an administrative reposition (navigate, room place/remove, spawn, destroy/edit,
     * drift repair) never refuses. Preserved verbatim from the pre-unification `executeObjectMove`,
     * not generalized --- only `orchestrateObjectMove` sets this flag.
     *
     * Only meaningful when `froms` (derived from `getMembershipContainers`) has exactly one member
     * and `target` is non-null. A departure with `target: null` in this mode is MS-11's still-unbuilt
     * question ("should defer apply to a departure with no destination") and is not reachable by any
     * caller today --- `orchestrateObjectMove` always supplies both a concrete `fromHostId` (via
     * `getMembershipContainers`) and a concrete `target`.
     */
    carryClosureTransfer?: boolean
    /** Correlates this move's narration slots; meaningful only with `carryClosureTransfer`. */
    bundleId?: string
    /**
     * Copy ingredients for the narrate steps (`carryClosureTransfer` only). Omit to move an object
     * without narrating (object-lifecycle moves), in which case no capture steps are compiled
     * either --- captures exist only to serve narration, so a silent move should not be locking
     * hosts to snapshot rosters nobody reads.
     */
    narration?: { characterName: string; objectShortName: string }
    /**
     * Hosting kinds only (AB-54) --- peer kinds host nothing. `carryClosureTransfer` only: any
     * rehost mints a presence port regardless, and only a hosting-kind rehost also establishes a
     * root-anchored containment edge at the destination.
     */
    containment?: 'On' | 'In' | 'PartOf'
}

export type ExecuteMembershipTransferResult =
    | {
        ok: true
        froms: EphemeraMembershipHostId[]
        to: EphemeraMembershipHostId | null
        changed: boolean
        beatAnchorTime?: number
        captures?: MutationKernelCaptures
        /** `carryClosureTransfer` only --- `orchestrateObjectMove` needs `plan.slots` to declare its message bundle. */
        plan?: CompiledPositionKernelPlan
    }
    | { ok: false; errorCode?: string; errorMessage?: string }

const defaultGetMembershipContainers = (id: EphemeraObjectId | EphemeraCharacterId): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(id)

/**
 * Single call site for every membership move --- object or character, take/drop/give, navigate,
 * room place/remove, spawn, destroy/edit, drift repair --- unified 2026-09-07 (MS-8) from
 * `executeObjectMove` (the take/drop/give path, `carryClosureTransfer`) and this function's own
 * prior narrower self (every administrative path). The four apparent behavioral differences
 * between the two predecessors --- defer-refusal, host-count/nullability, hosting-edge stripping,
 * entity kind --- were confirmed on record (MS-8) to be unbuilt corners of one general "move a
 * component" operation, not real domain boundaries, with one exception that is preserved rather
 * than merged away: see `carryClosureTransfer`'s own doc comment for why the two dissolve
 * mechanisms stay distinct.
 *
 * `executeObjectMove`'s Synthesize-executor detour (seed -> ground -> operand-expand ->
 * command-expand, solely to re-derive a one-object carry closure and call `boundaryEdgeOutcomes`
 * internally) is gone: `computeCarryClosure` has been a singleton since CD3 (2026-09-06), so
 * `boundaryEdgeOutcomes` is called directly here, the way the chain-aware path already calls
 * `findRelationalChainsTouching` directly.
 *
 * Absorbed from `applyObjectRoomMembership`/`applyObjectClearMembership`/
 * `applyCharacterRoomMembership`'s membership half (object-lifecycle Migrate row), and from
 * `executeObjectMove`/`orchestrateObjectMove`'s host-pair take/drop/give path.
 */
export const executeMembershipTransfer = async (
    args: ExecuteMembershipTransferArgs
): Promise<ExecuteMembershipTransferResult> => {
    const getMembershipContainers = args.getMembershipContainers ?? defaultGetMembershipContainers
    const getGraph = args.getGraph ?? defaultGetGraph

    const priorContainers = await getMembershipContainers(args.entityId)
    const froms = priorContainers.filter((hostId) => hostId !== args.target)
    const changed = froms.length > 0 || (args.target !== null && !priorContainers.includes(args.target))
    const diff = { froms, to: args.target, changed }

    if (!changed) {
        return { ok: true, ...diff }
    }

    if (isEphemeraObjectId(args.entityId) && args.carryClosureTransfer) {
        const [fromHostId] = froms
        if (fromHostId === undefined || args.target === null) {
            return { ok: false }
        }

        // The moved object's own containment edge into fromHostId's shard (if it was hosted there,
        // On/In/PartOf) is stripped here rather than left for the boundary check. It would otherwise
        // hit `classifyInteractionUnderTransfer`'s hosting-kind throw --- a correct invariant for
        // every other shape reaching it, but not for the mover's own edge into the host it is leaving.
        const fromGraph = await getGraph(fromHostId)
        const ownRootContainmentEdge = fromGraph.relationalEdges.find((edge) =>
            ephemeraLudicTerminalsEqual(edge.from, args.entityId)
            && ephemeraLudicTerminalsEqual(edge.to, fromGraph.rootId)
            && HOSTING_RELATION_KINDS.has(edge.kind)
        )
        const strippedFromGraph = ownRootContainmentEdge ? fromGraph.removeRelationalEdge(ownRootContainmentEdge) : fromGraph

        const outcomes = boundaryEdgeOutcomes(new Set([args.entityId]), strippedFromGraph)
        if (outcomes.some((entry) => entry.outcome === 'defer')) {
            return { ok: false }
        }

        const dissolvedEdges: HostRelationalEdge[] = [
            ...(ownRootContainmentEdge ? [ownRootContainmentEdge] : []),
            ...outcomes
                .filter((entry) => entry.outcome === 'dissolve'
                    && isEphemeraLudicTerminalPrimitive(entry.edge.from)
                    && isEphemeraLudicTerminalPrimitive(entry.edge.to))
                .map((entry) => entry.edge),
        ]

        const plan = compilePositionKernelOp(buildObjectMoveOp({
            entityId: args.entityId,
            dissolvedEdges,
            fromHostId,
            toHostId: args.target,
            bundleId: args.bundleId ?? '',
            ...(args.narration ? { narration: args.narration } : {}),
            ...(args.containment ? { containment: args.containment } : {}),
        }))

        const result = await commitStepSequence(
            { steps: plan.steps.filter(isKernelMutationStep) },
            {
                messageBus: args.messageBus,
                streamEvent: args.streamEvent,
                getCurrentHost: () => fromHostId,
            }
        )

        if (!result.ok) {
            return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
        }

        return { ok: true, ...diff, beatAnchorTime: result.beatAnchorTime, captures: result.captures, plan }
    }

    const hostByReferencedId = new Map<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>()
    const dissolveSteps: MutationKernelStep[] = []
    // chain-aware, replacing a primitive-only single-edge boundary sweep that silently
    // skipped any relational edge with a port-address endpoint (never dissolving a genuine
    // crossing on removal --- see `findRelationalChainsForRemoval.ts`'s own doc comment). A hard
    // removal unconditionally dissolves every chain touching the departing entity; there is no
    // "carry vs. defer" ambiguity the way a real move has, since nothing needs to decide where
    // the other participant ends up.
    if (isEphemeraObjectId(args.entityId)) {
        const entitySet = new Set([args.entityId])
        const graphs = await fetchRelationalReachability(entitySet, getMembershipContainers, getGraph)
        const chains = findRelationalChainsTouching(entitySet, graphs)
        chains.forEach((chain) => {
            buildCrossingDissolveLegs(chain).forEach((step) => {
                dissolveSteps.push(step)
                if (step.kind === 'dissolveRelation') {
                    if (isEphemeraLudicTerminalPrimitive(step.subjectId)) {
                        hostByReferencedId.set(step.subjectId, step.hostId)
                    }
                    if (isEphemeraLudicTerminalPrimitive(step.targetId)) {
                        hostByReferencedId.set(step.targetId, step.hostId)
                    }
                }
            })
        })
    }

    const steps: readonly MutationKernelStep[] = args.compileMutationSteps?.(diff) ?? [
        {
            kind: 'transferMembership',
            entityIds: new Set([args.entityId]),
            fromHostIds: new Set(froms),
            toHostId: args.target,
        },
        ...presencePortStepsForMove(args.entityId, froms, args.target),
    ]

    const result = await commitStepSequence(
        { steps: [...dissolveSteps, ...steps] },
        {
            messageBus: args.messageBus,
            streamEvent: args.streamEvent,
            getCurrentHost: (id) => hostByReferencedId.get(id),
            ...(args.suppressRelationalFacts !== undefined ? { suppressRelationalFacts: args.suppressRelationalFacts } : {}),
            ...(args.characterNames ? { characterNames: args.characterNames } : {}),
            ...(args.transactWrite ? { transactWrite: args.transactWrite } : {}),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] executeMembershipTransfer failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, ...diff, beatAnchorTime: result.beatAnchorTime, captures: result.captures }
}
