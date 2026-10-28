import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraLudicTerminalPrimitive, relationKindAndLabelOf } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ExecutorDissolveRelationStep } from '../../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import type { KernelStep, MutationKernelCaptureStep, MutationKernelSetHostingKindStep, NarrationSpecification } from '../kernelStep'
import type { MembershipMoveNarrationInput } from './positionKernelOp'
import type { PositionKernelMoveOp } from './positionKernelOp'

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
 * `op.dissolvedEdges` render into `dissolveRelation` steps positioned **ahead of** the presence steps, which
 * is what preserves BD-28's ordering guarantee: `factsForStep` streams in step order precisely so a
 * severed relation's fact precedes the moved fact (`commitStepSequence` streams that fact after the
 * mover's last presence step). Expansion classified them; this
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
    // HostRelationalEdge.from/to is EphemeraLudicTerminalId-typed, but a port-qualified edge is a
    // crossing, which Expansion dissolves as its own
    // attempt action, never here. So skip rather than assume. Each edge carries its own host.
    const dissolveSteps: ExecutorDissolveRelationStep[] = (op.dissolvedEdges ?? [])
        .filter(({ edge }) => isEphemeraLudicTerminalPrimitive(edge.from) && isEphemeraLudicTerminalPrimitive(edge.to))
        .map(({ hostId, edge }) => ({
            kind: 'dissolveRelation' as const,
            // Safe: filtered to primitive endpoints above.
            subjectId: edge.from as EphemeraLudicTerminalPrimitive,
            targetId: edge.to as EphemeraLudicTerminalPrimitive,
            hostId,
            ...relationKindAndLabelOf(edge),
        }))

    const primaryMovedId: EphemeraLudicTerminalPrimitive = op.moved

    if (op.hostingKind && op.to === null) {
        throw new Error('compilePositionKernelOp: hostingKind set with no destination --- caller bug, not a legal "give to nobody" shape')
    }

    // setting the kind only makes sense once the moved object is actually a node of `toHostId`'s
    // graph, so this runs after the presence steps (which apply membership).
    if (op.hostingKind && !isEphemeraPositionAdjacencyContainedId(primaryMovedId)) {
        throw new Error(`compilePositionKernelOp: hostingKind set for ${JSON.stringify(primaryMovedId)}, which cannot be a member`)
    }
    const hostingKindSteps: MutationKernelSetHostingKindStep[] = op.hostingKind
        ? [{
            kind: 'setHostingKind',
            // Safe: guarded above.
            hostId: op.to as EphemeraMembershipHostId,
            memberId: primaryMovedId as EphemeraPositionAdjacencyContainedId,
            hostingKind: op.hostingKind,
        }]
        : []

    const headerSteps: KernelStep[] = (op.header && op.to !== null && isEphemeraRoomId(op.to))
        ? [{ kind: 'describe', referentId: op.to, referentKind: 'room', header: op.header }]
        : []

    // the mover's presence writes, every mover regardless of host kind, named by the producer
    // (`resolvePresenceMoves`) and passed through. Membership is not a step of its own: each
    // presence step applies it (a host loses the node only with the mover's last binding there).
    const presenceBindingSteps: KernelStep[] = [...op.presenceSteps]

    if (!op.narration) {
        return { steps: [...dissolveSteps, ...presenceBindingSteps, ...hostingKindSteps, ...headerSteps] }
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
            ...presenceBindingSteps,
            ...hostingKindSteps,
            ...captureToStep,
            ...narrateLeaveSteps,
            ...headerSteps,
            ...narrateArriveStep,
        ],
    }
}
