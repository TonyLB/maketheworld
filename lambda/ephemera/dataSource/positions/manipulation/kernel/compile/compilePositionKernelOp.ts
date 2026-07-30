import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { KernelStep, MutationKernelCaptureStep, MutationKernelTransferStep } from '../kernelStep'
import type { MessageOrchestrationSlotSpec } from '../../../../messageOrchestration/localApiEvents'
import { navigateLeaveSlotId, NAVIGATE_ARRIVE_SLOT_ID } from '../../../navigate/navigateBundleSlotIds'
import type { PositionKernelMoveOp } from './positionKernelOp'

/**
 * `navigateLeaveSlotId` (and the header describe step below) are room-shaped --- valid under Phase
 * 2's single consumer (navigate, always room-hosted). Positional capture on a character-hosted
 * inventory graph is meaningless for narration (there is no roster to snapshot), so `narration`
 * should never be populated for a character `to`/`from` --- this narrows accordingly rather than
 * widening `navigateLeaveSlotId` to accept a type it can't meaningfully use.
 */
const asRoomId = (hostId: string): EphemeraRoomId => hostId as EphemeraRoomId

export type CompiledPositionKernelPlan = {
    steps: readonly KernelStep[]
    slots: readonly MessageOrchestrationSlotSpec[]
}

const captureIdForFrom = (hostId: string): string => `capture:from:${hostId}`
const CAPTURE_ID_TO = 'capture:to'

/**
 * `AGENT.presentationKernel.planning.md` PB-I: the one place that knows "a move brackets
 * leave-then-arrive." Callers (navigate today; connect/disconnect in Phase 3) emit a
 * `PositionKernelMoveOp` and never spell out capture or narration steps themselves --- see that
 * plan's PB-I/PB-2/PB-6/PB-7 for the resolved design.
 *
 * `op.headerSlot`'s presence in `slots` is unconditional, independent of `op.narration` --- the
 * header render is a separate, already-shipped mechanism (`orchestrateNavigate.ts`'s
 * `registerIngressSlot`/`kickPassiveRenderRequestedForCharacterInRoom`, keyed off this same declared
 * slot), not the presentation kernel's `describe` branch, so this compiler never emits a `describe`
 * step for it --- doing so would fire a second, conflicting render request.
 *
 * When `op.narration` is present, every narration channel this move can produce is built from the
 * same `(froms, to)` pair in one pass, so there is exactly one place `[leave, header, arrive]`
 * ordering is decided (PB-7): capture-from steps, the transfer step, a capture-to step,
 * narrate-leave steps, and a narrate-arrive step. Capture/mutation ordering inside `steps` is the
 * one place order matters for walk correctness (PB-A/PB-J); narrate step position among them is
 * cosmetic, since delivery order comes from `slots`, not `steps` (PB-G: the messageOrchestration
 * bundle assigns `CreatedTime` in declared order at flush, fully decoupled from execution order).
 *
 * When `op.narration` is absent (object-lifecycle moves --- spawn/destroy/place/remove --- and,
 * until Phase 3, connect/disconnect/home), only the bare transfer step is emitted and `slots`
 * carries the header only (if any) --- no capture, no leave/arrive slots, matching those routes'
 * existing behavior exactly (nothing reports into a leave/arrive slot for them today).
 */
export const compilePositionKernelOp = (op: PositionKernelMoveOp): CompiledPositionKernelPlan => {
    const transferStep: MutationKernelTransferStep = {
        kind: 'transferMembership',
        entityIds: new Set([op.entityId]),
        fromHostIds: new Set(op.froms),
        toHostId: op.to,
    }

    const headerSlotList: MessageOrchestrationSlotSpec[] = op.headerSlot ? [op.headerSlot] : []

    if (!op.narration) {
        return { steps: [transferStep], slots: headerSlotList }
    }

    const { narration } = op

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
        direction: 'leave',
        captureId: captureIdForFrom(hostId),
        roomId: hostId,
        characterName: narration.characterName,
        copyKind: narration.leaveCopyKind(hostId),
        ...(narration.exitName !== undefined ? { exitName: narration.exitName } : {}),
        bundleId: op.bundleId,
        slotId: navigateLeaveSlotId(asRoomId(hostId)),
    }))

    const narrateArriveStep: KernelStep[] = op.to
        ? [{
            kind: 'narrate',
            direction: 'arrive',
            captureId: CAPTURE_ID_TO,
            roomId: op.to,
            characterName: narration.characterName,
            copyKind: narration.arriveCopyKind,
            bundleId: op.bundleId,
            slotId: NAVIGATE_ARRIVE_SLOT_ID,
        }]
        : []

    const slots: MessageOrchestrationSlotSpec[] = [
        ...op.froms.map((hostId) => ({
            slotId: navigateLeaveSlotId(asRoomId(hostId)),
            expectedPublishType: 'WorldMessage' as const,
        })),
        ...headerSlotList,
        ...(op.to ? [{ slotId: NAVIGATE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' as const }] : []),
    ]

    return {
        steps: [
            ...captureFromSteps,
            transferStep,
            ...captureToStep,
            ...narrateLeaveSteps,
            ...narrateArriveStep,
        ],
        slots,
    }
}
