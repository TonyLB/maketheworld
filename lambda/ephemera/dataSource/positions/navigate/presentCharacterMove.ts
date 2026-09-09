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

export type PresentCharacterMoveArgs = {
    characterId: EphemeraCharacterId;
    /** Only read when `to !== null` and the plan carries a header slot; disconnect/repair callers omit it. */
    characterMeta?: CharacterMetaItem;
    to: EphemeraRoomId | null;
    /** messageOrchestration bundle correlation id; defaults to a fresh uuidv4() when the caller (connect/disconnect/repair) has no matching intent-leg bundleId. */
    bundleId?: string;
    /**
     * The plan `planCharacterMoveTransfer` already compiled pre-commit (3e, MS-2) --- this function
     * presents it, it does not rebuild it. Absent means the move had nothing to compile (an unchanged
     * membership, or repair's own navigate-tail calls with no matching intent).
     */
    plan?: CompiledPositionKernelPlan;
    /** The commit's captured rosters, from `orchestrateCharacterRoomMembership`'s result --- required to resolve narration audiences. */
    captures?: MutationKernelCaptures;
    messageBus: MessageBus;
}

/**
 * Post-persist character-move presentation (S1-13, merged with disconnect's presentation 3f/MS-6):
 * declares this move's messageOrchestration bundle, presents its compiled narration, and --- only
 * when there is a destination room (`to !== null`) --- resolves the arrival header slot via the async
 * render pipeline's Ingress registration, falling back to an imperative `Perception` publish when the
 * plan carries no header slot. Does not perform membership Dynamo writes or `RoomUpdate`/`EphemeraUpdate`
 * (the coordinator owns those). Named `present*`, not `orchestrate*`: it never calls commit, so under
 * the Phase 3 tier rule it does the core work of exactly one tier.
 *
 * The `Move` op is built and compiled exactly **once**, pre-commit, by `planCharacterMoveTransfer`
 * (3e, MS-2) --- including the header slot, since `to` and `characterMeta.assets` (the only inputs
 * `getCharacterRoomPerspectiveKey` needs) are both known before commit. This function only presents
 * the resulting plan; whether a header slot was declared is read back off `plan.slots` rather than
 * re-resolved. Connect passes a plan built with `intentKind: 'connect'` and flows through this same
 * path as navigate --- it always has a destination room. Disconnect and the ghost-purge repair sweep
 * pass `to: null`: `planCharacterMoveTransfer` never resolves a header slot for a null destination, so
 * the header branch below is unreachable for them, and only the bundle-declare/present prefix runs.
 */
export const presentCharacterMove = async ({
    characterId,
    characterMeta,
    to,
    bundleId: suppliedBundleId,
    plan,
    captures,
    messageBus,
}: PresentCharacterMoveArgs): Promise<void> => {
    if (!plan) {
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

    if (headerSlotSpec) {
        if (to === null) {
            throw new Error('presentCharacterMove: a header slot was compiled without a destination room')
        }
        const destinationRoomId = to
        await registerIngressSlot(messageBus, bundleId, headerSlotSpec, async () => {
            await kickPassiveRenderRequestedForCharacterInRoom({
                roomId: destinationRoomId,
                characterId,
                assets: characterMeta?.assets || [],
                messageBus,
            })
        })
    } else if (to !== null) {
        messageBus.publish({
            type: 'Perception',
            characterId,
            ephemeraId: to,
            header: true,
        })
    }
}
