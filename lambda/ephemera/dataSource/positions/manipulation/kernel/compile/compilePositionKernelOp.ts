import { v4 as uuidv4 } from 'uuid'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { ExecutorDissolveRelationStep, ExecutorEstablishRelationStep } from '../../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { KernelStep, MutationKernelAddPresencePortStep, MutationKernelCaptureStep, MutationKernelRemovePresencePortStep, MutationKernelTransferStep, NarrationSpecification } from '../kernelStep'
import type { MessageOrchestrationSlotSpec } from '../../../../messageOrchestration/localApiEvents'
import { moveLeaveSlotId, MOVE_ARRIVE_SLOT_ID } from './moveBundleSlotIds'
import type { PositionKernelMoveOp } from './positionKernelOp'

export type CompiledPositionKernelPlan = {
    steps: readonly KernelStep[]
    slots: readonly MessageOrchestrationSlotSpec[]
}

const captureIdForFrom = (hostId: string): string => `capture:from:${hostId}`
const CAPTURE_ID_TO = 'capture:to'

/**
 * PB-M: the verb is a property of the *delta*, read off which side of the move was the room --- not
 * an intent the caller declares and not a host-*kind* inference reasoning backwards from a published
 * fact (which is what the retired `inferOperationFromFact` did). Stated this way `give` needs no new
 * discriminant: it is simply the case where neither side is a room.
 *
 * Character moves never reach here --- they are room-to-room and carry a `membershipMove` narration.
 */
const objectMoveVerb = (
    froms: readonly EphemeraMembershipHostId[],
    to: EphemeraMembershipHostId | null
): 'takeHold' | 'drop' | 'give' => {
    if (to !== null && isEphemeraRoomId(to)) {
        return 'drop'
    }
    if (froms.some((hostId) => isEphemeraRoomId(hostId))) {
        return 'takeHold'
    }
    return 'give'
}

/**
 * The one place that knows "a move brackets leave-then-arrive." Callers ---
 * navigate/home/connect/disconnect and object take/drop --- emit a `PositionKernelMoveOp` and never
 * spell out capture, dissolve, or narration steps themselves. Normative rules:
 * `dataSource/positions/AGENT.contract.md`, "Narration and presentation"; vocabulary:
 * `AGENT.concepts.md`, "Abstract op and compiled step."
 *
 * `op.headerSlot`'s presence in `slots` is unconditional, independent of `op.narration` --- the
 * header render is a separate, already-shipped mechanism (`orchestrateNavigate.ts`'s
 * `registerIngressSlot`/`kickPassiveRenderRequestedForCharacterInRoom`, keyed off this same declared
 * slot), not the presentation kernel's `describe` branch, so this compiler never emits a `describe`
 * step for it --- doing so would fire a second, conflicting render request. Object routes have no
 * header at all and pass `headerSlot: null`; there is deliberately no character-host branch here,
 * because the caller resolving the header is the caller that knows whether one applies.
 *
 * `op.dissolvedEdges` render into `dissolveRelation` steps positioned **ahead of** the transfer, which
 * is what preserves BD-28's ordering guarantee: `factsForStep` streams in step order precisely so a
 * severed relation's fact precedes the moved fact. Expansion classified them (PB-9(i-b)); this
 * function only sequences them.
 *
 * When `op.narration` is present, every narration channel this move can produce is built from the
 * same `(froms, to)` pair in one pass, so there is exactly one place `[leave, header, arrive]`
 * ordering is decided (PB-7): capture-from steps, the transfer step, a capture-to step,
 * narrate-leave steps, and a narrate-arrive step. Capture/mutation ordering inside `steps` is the
 * one place order matters for walk correctness (PB-A/PB-J); narrate step position among them is
 * cosmetic, since delivery order comes from `slots`, not `steps` (PB-G: the messageOrchestration
 * bundle assigns `CreatedTime` in declared order at flush, fully decoupled from execution order).
 *
 * **Both bracket sides are always emitted, including a character-hosted one** (PB-M). A character's
 * inventory graph has no roster, so its capture snapshots an empty set and its narrate step publishes
 * to nobody, and the messageOrchestration fan-in's documented tolerance of unresolved slots makes
 * that cost nothing. That empty side is the *correct output of a uniform rule*, not an oversight ---
 * an earlier design suppressed it with an object-specific branch, which is precisely how PB-M's frame
 * (a room's changelog, not a mover's itinerary) gets lost at the first new caller.
 *
 * When `op.narration` is absent (object-lifecycle moves --- spawn/destroy/place/remove --- and the
 * pre-commit mutation-only compile every narrating route also does), only mutation steps are emitted
 * and `slots` carries the header only (if any).
 */
export const compilePositionKernelOp = (op: PositionKernelMoveOp): CompiledPositionKernelPlan => {
    const transferStep: MutationKernelTransferStep = {
        kind: 'transferMembership',
        entityIds: op.moved.kind === 'closure'
            ? op.moved.fragment.objectIds
            : new Set([op.moved.entityId]),
        fromHostIds: new Set(op.froms),
        toHostId: op.to,
    }

    // LP7 widened HostRelationalEdge.from/to to EphemeraLudicTerminalId; no producer can build a
    // port-qualified boundary edge yet, so skip rather than assume (matches the ludicGraph
    // boundary/carry-closure narrows, ludicGraph/AGENT.md's BD-36 paragraph).
    // `hostId: op.froms[0]` --- `dissolvedEdges` is only ever populated by
    // `executeObjectMove.ts`'s single-origin carry-closure path (`buildObjectMoveOp` is its only
    // producer, always `froms: [args.fromHostId]`), so every severed boundary edge belongs to that
    // one departure host. Not derived per-edge because `HostRelationalEdge` (the graph's own
    // internal edge representation, used far more broadly) doesn't carry a host of its own.
    const dissolveSteps: ExecutorDissolveRelationStep[] = (op.dissolvedEdges ?? [])
        .filter((edge) => isEphemeraLudicTerminalPrimitive(edge.from) && isEphemeraLudicTerminalPrimitive(edge.to))
        .map((edge) => ({
            kind: 'dissolveRelation' as const,
            // Safe: filtered to primitive endpoints above.
            subjectId: edge.from as EphemeraLudicTerminalPrimitive,
            targetId: edge.to as EphemeraLudicTerminalPrimitive,
            hostId: op.froms[0]!,
            ...relationKindAndLabelOf(edge),
        }))

    // LP4a: for a closure, primacy is `fragment.rootId`, never derived from the fragment's edges.
    // A closure's fragment is host-bound at the moved object (rootId === hostId), always a
    // primitive, never a port address --- the cast is safe on that construction guarantee.
    const primaryMovedId: EphemeraLudicTerminalPrimitive = op.moved.kind === 'closure'
        ? op.moved.fragment.rootId as EphemeraLudicTerminalPrimitive
        : op.moved.entityId

    if (op.containment && op.to === null) {
        throw new Error('compilePositionKernelOp: containment set with no destination --- caller bug, not a legal "give to nobody" shape')
    }

    // establishing the destination-side containment edge only makes sense once the moved
    // object is actually a node of `toHostId`'s graph, so this runs after `transferStep` ---
    // placed before it would resolve `findHostOf(primaryMovedId)` against the *old* host.
    const establishSteps: ExecutorEstablishRelationStep[] = op.containment
        ? [{
            kind: 'establishRelation',
            subjectId: primaryMovedId,
            targetId: op.to as EphemeraLudicTerminalPrimitive,
            // Safe: the `op.containment && op.to === null` guard above already threw.
            hostId: op.to as EphemeraMembershipHostId,
            relationKind: op.containment,
        }]
        : []

    const headerSlotList: MessageOrchestrationSlotSpec[] = op.headerSlot ? [op.headerSlot] : []

    // one presence port per rehost, object closures only (characters never carry one --- this is
    // what keeps a bare `compilePositionKernelOp` widening from porting a character on every
    // navigate; RD-1/step 2 of the presence-refactor plan is what lifts this gate). RD-2
    // (2026-09-04): a remove-then-add pair per rehost, rather than one replace-all step ---
    // multiplicity now lives in the sequence, not the step, so a departure host with no existing
    // binding just produces a no-op remove.
    const presencePortSteps: (MutationKernelAddPresencePortStep | MutationKernelRemovePresencePortStep)[] = op.moved.kind === 'closure' && op.to
        ? [
            ...op.froms.map((fromHostId): MutationKernelRemovePresencePortStep => ({
                kind: 'removePresencePort',
                hostId: primaryMovedId,
                fromHostId,
            })),
            {
                kind: 'addPresencePort',
                hostId: primaryMovedId,
                port: { portId: uuidv4(), fromHostId: op.to, kind: 'Present' },
            },
        ]
        : []

    if (!op.narration) {
        return { steps: [...dissolveSteps, transferStep, ...establishSteps, ...presencePortSteps], slots: headerSlotList }
    }

    const { narration } = op

    const narrationSpec = (direction: 'leave' | 'arrive', hostId: EphemeraMembershipHostId | null): NarrationSpecification => {
        switch (narration.kind) {
            case 'membershipMove':
                return {
                    kind: 'membershipMove',
                    direction,
                    characterName: narration.characterName,
                    copyKind: direction === 'leave' && hostId !== null
                        ? narration.leaveCopyKind(hostId)
                        : narration.arriveCopyKind,
                    ...(narration.exitName !== undefined ? { exitName: narration.exitName } : {}),
                }
            case 'objectMove':
                // No `direction`: the one non-empty side of the bracket carries the whole sentence,
                // and which side that is is already answered by the verb.
                return {
                    kind: 'objectMove',
                    verb: objectMoveVerb(op.froms, op.to),
                    characterName: narration.characterName,
                    objectShortName: narration.objectShortName,
                    carriedCount: narration.carriedCount,
                }
        }
    }

    const captureFromSteps: MutationKernelCaptureStep[] = op.froms.map((hostId) => ({
        kind: 'capture',
        hostId,
        captureId: captureIdForFrom(hostId),
    }))

    const captureToStep: MutationKernelCaptureStep[] = op.to
        ? [{ kind: 'capture', hostId: op.to, captureId: CAPTURE_ID_TO }]
        : []

    const narrateLeaveSteps: KernelStep[] = op.froms.map((hostId) => ({
        kind: 'narrate',
        narration: narrationSpec('leave', hostId),
        captureId: captureIdForFrom(hostId),
        bundleId: op.bundleId,
        slotId: moveLeaveSlotId(hostId),
    }))

    const narrateArriveStep: KernelStep[] = op.to
        ? [{
            kind: 'narrate',
            narration: narrationSpec('arrive', op.to),
            captureId: CAPTURE_ID_TO,
            bundleId: op.bundleId,
            slotId: MOVE_ARRIVE_SLOT_ID,
        }]
        : []

    const slots: MessageOrchestrationSlotSpec[] = [
        ...op.froms.map((hostId) => ({
            slotId: moveLeaveSlotId(hostId),
            expectedPublishType: 'WorldMessage' as const,
        })),
        ...headerSlotList,
        ...(op.to ? [{ slotId: MOVE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' as const }] : []),
    ]

    return {
        steps: [
            ...captureFromSteps,
            ...dissolveSteps,
            transferStep,
            ...establishSteps,
            ...presencePortSteps,
            ...captureToStep,
            ...narrateLeaveSteps,
            ...narrateArriveStep,
        ],
        slots,
    }
}
