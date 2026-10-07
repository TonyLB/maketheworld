import { v4 as uuidv4 } from 'uuid'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { ActionsPublishedPayload } from '../../actions/publishedEvents'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { CommandAttempt } from '../../actions/commandAttempt'
import type { NarrationUnit } from '../../actions/commandAttempt/narrationUnit'
import type {
    DissolveRelationChange,
    EstablishRelationChange,
    GroundedId,
    GroundedReferent,
    TransferMembershipChange,
} from '../../actions/enrich/objectManipulation/plan/planStep'
import { buildReferentAssignment, type DerivedReferentResolver } from '../../actions/enrich/objectManipulation/synthesize/buildReferentAssignment'
import { groundChange } from '../../actions/enrich/objectManipulation/synthesize/groundChange'
import { commitAndPresentStepSequence } from './kernel/commitAndPresentStepSequence'
import { CAPTURE_ID_TO, captureIdForFrom, objectMoveVerb, type CompiledPositionKernelPlan } from './kernel/compile/compilePositionKernelOp'
import type { RelationalEdgeFactSource } from './kernel/factsForStep'
import { isKernelMutationStep } from './kernel/kernelStep'
import type { TemplateNarrationSpec } from './kernel/kernelStep'
import { dryRunStepSequence } from './kernel/dryRunStepSequence'
import { planObjectMoveTransfer } from './membership/planObjectMoveTransfer'
import { planRelationalEdgeTransfer } from './relational/planRelationalEdgeTransfer'
import { defaultTransferMembershipParts } from './kernel/narrationTemplate'
import { deliverNarrationUnits } from './deliverNarrationUnits'
import { resolveObjectMovePresentationLabels } from '../../perception/resolveObjectMovePresentationLabels'
import { edgesMatch, type HostRelationalEdge } from '../ludicGraph'
import type { MutationKernelStep } from './kernel/kernelStep'
import { edgeKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/** An attempt's commit never includes a `describe` step of its own --- same noop as navigate's/object-move's. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type CommitAttemptArgs = {
    attempt: CommandAttempt
    characterId: EphemeraCharacterId
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
}

/**
 * What `buildMembershipFragment` already knows and the bridge-unit sweep needs again: the
 * action it narrates, the entity it moved, and the two hosts whose captures (already compiled
 * by `compilePositionKernelOp`, unaffected by narrate steps leaving it) the bridge's audiences
 * resolve to. `AGENT.attemptNarration.planning.md`, slice 3's "Narration units on
 * `CommandAttempt`" --- bridge resolution is special-cased on these known hosts, not the general
 * referent -> presence -> room resolver (AN-7 stage 2, not built yet).
 */
type MembershipBridgeInfo = {
    actionId: string
    entityId: EphemeraObjectId
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
    actorName: string
    objectLabel: string
}

type ActionFragment = {
    steps: CompiledPositionKernelPlan['steps']
    slots: CompiledPositionKernelPlan['slots']
    relationalEdge?: RelationalEdgeFactSource
    membershipBridge?: MembershipBridgeInfo
}

/**
 * Positions' snapshot for grounding's derived half, read once per attempt after the hand-off:
 * the current host of the acting character and of every thing the attempt refers to, each
 * kept only when it is in exactly one host (zero or several is not knowable here, and a step
 * depending on it drops). Also serves membership's drift check below.
 */
const readLiveHosts = async (
    attempt: CommandAttempt,
    characterId: EphemeraCharacterId
): Promise<ReadonlyMap<GroundedId, EphemeraMembershipHostId>> => {
    const ids = [...new Set<GroundedId>([characterId, ...attempt.referents().map(({ id }) => id)])]
        .filter((id): id is EphemeraPositionAdjacencyContainedId =>
            isEphemeraCharacterId(id) || isEphemeraObjectId(id) || isEphemeraFeatureId(id) || isEphemeraRoomId(id))
    const entries = await Promise.all(ids.map(async (id) => [id, await internalCache.Positions.getMembershipContainers(id)] as const))
    return new Map(entries.flatMap(([id, hosts]) => (hosts.length === 1 ? [[id, hosts[0]!] as const] : [])))
}

/**
 * Membership's half of `commitAttempt`'s per-action dispatch, given a step `commitAttempt`
 * has already grounded: checks the object's live host still matches the grounded `from` (a
 * drift/race no-op, as are zero or multiple current containers --- not repaired here),
 * resolves presentation labels, and builds (not commits) the plan via the existing
 * `planObjectMoveTransfer`.
 *
 * `roomId` for presentation is the acting character's live room, not either endpoint: a take
 * from a table moves between two non-Room hosts.
 */
const buildMembershipFragment = async (
    actionId: string,
    change: TransferMembershipChange<GroundedReferent>,
    liveHosts: ReadonlyMap<GroundedId, EphemeraMembershipHostId>,
    args: CommitAttemptArgs,
    bundleId: string
): Promise<ActionFragment | undefined> => {
    const entityId = change.object.groundedId
    const fromHostId = change.from.groundedId as EphemeraMembershipHostId
    const toHostId = change.to.groundedId as EphemeraMembershipHostId
    if (!isEphemeraObjectId(entityId)) {
        return undefined
    }
    // Already held (a take of something picked up since the dry run, or a drop of something
    // already put down): refused, with its own message, not silently skipped.
    if (liveHosts.get(entityId) === toHostId) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action refused: ${entityId} is already on ${toHostId}`)
        return undefined
    }
    if (liveHosts.get(entityId) !== fromHostId) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action refused: ${entityId} is no longer on ${fromHostId}`)
        return undefined
    }
    if (fromHostId === toHostId) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action refused: ${entityId} is grounded as moving from ${fromHostId} to itself`)
        return undefined
    }

    const roomId = liveHosts.get(args.characterId)
    if (roomId === undefined || !isEphemeraRoomId(roomId)) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action refused: ${args.characterId} is not in exactly one room`)
        return undefined
    }

    const { characterName, objectShortName } = await resolveObjectMovePresentationLabels({
        characterId: args.characterId,
        objectId: entityId,
        roomId,
    })

    const planResult = await planObjectMoveTransfer({
        entityId,
        fromHostId,
        toHostId,
        bundleId,
        narration: { actorName: characterName, labels: { [entityId]: objectShortName } },
        // Containment: `planObjectMoveTransfer`/`buildObjectMoveOp`/
        // `compilePositionKernelOp` already thread this through to the establish step whose
        // `hostId` is always `toHostId` by construction --- no ancestry walk needed.
        ...(change.containment ? { containment: change.containment } : {}),
    })

    if (!planResult.ok) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action refused: ${planResult.errorCode}`)
        return undefined
    }

    return {
        steps: planResult.plan.steps,
        slots: planResult.plan.slots,
        membershipBridge: {
            actionId,
            entityId,
            fromHostId,
            toHostId,
            actorName: characterName,
            objectLabel: objectShortName,
        },
    }
}

/** True when an establish step's exact edge is already on its carried host (the same match the graph's own `add` patch uses). */
const isEdgeAlreadyPresent = async (steps: MutationKernelStep[]): Promise<boolean> => {
    for (const step of steps) {
        if (step.kind !== 'establishRelation') {
            continue
        }
        const graph = await internalCache.Positions.getLudicGraph(step.hostId)
        const observed = { from: step.subjectId, to: step.targetId, ...edgeKindAndLabelFrom(step) } as HostRelationalEdge
        if (graph.relationalEdges.some((edge) => edgesMatch(edge, observed))) {
            return true
        }
    }
    return false
}

const buildRelationalFragment = async (
    change: EstablishRelationChange<GroundedReferent> | DissolveRelationChange<GroundedReferent>
): Promise<ActionFragment | undefined> => {
    const planResult = await planRelationalEdgeTransfer(change)
    if (!planResult.ok) {
        console.error(`[mtw.ephemera.positions] commitAttempt: relational action refused (${planResult.errorCode}): ${planResult.errorMessage}`)
        return undefined
    }
    const subjectId = change.subject.groundedId
    const targetId = change.target.groundedId
    if (!isEphemeraObjectId(subjectId) || !isEphemeraObjectId(targetId)) {
        return undefined
    }
    // A duplicate establish (the exact edge already on its host) is refused, not skipped: the
    // graph patch would be idempotent, but the attempt would still narrate a relation that
    // did not newly form.
    if (change.primitive === 'establishRelation' && await isEdgeAlreadyPresent(planResult.steps)) {
        console.error(`[mtw.ephemera.positions] commitAttempt: relational action refused: ${subjectId} ${change.relationKind} ${targetId} is already present`)
        return undefined
    }
    const relationalEdge: RelationalEdgeFactSource = {
        subjectId,
        targetId,
        operation: change.primitive === 'establishRelation' ? 'establish' : 'dissolve',
        ...(change.relationKind === 'Custom'
            ? { relationKind: 'Custom' as const, relationLabel: change.relationLabel }
            : { relationKind: change.relationKind }),
    }
    return { steps: planResult.steps, slots: [], relationalEdge }
}

/**
 * The object family's bridge unit (`AGENT.attemptNarration.planning.md`, slice 3): the old
 * take/drop/give copy, represented as a `NarrationUnit` rather than baked into compiled narrate
 * steps. Deleted once an author covers object moves (slice 4) --- this function, not a floor,
 * grows no new verbs. Both variants share one template, same as the compiler used to render it
 * on both bracket sides: there is no `direction` to the sentence, only to which side has anyone
 * to hear it.
 */
const buildMembershipBridgeUnit = (bridge: MembershipBridgeInfo): NarrationUnit => {
    const template: TemplateNarrationSpec = {
        kind: 'template',
        parts: defaultTransferMembershipParts(objectMoveVerb([bridge.fromHostId], bridge.toHostId), bridge.entityId),
        actorName: bridge.actorName,
        labels: { [bridge.entityId]: bridge.objectLabel },
    }
    return {
        covers: [bridge.actionId],
        variants: [
            { audience: { refs: [bridge.entityId], phase: 'before' }, template },
            { audience: { refs: [bridge.entityId], phase: 'after' }, template },
        ],
    }
}

/**
 * Unit delivery order is the attempt's own action order (AN-4): walks the attempt's actions once,
 * and for each, delivers whichever unit covers it --- an author's unit (none exist yet) the first
 * time any of its covered actions is reached, else a membership action's own bridge unit. An
 * action neither covers (an uncovered relational action) narrates nothing: there is no relational
 * bridge.
 */
const orderNarrationUnitsForDelivery = (
    attempt: CommandAttempt,
    membershipBridges: readonly MembershipBridgeInfo[]
): NarrationUnit[] => {
    const unitForActionId = new Map<string, NarrationUnit>()
    for (const unit of attempt.narrationUnits()) {
        for (const id of unit.covers) {
            unitForActionId.set(id, unit)
        }
    }
    const bridgeByActionId = new Map(membershipBridges.map((bridge) => [bridge.actionId, bridge] as const))

    const delivered: NarrationUnit[] = []
    const alreadyDelivered = new Set<NarrationUnit>()
    for (const action of attempt.actions()) {
        const authored = unitForActionId.get(action.id)
        if (authored) {
            if (!alreadyDelivered.has(authored)) {
                alreadyDelivered.add(authored)
                delivered.push(authored)
            }
            continue
        }
        const bridge = bridgeByActionId.get(action.id)
        if (bridge) {
            delivered.push(buildMembershipBridgeUnit(bridge))
        }
    }
    return delivered
}

/**
 * The generic per-attempt commit path: dispatches each action by its `desiredResult`'s
 * primitive, re-expanding it against live state (membership via `planObjectMoveTransfer`,
 * relational via `planRelationalEdgeTransfer`), concatenates every action's resulting kernel
 * steps into one sequence in the attempt's own action order, and commits the whole attempt in
 * one `commitAndPresentStepSequence` call --- one `transactWrite`, not one per action. An action
 * with no `desiredResult` (Describe's narration) contributes nothing.
 *
 * All-or-nothing: an action that cannot be built against live state (drift, a take already held,
 * zero or several containers, a planner refusal) refuses the whole attempt with its own log line,
 * and nothing is written, including the siblings that could have been built.
 *
 * Positions honors the attempt and does not judge it. It commits only an attempt whose result
 * has succeeded: a challenge still pending (a pending exit-contact or peer-move challenge can remain) or
 * refused is not a permission to dissolve its edge.
 *
 * The attempt's actions are the only source of a move's facilitating dissolves: a take of a
 * lashed rope carries its own dissolve action, listed before the take, and membership's
 * fragment adds only the mover's own containment strip. Before committing, the combined
 * sequence is dry-run against a fresh snapshot. A boundary edge that no action covers ---
 * the world changed since the actions-side dry run, or a transfer whose expansion missed an edge ---
 * comes back `repairable` with its own reason code, and the
 * attempt is refused rather than repaired. `commitStepSequence` still re-checks under lock.
 */
export const commitAttempt = async (args: CommitAttemptArgs): Promise<void> => {
    const { attempt, characterId } = args
    const { result } = attempt
    if (result.status !== 'succeeded') {
        console.error(`[mtw.ephemera.positions] commitAttempt: attempt not committed: its result is ${result.status}`)
        return
    }
    // Minted once, up front --- a membership fragment's narrate steps bake this id in at
    // build time (`compilePositionKernelOp`), and the bundle must be declared under the
    // same id at commit time or its narration orphans (see this file's own note on
    // `commitAndPresentStepSequence`'s call below).
    const bundleId = uuidv4()

    // The span half travels on the attempt's referents; the derived half is rebuilt
    // here, against live state, for every action alike (a relational step, published fully
    // grounded, passes through unchanged).
    const spans = new Map(attempt.referents().map(({ refKey, id }) => [refKey, id]))
    const liveHosts = await readLiveHosts(attempt, characterId)
    const resolver: DerivedReferentResolver = {
        actingCharacter: characterId,
        currentHost: (id) => liveHosts.get(id),
    }

    // All-or-nothing: one action that cannot be built refuses the whole attempt, so nothing is
    // written for its siblings either (`[dissolve lashing, take rope]` must not untie the rope
    // when the take is refused).
    const fragments: ActionFragment[] = []
    for (const action of attempt.actions()) {
        const desiredResult = action.desiredResult
        if (desiredResult === undefined || desiredResult.kind !== 'change') {
            continue
        }
        const assignment = buildReferentAssignment(desiredResult, spans, resolver)
        if (assignment === undefined) {
            console.error(`[mtw.ephemera.positions] commitAttempt: attempt refused: ${desiredResult.primitive} action has a derived referent not resolvable against live state`)
            return
        }
        const change = groundChange(desiredResult, assignment)
        const fragment = change.primitive === 'transferMembership'
            ? await buildMembershipFragment(action.id, change, liveHosts, args, bundleId)
            : await buildRelationalFragment(change)
        if (fragment === undefined) {
            console.error(`[mtw.ephemera.positions] commitAttempt: attempt refused: ${change.primitive} action could not be built`)
            return
        }
        fragments.push(fragment)
    }

    const steps = fragments.flatMap((fragment) => fragment.steps)
    if (steps.length === 0) {
        return
    }
    const slots = fragments.flatMap((fragment) => fragment.slots)
    const relationalEdges = fragments.flatMap((fragment) => (fragment.relationalEdge ? [fragment.relationalEdge] : []))
    const membershipBridges = fragments.flatMap((fragment) => (fragment.membershipBridge ? [fragment.membershipBridge] : []))

    // Mirrors `executeEstablishEdgeChain`'s own resolver: every relational
    // step already carries its own `hostId`, so no live lookup is needed to answer
    // `computeStepSequenceFootprint`'s question for a relational endpoint. `transferMembership`
    // steps never call this (their hosts are already on the step itself), so this map only
    // ever needs relational entries, combined-attempt or not.
    const hostByReferencedId = new Map<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>()
    for (const step of steps) {
        if (step.kind !== 'establishRelation' && step.kind !== 'dissolveRelation') {
            continue
        }
        if (isEphemeraLudicTerminalPrimitive(step.subjectId)) {
            hostByReferencedId.set(step.subjectId, step.hostId)
        }
        if (isEphemeraLudicTerminalPrimitive(step.targetId)) {
            hostByReferencedId.set(step.targetId, step.hostId)
        }
    }

    const getCurrentHost = (id: EphemeraLudicTerminalPrimitive) => hostByReferencedId.get(id)
    const dryRun = await dryRunStepSequence(steps.filter(isKernelMutationStep), { getCurrentHost })
    if (dryRun.verdict !== 'legal') {
        console.error(`[mtw.ephemera.positions] commitAttempt: attempt refused (${dryRun.verdict}: ${dryRun.reasonCode})`)
        return
    }

    const commitResult = await commitAndPresentStepSequence(
        { steps, slots },
        bundleId,
        characterId,
        {
            commit: {
                messageBus: args.messageBus,
                streamEvent: args.streamEvent,
                getCurrentHost,
                ...(relationalEdges.length > 0 ? { relationalEdges } : {}),
            },
            perceive: { streamEvent: noopActionsStreamEvent, messageBus: args.messageBus },
        }
    )

    if (!commitResult.ok) {
        return
    }

    // The attempt's only narration delivery path (AN-4): an authored unit (none exist yet) and
    // every uncovered membership action's bridge unit, in the attempt's own action order.
    const unitsToDeliver = orderNarrationUnitsForDelivery(attempt, membershipBridges)
    if (unitsToDeliver.length === 0) {
        return
    }
    const hostsByActionId = new Map(
        membershipBridges.map((bridge) => [bridge.actionId, { fromHostId: bridge.fromHostId, toHostId: bridge.toHostId }] as const)
    )
    deliverNarrationUnits({
        units: unitsToDeliver,
        captures: commitResult.captures,
        bundleId,
        messageBus: args.messageBus,
        resolveCaptureId: (unit, audience) => {
            const hosts = hostsByActionId.get(unit.covers[0]!)
            if (hosts === undefined) {
                throw new Error(
                    `commitAttempt: narration unit covering '${unit.covers[0]}' has no bridge host mapping --- audience resolution for authored narration units is not built yet (AN-7 stage 2)`
                )
            }
            return audience.phase === 'before' ? captureIdForFrom(hosts.fromHostId) : CAPTURE_ID_TO
        },
    })
}
