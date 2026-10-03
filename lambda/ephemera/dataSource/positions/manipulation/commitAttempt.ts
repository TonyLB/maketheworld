import { v4 as uuidv4 } from 'uuid'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import internalCache from '../../../internalCache'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { ActionsPublishedPayload } from '../../actions/publishedEvents'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { CommandAttempt } from '../../actions/commandAttempt'
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
import type { CompiledPositionKernelPlan } from './kernel/compile/compilePositionKernelOp'
import type { RelationalEdgeFactSource } from './kernel/factsForStep'
import type { KernelStep } from './kernel/kernelStep'
import { planObjectMoveTransfer } from './membership/planObjectMoveTransfer'
import { planRelationalEdgeTransfer } from './relational/planRelationalEdgeTransfer'
import { resolveObjectMovePresentationLabels } from '../../perception/resolveObjectMovePresentationLabels'

/** An attempt's commit never includes a `describe` step of its own --- same noop as navigate's/object-move's. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type CommitAttemptArgs = {
    attempt: CommandAttempt
    characterId: EphemeraCharacterId
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
}

type ActionFragment = {
    steps: CompiledPositionKernelPlan['steps']
    slots: CompiledPositionKernelPlan['slots']
    relationalEdge?: RelationalEdgeFactSource
}

const emptyFragment: ActionFragment = { steps: [], slots: [] }

/**
 * Positions' snapshot for AP-10's derived half, read once per attempt after the hand-off:
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
    change: TransferMembershipChange<GroundedReferent>,
    liveHosts: ReadonlyMap<GroundedId, EphemeraMembershipHostId>,
    args: CommitAttemptArgs,
    attemptMetEdges: ReturnType<CommandAttempt['metPropagations']>,
    bundleId: string
): Promise<ActionFragment | undefined> => {
    const entityId = change.object.groundedId
    const fromHostId = change.from.groundedId as EphemeraMembershipHostId
    const toHostId = change.to.groundedId as EphemeraMembershipHostId
    if (!isEphemeraObjectId(entityId)) {
        return undefined
    }
    if (liveHosts.get(entityId) !== fromHostId) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action dropped: ${entityId} is no longer on ${fromHostId}`)
        return undefined
    }
    if (fromHostId === toHostId) {
        // A take of something already held (picked up since the dry run): nothing to move.
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action dropped: ${entityId} is already on ${toHostId}`)
        return undefined
    }

    const roomId = liveHosts.get(args.characterId)
    if (roomId === undefined || !isEphemeraRoomId(roomId)) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action dropped: ${args.characterId} is not in exactly one room`)
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
        narration: { characterName, objectShortName },
        metEdges: attemptMetEdges,
        // Containment (slice 3c): `planObjectMoveTransfer`/`buildObjectMoveOp`/
        // `compilePositionKernelOp` already thread this through to the establish step whose
        // `hostId` is always `toHostId` by construction --- no ancestry walk needed.
        ...(change.containment ? { containment: change.containment } : {}),
    })

    if (!planResult.ok) {
        console.error(`[mtw.ephemera.positions] commitAttempt: membership action refused: ${planResult.errorCode}`)
        return undefined
    }

    return { steps: planResult.plan.steps, slots: planResult.plan.slots }
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
 * The generic per-attempt commit path (AP-9, slice 3a): dispatches each action by its
 * `desiredResult`'s primitive, re-expanding it against live state (membership via
 * `planObjectMoveTransfer`, relational via `planRelationalEdgeTransfer`), concatenates every
 * action's resulting kernel steps into one sequence, and commits the whole attempt in one
 * `commitAndPresentStepSequence` call --- one `transactWrite`, not one per action. Today's
 * attempts hold exactly one action, so this is observably identical to the per-primitive
 * handlers it replaces; the concatenation is what slice 3c's containment attempt (two
 * actions, mixed kinds) needs to commit atomically.
 *
 * Containment (no `desiredResult` yet, AP-4) and Describe (not published through this event
 * at all) are out of this slice's scope --- an action with no `desiredResult`, or one whose
 * primitive this dispatch does not recognize, contributes nothing.
 */
export const commitAttempt = async (args: CommitAttemptArgs): Promise<void> => {
    const { attempt, characterId } = args
    const attemptMetEdges = attempt.metPropagations()
    // Minted once, up front --- a membership fragment's narrate steps bake this id in at
    // build time (`compilePositionKernelOp`), and the bundle must be declared under the
    // same id at commit time or its narration orphans (see this file's own note on
    // `commitAndPresentStepSequence`'s call below).
    const bundleId = uuidv4()

    // AP-10: the span half travels on the attempt's referents; the derived half is rebuilt
    // here, against live state, for every action alike (a relational step, published fully
    // grounded, passes through unchanged).
    const spans = new Map(attempt.referents().map(({ refKey, id }) => [refKey, id]))
    const liveHosts = await readLiveHosts(attempt, characterId)
    const resolver: DerivedReferentResolver = {
        actingCharacter: characterId,
        currentHost: (id) => liveHosts.get(id),
    }

    const fragments: ActionFragment[] = []
    for (const action of attempt.actions()) {
        const desiredResult = action.desiredResult
        if (desiredResult === undefined || desiredResult.kind !== 'change') {
            continue
        }
        const assignment = buildReferentAssignment(desiredResult, spans, resolver)
        if (assignment === undefined) {
            console.error(`[mtw.ephemera.positions] commitAttempt: ${desiredResult.primitive} action dropped: a derived referent is not resolvable against live state`)
            fragments.push(emptyFragment)
            continue
        }
        const change = groundChange(desiredResult, assignment)
        if (change.primitive === 'transferMembership') {
            const fragment = await buildMembershipFragment(change, liveHosts, args, attemptMetEdges, bundleId)
            fragments.push(fragment ?? emptyFragment)
            continue
        }
        const fragment = await buildRelationalFragment(change)
        fragments.push(fragment ?? emptyFragment)
    }

    const steps = fragments.flatMap((fragment) => fragment.steps)
    if (steps.length === 0) {
        return
    }
    const slots = fragments.flatMap((fragment) => fragment.slots)
    const relationalEdges = fragments.flatMap((fragment) => (fragment.relationalEdge ? [fragment.relationalEdge] : []))

    // Mirrors `executeEstablishEdgeChain`'s own resolver (AP-9's premises): every relational
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

    await commitAndPresentStepSequence(
        { steps, slots },
        bundleId,
        characterId,
        {
            commit: {
                messageBus: args.messageBus,
                streamEvent: args.streamEvent,
                getCurrentHost: (id) => hostByReferencedId.get(id),
                ...(relationalEdges.length > 0 ? { relationalEdges } : {}),
            },
            perceive: { streamEvent: noopActionsStreamEvent, messageBus: args.messageBus },
        }
    )
}
