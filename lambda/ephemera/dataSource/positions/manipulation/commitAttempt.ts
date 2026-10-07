import { v4 as uuidv4 } from 'uuid'
import { isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraObjectId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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
    GroundedPresence,
    GroundedReferent,
    TransferMembershipChange,
} from '../../actions/enrich/objectManipulation/plan/planStep'
import { derivedReferentKey } from '../../actions/enrich/objectManipulation/plan/planStep'
import { buildReferentAssignment, type DerivedReferentResolver } from '../../actions/enrich/objectManipulation/synthesize/buildReferentAssignment'
import { groundChange } from '../../actions/enrich/objectManipulation/synthesize/groundChange'
import { commitAndPresentStepSequence } from './kernel/commitAndPresentStepSequence'
import { objectMoveVerb, type CompiledPositionKernelPlan } from './kernel/compile/compilePositionKernelOp'
import type { RelationalEdgeFactSource } from './kernel/factsForStep'
import { isKernelMutationStep } from './kernel/kernelStep'
import type { MutationKernelCaptureStep } from './kernel/kernelStep'
import { dryRunStepSequence } from './kernel/dryRunStepSequence'
import { planObjectMoveTransfer } from './membership/planObjectMoveTransfer'
import { planRelationalEdgeTransfer } from './relational/planRelationalEdgeTransfer'
import { defaultTransferMembershipParts } from './kernel/narrationTemplate'
import { deliverNarrationUnits } from './deliverNarrationUnits'
import { resolveNarrationLabels } from '../../perception/resolveNarrationLabels'
import { edgesMatch, type HostRelationalEdge } from '../ludicGraph'
import type { MutationKernelStep } from './kernel/kernelStep'
import { edgeKindAndLabelFrom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { roomsForHost, roomsForReferent } from '../ludicGraph/presenceRooms'
import type { EphemeraLudicGraph } from '../ludicGraph'
import type { NarrationAudience } from '../../actions/commandAttempt/narrationUnit'

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
 * action it narrates, the entity it moved (the bridge's one ref, and the key its *after* audience
 * resolves from the destination), and the two hosts whose delta picks the bridge's verb.
 */
type MembershipBridgeInfo = {
    actionId: string
    entityId: EphemeraObjectId
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
}

/** The attempt's resolved display names: one actor name, and a name per object or character a unit or a bridge refers to. */
type AttemptNarrationLabels = {
    actorName: string
    names: Readonly<Record<string, string>>
}

/**
 * A ref's label: its grounded thing's resolved name. A kind the resolver does not name (a Feature
 * end of a relation) falls back to `'something'`, as an unresolvable object does, so every ref of a
 * delivered unit has a label and `fillNarrationTemplate`'s missing-label throw stays an invariant.
 */
const labelForGroundedId = (labels: AttemptNarrationLabels, groundedId: string): string =>
    labels.names[groundedId] ?? 'something'

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
 * and builds (not commits) the plan via the existing `planObjectMoveTransfer`. Labels are the
 * attempt's own, resolved once (`resolveNarrationLabels`); the op's `narration` input now only
 * gates the compiler's capture steps for the object family, since its copy is the sweep's.
 */
const buildMembershipFragment = async (
    actionId: string,
    change: TransferMembershipChange<GroundedReferent>,
    liveHosts: ReadonlyMap<GroundedId, EphemeraMembershipHostId>,
    args: CommitAttemptArgs,
    bundleId: string,
    labels: AttemptNarrationLabels
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

    const planResult = await planObjectMoveTransfer({
        entityId,
        fromHostId,
        toHostId,
        bundleId,
        narration: { actorName: labels.actorName, labels: { [entityId]: labelForGroundedId(labels, entityId) } },
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
    const parts = defaultTransferMembershipParts(objectMoveVerb([bridge.fromHostId], bridge.toHostId), bridge.entityId)
    return {
        covers: [bridge.actionId],
        variants: [
            { audience: { refs: [bridge.entityId], phase: 'before' }, parts },
            { audience: { refs: [bridge.entityId], phase: 'after' }, parts },
        ],
    }
}

/**
 * Unit delivery order is the attempt's own action order (AN-4): walks the attempt's actions once,
 * and for each, delivers whichever unit covers it --- an author's unit (Expansion's) the first
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

type ReferentGrounding = { groundedId: EphemeraMembershipHostId; groundedPresence?: GroundedPresence[] }

/**
 * A ref's grounding, for the presence -> room walk (AN-7 stage 2) and for its label: a ref names
 * one of the attempt's own referents --- an `objectSpan` by its `stableRefKey` (Grounding's stamp,
 * stage 1), a born-grounded `graphNode` by its `derivedReferentKey` (Expansion's stamp). Anything
 * else is already a grounded id with no known presence beyond its current binding (a bridge unit's
 * ref is the moved entity's own id).
 */
const referentGroundingByRef = (attempt: CommandAttempt): ReadonlyMap<string, ReferentGrounding> => {
    const byRef = new Map<string, ReferentGrounding>()
    for (const action of attempt.actions()) {
        for (const referent of action.referents()) {
            if (referent.referentType !== 'objectSpan' && referent.referentType !== 'graphNode') {
                continue
            }
            const ref = referent.referentType === 'objectSpan' ? referent.stableRefKey : derivedReferentKey(referent)
            if (ref === undefined || referent.groundedId === undefined || byRef.has(ref)) {
                continue
            }
            byRef.set(ref, { groundedId: referent.groundedId, groundedPresence: referent.groundedPresence })
        }
    }
    return byRef
}

const groundingForRef = (ref: string, byRef: ReadonlyMap<string, ReferentGrounding>): ReferentGrounding =>
    byRef.get(ref) ?? { groundedId: ref as EphemeraMembershipHostId }

/** Every `ref` part across a set of units. */
const refsInUnits = (units: readonly NarrationUnit[]): string[] =>
    units.flatMap((unit) => unit.variants.flatMap((variant) => variant.parts.flatMap((part) => ('ref' in part ? [part.ref] : []))))

/**
 * `after` resolves a unit's moved entity (any `transferMembership` change among its covered
 * actions) from its destination host directly, since a move's binding does not exist at compile
 * time (AN-7 stage 2) --- not from potentially stale `groundedPresence`.
 */
const movedHostsForUnit = (
    unit: NarrationUnit,
    membershipBridges: readonly MembershipBridgeInfo[]
): ReadonlyMap<EphemeraMembershipHostId, { fromHostId: EphemeraMembershipHostId; toHostId: EphemeraMembershipHostId }> => {
    const covered = new Set(unit.covers)
    const map = new Map<EphemeraMembershipHostId, { fromHostId: EphemeraMembershipHostId; toHostId: EphemeraMembershipHostId }>()
    for (const bridge of membershipBridges) {
        if (covered.has(bridge.actionId)) {
            map.set(bridge.entityId, { fromHostId: bridge.fromHostId, toHostId: bridge.toHostId })
        }
    }
    return map
}

/** One witness variant's audience, resolved to the deduplicated union of every room its refs reach (AN-8). */
const resolveAudienceRooms = async (
    audience: NarrationAudience,
    context: {
        characterId: EphemeraCharacterId
        liveHosts: ReadonlyMap<GroundedId, EphemeraMembershipHostId>
        byRef: ReadonlyMap<string, ReferentGrounding>
        movedHosts: ReadonlyMap<EphemeraMembershipHostId, { fromHostId: EphemeraMembershipHostId; toHostId: EphemeraMembershipHostId }>
        getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    }
): Promise<Set<EphemeraRoomId>> => {
    const perRef = await Promise.all(audience.refs.map(async (ref) => {
        // A character has exactly one presence: its own current room, already known from the
        // adjacency snapshot (`readLiveHosts`) --- no walk needed (AN-7).
        if (ref === 'actor') {
            const room = context.liveHosts.get(context.characterId)
            return room !== undefined && isEphemeraRoomId(room) ? new Set([room]) : new Set<EphemeraRoomId>()
        }
        const grounding = groundingForRef(ref, context.byRef)
        if (audience.phase === 'after') {
            const moved = context.movedHosts.get(grounding.groundedId)
            if (moved) {
                return roomsForHost(moved.toHostId, context.getGraph)
            }
        }
        if (grounding.groundedPresence === undefined || grounding.groundedPresence.length === 0) {
            // No stamped bucket to walk (AN-7 (iii)'s default): a thing that has never itself
            // moved through this compiler has no presence binding of its own even though it
            // sits plainly in some room's node list, so the walk starts from its already-known
            // current container (`liveHosts`), not from the thing's own (empty) graph.
            const currentHost = context.liveHosts.get(grounding.groundedId) ?? grounding.groundedId
            return roomsForHost(currentHost, context.getGraph)
        }
        return roomsForReferent(grounding.groundedId, grounding.groundedPresence, context.getGraph)
    }))
    const rooms = new Set<EphemeraRoomId>()
    for (const set of perRef) {
        for (const room of set) {
            rooms.add(room)
        }
    }
    return rooms
}

type NarrationCaptureAssembly = {
    /** Minted `capture` steps to splice ahead of each fragment index's own steps. */
    beforeByFragmentIndex: MutationKernelCaptureStep[][]
    /** Minted `capture` steps to splice behind each fragment index's own steps. */
    afterByFragmentIndex: MutationKernelCaptureStep[][]
    /** What `deliverNarrationUnits`'s `resolveCaptureId` reads back, keyed by audience identity. */
    captureIdsByAudience: ReadonlyMap<NarrationAudience, string[]>
}

/**
 * Audience resolution at compile (AN-7 stage 2): for each unit to be delivered, resolves each
 * witness variant's audience to its room set, mints one fresh capture id per room (the actual fix
 * for the two-moves `capture:to` collision AN-8 names), and records where those `capture` steps
 * belong in the committed step sequence --- ahead of the unit's first covered action's fragment for
 * `before`, behind its last covered action's fragment for `after` (a capture's position is its
 * place in the step array; its id is just unique). The kernel's `capture` step shape is unchanged.
 */
const buildNarrationCaptureSteps = async (
    unitsToDeliver: readonly NarrationUnit[],
    membershipBridges: readonly MembershipBridgeInfo[],
    fragmentIndexByActionId: ReadonlyMap<string, number>,
    fragmentCount: number,
    context: {
        characterId: EphemeraCharacterId
        liveHosts: ReadonlyMap<GroundedId, EphemeraMembershipHostId>
        byRef: ReadonlyMap<string, ReferentGrounding>
        getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
    }
): Promise<NarrationCaptureAssembly> => {
    const beforeByFragmentIndex: MutationKernelCaptureStep[][] = Array.from({ length: fragmentCount }, () => [])
    const afterByFragmentIndex: MutationKernelCaptureStep[][] = Array.from({ length: fragmentCount }, () => [])
    const captureIdsByAudience = new Map<NarrationAudience, string[]>()

    for (const unit of unitsToDeliver) {
        const coveredIndices = unit.covers
            .map((id) => fragmentIndexByActionId.get(id))
            .filter((index): index is number => index !== undefined)
        if (coveredIndices.length === 0) {
            continue
        }
        const minIndex = Math.min(...coveredIndices)
        const maxIndex = Math.max(...coveredIndices)
        const movedHosts = movedHostsForUnit(unit, membershipBridges)

        for (const variant of unit.variants) {
            const rooms = await resolveAudienceRooms(variant.audience, { ...context, movedHosts })
            const target = variant.audience.phase === 'before' ? beforeByFragmentIndex : afterByFragmentIndex
            const fragmentIndex = variant.audience.phase === 'before' ? minIndex : maxIndex
            const captureIds = [...rooms].map((room) => {
                const captureId = `capture:${uuidv4()}`
                target[fragmentIndex]!.push({ kind: 'capture', hostId: room, captureId })
                return captureId
            })
            captureIdsByAudience.set(variant.audience, captureIds)
        }
    }
    return { beforeByFragmentIndex, afterByFragmentIndex, captureIdsByAudience }
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
    // Minted once, up front --- membership fragments are built with it (`planObjectMoveTransfer`),
    // and the post-commit sweep declares the attempt's narration bundle under the same id.
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
    const grounded: { actionId: string; change: ReturnType<typeof groundChange> }[] = []
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
        grounded.push({ actionId: action.id, change: groundChange(desiredResult, assignment) })
    }
    if (grounded.length === 0) {
        return
    }

    // Display names, resolved once per attempt (not per action): every thing an authored unit
    // refers to, plus every moved object (a bridge unit's one ref). Named against the acting
    // character's room perspective: a take from a table moves between two non-Room hosts.
    const byRef = referentGroundingByRef(attempt)
    const actorRoom = liveHosts.get(characterId)
    const resolvedLabels = await resolveNarrationLabels({
        characterId,
        ids: [
            ...refsInUnits(attempt.narrationUnits()).map((ref) => groundingForRef(ref, byRef).groundedId),
            ...grounded.flatMap(({ change }) => (change.primitive === 'transferMembership' ? [change.object.groundedId] : [])),
        ].filter((id): id is EphemeraObjectId | EphemeraCharacterId => isEphemeraObjectId(id) || isEphemeraCharacterId(id)),
        roomId: actorRoom !== undefined && isEphemeraRoomId(actorRoom) ? actorRoom : undefined,
    })
    const labels: AttemptNarrationLabels = { actorName: resolvedLabels.characterName, names: resolvedLabels.names }

    const fragments: ActionFragment[] = []
    const fragmentActionIds: string[] = []
    for (const { actionId, change } of grounded) {
        const fragment = change.primitive === 'transferMembership'
            ? await buildMembershipFragment(actionId, change, liveHosts, args, bundleId, labels)
            : await buildRelationalFragment(change)
        if (fragment === undefined) {
            console.error(`[mtw.ephemera.positions] commitAttempt: attempt refused: ${change.primitive} action could not be built`)
            return
        }
        fragments.push(fragment)
        fragmentActionIds.push(actionId)
    }

    const relationalEdges = fragments.flatMap((fragment) => (fragment.relationalEdge ? [fragment.relationalEdge] : []))
    const membershipBridges = fragments.flatMap((fragment) => (fragment.membershipBridge ? [fragment.membershipBridge] : []))

    // Audience resolution at compile (AN-7 stage 2): resolved before the dry run, so the minted
    // `capture` steps ride inside the same sequence that is dry-run and committed (a capture
    // step is read/lock-only, never part of the transactWrite --- positions/AGENT.contract.md).
    const unitsToDeliver = orderNarrationUnitsForDelivery(attempt, membershipBridges)
    const fragmentIndexByActionId = new Map(fragmentActionIds.map((id, index) => [id, index] as const))
    const { beforeByFragmentIndex, afterByFragmentIndex, captureIdsByAudience } = await buildNarrationCaptureSteps(
        unitsToDeliver,
        membershipBridges,
        fragmentIndexByActionId,
        fragments.length,
        {
            characterId,
            liveHosts,
            byRef,
            getGraph: (hostId) => internalCache.Positions.getLudicGraph(hostId),
        }
    )

    const steps = fragments.flatMap((fragment, index) => [
        ...beforeByFragmentIndex[index]!,
        ...fragment.steps,
        ...afterByFragmentIndex[index]!,
    ])
    const slots = fragments.flatMap((fragment) => fragment.slots)

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

    // The attempt's only narration delivery path (AN-4): every authored unit (Expansion's dissolves)
    // and every uncovered membership action's bridge unit, in the attempt's own action order.
    // Audience resolution (AN-7 stage 2) already happened above, before the commit; this reads it
    // back by the same audience objects. Each ref's label is its grounded object's short name.
    if (unitsToDeliver.length === 0) {
        return
    }
    deliverNarrationUnits({
        units: unitsToDeliver,
        captures: commitResult.captures,
        bundleId,
        messageBus: args.messageBus,
        actorName: labels.actorName,
        labels: Object.fromEntries(refsInUnits(unitsToDeliver).map((ref) => [ref, labelForGroundedId(labels, groundingForRef(ref, byRef).groundedId)] as const)),
        resolveCaptureId: (_unit, audience) => captureIdsByAudience.get(audience) ?? [],
    })
}
