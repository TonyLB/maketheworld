import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ActionsPublishedPayload } from '../../../actions/publishedEvents'
import { MessageBus } from '../../../../messageBus/baseClasses'
import { sendMessageBundleDeclared } from '../../../messageOrchestration/subscribedEvents'
import { presentStepSequence } from '../kernel/presentStepSequence'
import type { MutationKernelCaptures } from '../kernel/types'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'

/** Disconnect's compiled narration never includes a `describe` step, same as navigate's --- see `orchestrateNavigate.ts`'s identical noop. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type OrchestrateCharacterDisconnectArgs = {
    characterId: EphemeraCharacterId;
    bundleId: string;
    /** The plan `planCharacterMoveTransfer` already compiled pre-commit (3e, MS-2) --- this function presents it, it does not rebuild it. Absent (or a no-op move, `froms.length === 0`) means there is nothing to present. */
    plan?: CompiledPositionKernelPlan;
    /** The commit's captured rosters, from `orchestrateCharacterRoomMembership`'s result --- required to resolve narration audiences. */
    captures?: MutationKernelCaptures;
    messageBus: MessageBus;
}

/**
 * Post-persist disconnect presentation: the
 * narration-only half of what `orchestrateCharacterNavigate` does for a destination room. Disconnect
 * (and the ghost-purge repair sweep in `repairRoomOccupancyDrift.ts`, which shares this function) has
 * no `to` --- nothing arrives anywhere, so there is no header slot to resolve, no
 * `registerIngressSlot`, no `Perception` publish fallback. It only declares the bundle (when the
 * compiled plan produced any slots) and presents the compiled narrate-leave step(s). A dedicated
 * function rather than widening `orchestrateCharacterNavigate`'s `to !== null` guard, since that
 * function's header-rendering logic is not a case disconnect ever exercises.
 */
export const orchestrateCharacterDisconnect = async ({
    characterId,
    bundleId,
    plan,
    captures,
    messageBus,
}: OrchestrateCharacterDisconnectArgs): Promise<void> => {
    if (!plan) {
        return
    }

    if (plan.slots.length > 0) {
        sendMessageBundleDeclared(messageBus, bundleId, { bundleId, slots: [...plan.slots] })
    }

    await presentStepSequence(
        plan.steps,
        characterId,
        { streamEvent: noopActionsStreamEvent, messageBus },
        captures
    )
}
