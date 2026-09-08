import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ActionsPublishedPayload } from '../../actions/publishedEvents'
import { MessageBus } from '../../../messageBus/baseClasses'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { kickPassiveRenderRequestedForCharacterInRoom } from '../../perception/kickRoomHeaderBroadcast'
import { sendMessageBundleDeclared } from '../../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../../messageOrchestration'
import { presentStepSequence } from '../manipulation/kernel/presentStepSequence'
import type { MutationKernelCaptures } from '../manipulation/kernel/types'
import type { CompiledPositionKernelPlan } from '../manipulation/kernel/compile/compilePositionKernelOp'
import { NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'

/** Navigate's compiled narration never includes a `describe` step (the header renders through the ingress-slot mechanism below, not this pipeline), so this dep is structurally unused --- present only because `PresentStepSequenceDeps` requires it. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type OrchestrateCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    characterMeta: CharacterMetaItem;
    to: EphemeraRoomId | null;
    /** messageOrchestration bundle correlation id; defaults to a fresh uuidv4() when the caller (connect/disconnect/repair) has no matching intent-leg bundleId. */
    bundleId?: string;
    /**
     * The plan `planCharacterMoveTransfer` already compiled pre-commit (3e, MS-2) --- this function
     * presents it, it does not rebuild it. Absent means the move had nothing to compile (repair's own
     * navigate-tail calls, which have no matching intent) and only the header-render machinery below
     * runs, unchanged from before.
     */
    plan?: CompiledPositionKernelPlan;
    /** The commit's captured rosters, from `orchestrateCharacterRoomMembership`'s result --- required to resolve narration audiences. */
    captures?: MutationKernelCaptures;
    messageBus: MessageBus;
}

/**
 * Post-persist navigate presentation (S1-13): declares this move's messageOrchestration bundle and
 * reports its narration, resolves the header slot
 * via the async render pipeline's Ingress registration, imperative header fallback. Does not perform
 * membership Dynamo writes or `RoomUpdate`/`EphemeraUpdate` (coordinator owns those).
 *
 * The `Move` op is built and compiled exactly **once**, pre-commit, by `planCharacterMoveTransfer`
 * (3e, MS-2) --- including the header slot, since `to` and `characterMeta.assets` (the only inputs
 * `getCharacterRoomPerspectiveKey` needs) are both known before commit. This function only presents
 * the resulting plan; whether a header slot was declared is read back off `plan.slots` rather than
 * re-resolved. Connect passes a plan built with `intentKind: 'connect'` and flows through this same
 * function --- it always has a destination room, so the header-render logic applies unchanged.
 * Disconnect (and the ghost-purge repair sweep) never reach this function at all --- they have no
 * destination room to render a header for --- see `orchestrateCharacterDisconnect.ts`.
 */
export const orchestrateCharacterNavigate = async ({
    characterId,
    characterMeta,
    to,
    bundleId: suppliedBundleId,
    plan,
    captures,
    messageBus,
}: OrchestrateCharacterNavigateArgs): Promise<void> => {
    if (!to || !plan) {
        return
    }

    const bundleId = suppliedBundleId ?? uuidv4()
    const headerSlotSpec = plan.slots.find((slot) => slot.slotId === NAVIGATE_HEADER_SLOT_ID) ?? null

    if (plan.slots.length > 0) {
        sendMessageBundleDeclared(messageBus, bundleId, { bundleId, slots: [...plan.slots] })
    }

    await presentStepSequence(
        plan.steps,
        characterId,
        { streamEvent: noopActionsStreamEvent, messageBus },
        captures
    )

    let registeredCharacterMove = false

    if (headerSlotSpec) {
        await registerIngressSlot(messageBus, bundleId, headerSlotSpec, async () => {
            await kickPassiveRenderRequestedForCharacterInRoom({
                roomId: to,
                characterId,
                assets: characterMeta.assets || [],
                messageBus,
            })
        })
        registeredCharacterMove = true
    }

    if (!registeredCharacterMove) {
        messageBus.publish({
            type: 'Perception',
            characterId,
            ephemeraId: to,
            header: true,
        })
    }
}
