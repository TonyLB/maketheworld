import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ExecutorDissolveRelationStep, ExecutorEstablishRelationStep } from '../../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { KernelStep, MutationKernelCaptureStep, MutationKernelTransferStep, NarrationSpecification } from '../kernelStep'
import type { MembershipMoveNarrationInput } from './positionKernelOp'
import type { PositionKernelMoveOp } from './positionKernelOp'
import { presenceBindingStepsForMove } from './presenceBindingStepsForMove'

/**
 * `steps` is the whole ordered plan; its `narrate` and `describe` steps, in array order, are the
 * plan's presentation order (`presentStepSequence` stamps entry *i* at `beatAnchorTime + i`).
 */
export type CompiledPositionKernelPlan = {
    steps: readonly KernelStep[]
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
 * `op.header`, when present, compiles to a `describe` step carrying the header binding, positioned
 * between the leave and arrive narrations (the transcript order a navigate has always had). Object
 * routes have no header at all and pass `header: null`; there is deliberately no character-host
 * branch here, because the caller resolving the header is the caller that knows whether one applies.
 *
 * `op.dissolvedEdges` render into `dissolveRelation` steps positioned **ahead of** the transfer, which
 * is what preserves BD-28's ordering guarantee: `factsForStep` streams in step order precisely so a
 * severed relation's fact precedes the moved fact. Expansion classified them; this
 * function only sequences them.
 *
 * When `op.narration` is present (character moves only), capture-from/capture-to steps are built
 * from the same `(froms, to)` pair, and each narrate step reads its own side's capture.
 * Capture/mutation ordering inside `steps` is the one place order matters for walk correctness;
 * the presentation steps' position among them is the transcript order, since presentation stamps
 * `beatAnchorTime + index` over the plan's `narrate`/`describe` steps in array order.
 *
 * When `op.narration` is absent, only mutation steps are emitted, plus the header `describe` (if any). That covers every object move: lifecycle moves (spawn/destroy/place/remove) narrate
 * nothing, and take/drop/give narrate through their attempt's narration units, whose audiences
 * `commitAttempt.ts` resolves and captures itself. It also covers the pre-commit mutation-only
 * compile navigate does. Narration belongs to whatever creates the action, and nothing here
 * creates one.
 */
export const compilePositionKernelOp = (op: PositionKernelMoveOp): CompiledPositionKernelPlan => {
    const transferStep: MutationKernelTransferStep = {
        kind: 'transferMembership',
        entityId: op.moved,
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

    const headerSteps: KernelStep[] = (op.header && op.to !== null && isEphemeraRoomId(op.to))
        ? [{ kind: 'describe', referentId: op.to, referentKind: 'room', header: op.header }]
        : []

    // one presence binding per rehost, every mover regardless of host kind. Mechanics --- the
    // remove-then-add pair, the missing-clear fix --- live in `presenceBindingStepsForMove`, of
    // which this is the only caller: `executeMembershipTransfer` reaches it through this
    // compiler rather than emitting its own steps.
    const presenceBindingSteps = presenceBindingStepsForMove(primaryMovedId, op.froms, op.to)

    if (!op.narration) {
        return { steps: [...dissolveSteps, transferStep, ...establishSteps, ...presenceBindingSteps, ...headerSteps] }
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

    const narrateLeaveSteps: KernelStep[] = op.froms.map((hostId) => ({
        kind: 'narrate',
        narration: narrationSpec(narration, 'leave', hostId),
        captureId: captureIdForFrom(hostId),
    }))

    const narrateArriveStep: KernelStep[] = op.to
        ? [{
            kind: 'narrate',
            narration: narrationSpec(narration, 'arrive', op.to),
            captureId: CAPTURE_ID_TO,
        }]
        : []

    return {
        steps: [
            ...captureFromSteps,
            ...dissolveSteps,
            transferStep,
            ...establishSteps,
            ...presenceBindingSteps,
            ...captureToStep,
            ...narrateLeaveSteps,
            ...headerSteps,
            ...narrateArriveStep,
        ],
    }
}
