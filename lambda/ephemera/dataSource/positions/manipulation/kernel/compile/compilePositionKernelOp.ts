import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { ExecutorDissolveRelationStep, ExecutorEstablishRelationStep } from '../../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { KernelStep, MutationKernelCaptureStep, MutationKernelTransferStep, NarrationSpecification } from '../kernelStep'
import type { MessageOrchestrationSlotSpec } from '../../../../messageOrchestration/localApiEvents'
import type { MembershipMoveNarrationInput } from './positionKernelOp'
import { moveLeaveSlotId, MOVE_ARRIVE_SLOT_ID } from './moveBundleSlotIds'
import type { PositionKernelMoveOp } from './positionKernelOp'
import { presenceBindingStepsForMove } from './presenceBindingStepsForMove'

export type CompiledPositionKernelPlan = {
    steps: readonly KernelStep[]
    slots: readonly MessageOrchestrationSlotSpec[]
}

/** The capture ids this compiler mints for a move's leave/arrive captures. */
const captureIdForFrom = (hostId: string): string => `capture:from:${hostId}`
const CAPTURE_ID_TO = 'capture:to'

/**
 * The one place that knows "a move brackets leave-then-arrive." Callers ---
 * navigate/home/connect/disconnect and object take/drop --- emit a `PositionKernelMoveOp` and never
 * spell out capture, dissolve, or narration steps themselves. Normative rules:
 * `dataSource/positions/AGENT.contract.md`, "Narration and presentation"; vocabulary:
 * `AGENT.concepts.md`, "Abstract op and compiled step."
 *
 * `op.headerSlot`'s presence in `slots` is unconditional, independent of `op.narration` --- the
 * header render is a separate, already-shipped mechanism (`presentCharacterMove.ts`'s
 * `registerIngressSlot`/`kickPassiveRenderRequestedForCharacterInRoom`, keyed off this same declared
 * slot), not the presentation kernel's `describe` branch, so this compiler never emits a `describe`
 * step for it --- doing so would fire a second, conflicting render request. Object routes have no
 * header at all and pass `headerSlot: null`; there is deliberately no character-host branch here,
 * because the caller resolving the header is the caller that knows whether one applies.
 *
 * `op.dissolvedEdges` render into `dissolveRelation` steps positioned **ahead of** the transfer, which
 * is what preserves BD-28's ordering guarantee: `factsForStep` streams in step order precisely so a
 * severed relation's fact precedes the moved fact. Expansion classified them; this
 * function only sequences them.
 *
 * When `op.narration` is present, capture-from/capture-to steps are always built from the same
 * `(froms, to)` pair, so a later audience (an authored narration unit) has a roster to read. **Narrate steps and slots are built here only for the
 * `membershipMove` family** (navigate/home/connect/disconnect) --- `[leave, header, arrive]`
 * ordering is decided only for that narration. The `template` family (object take/drop/give)
 * narrates through `commitAttempt.ts`'s post-commit sweep instead, over captures `commitAttempt`
 * mints itself; the `template` captures this compiler still emits are unread (known debt in
 * `manipulation/AGENT.implementation.md`). Narration belongs to whatever creates the action, and
 * nothing here creates one. Capture/mutation
 * ordering inside `steps` is the one place order matters for walk correctness; narrate step
 * position among them is cosmetic, since delivery order comes from `slots`, not `steps` (the
 * messageOrchestration bundle assigns `CreatedTime` in declared order at flush, fully decoupled
 * from execution order).
 *
 * **Both bracket sides are always emitted, including a character-hosted one.** A character's
 * inventory graph has no roster, so its capture snapshots an empty set and its narrate step publishes
 * to nobody, and the messageOrchestration fan-in's documented tolerance of unresolved slots makes
 * that cost nothing. That empty side is the *correct output of a uniform rule*, not an oversight ---
 * an earlier design suppressed it with an object-specific branch, which is precisely how this frame
 * (a room's changelog, not a mover's itinerary) gets lost at the first new caller.
 *
 * When `op.narration` is absent (object-lifecycle moves --- spawn/destroy/place/remove --- and the
 * pre-commit mutation-only compile every narrating route also does), only mutation steps are emitted
 * and `slots` carries the header only (if any).
 */
export const compilePositionKernelOp = (op: PositionKernelMoveOp): CompiledPositionKernelPlan => {
    const transferStep: MutationKernelTransferStep = {
        kind: 'transferMembership',
        entityIds: new Set([op.moved]),
        fromHostIds: new Set(op.froms),
        toHostId: op.to,
    }

    // HostRelationalEdge.from/to is EphemeraLudicTerminalId-typed, but this op's only producer
    // (`buildObjectMoveOp`, below) severs the mover's own containment edge, which joins two
    // primitives: a port-qualified edge is a crossing, which Expansion dissolves as its own
    // attempt action, never here. So skip rather than assume.
    // `hostId: op.froms[0]` --- `dissolvedEdges` is only ever populated by `buildObjectMoveOp`
    // (single-origin, always `froms: [args.fromHostId]`), so every severed boundary edge belongs
    // to that one departure host. Not derived per-edge because
    // `HostRelationalEdge` (the graph's own internal edge representation, used far more broadly)
    // doesn't carry a host of its own.
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

    const primaryMovedId: EphemeraLudicTerminalPrimitive = op.moved

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

    // one presence binding per rehost, every mover regardless of host kind. Mechanics --- the
    // remove-then-add pair, the missing-clear fix --- live in `presenceBindingStepsForMove`, of
    // which this is the only caller: `executeMembershipTransfer` reaches it through this
    // compiler rather than emitting its own steps.
    const presenceBindingSteps = presenceBindingStepsForMove(primaryMovedId, op.froms, op.to)

    if (!op.narration) {
        return { steps: [...dissolveSteps, transferStep, ...establishSteps, ...presenceBindingSteps], slots: headerSlotList }
    }

    const { narration } = op

    const narrationSpec = (
        membershipNarration: MembershipMoveNarrationInput,
        direction: 'leave' | 'arrive',
        hostId: EphemeraMembershipHostId | null
    ): NarrationSpecification => ({
        kind: 'membershipMove',
        direction,
        characterName: membershipNarration.characterName,
        copyKind: direction === 'leave' && hostId !== null
            ? membershipNarration.leaveCopyKind(hostId)
            : membershipNarration.arriveCopyKind,
        ...(membershipNarration.exitName !== undefined ? { exitName: membershipNarration.exitName } : {}),
    })

    const captureFromSteps: MutationKernelCaptureStep[] = op.froms.map((hostId) => ({
        kind: 'capture',
        hostId,
        captureId: captureIdForFrom(hostId),
    }))

    const captureToStep: MutationKernelCaptureStep[] = op.to
        ? [{ kind: 'capture', hostId: op.to, captureId: CAPTURE_ID_TO }]
        : []

    const narrateLeaveSteps: KernelStep[] = narration.kind === 'membershipMove'
        ? op.froms.map((hostId) => ({
            kind: 'narrate',
            narration: narrationSpec(narration, 'leave', hostId),
            captureId: captureIdForFrom(hostId),
            bundleId: op.bundleId,
            slotId: moveLeaveSlotId(hostId),
        }))
        : []

    const narrateArriveStep: KernelStep[] = narration.kind === 'membershipMove' && op.to
        ? [{
            kind: 'narrate',
            narration: narrationSpec(narration, 'arrive', op.to),
            captureId: CAPTURE_ID_TO,
            bundleId: op.bundleId,
            slotId: MOVE_ARRIVE_SLOT_ID,
        }]
        : []

    const slots: MessageOrchestrationSlotSpec[] = narration.kind === 'membershipMove'
        ? [
            ...op.froms.map((hostId) => ({
                slotId: moveLeaveSlotId(hostId),
                expectedPublishType: 'WorldMessage' as const,
            })),
            ...headerSlotList,
            ...(op.to ? [{ slotId: MOVE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' as const }] : []),
        ]
        : headerSlotList

    return {
        steps: [
            ...captureFromSteps,
            ...dissolveSteps,
            transferStep,
            ...establishSteps,
            ...presenceBindingSteps,
            ...captureToStep,
            ...narrateLeaveSteps,
            ...narrateArriveStep,
        ],
        slots,
    }
}
