import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ActionsPublishedPayload } from '../../actions/publishedEvents'
import { MessageBus } from '../../../messageBus/baseClasses'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import {
    getCharacterRoomPerspectiveKey,
    kickPassiveRenderRequestedForCharacterInRoom,
} from '../../perception/kickRoomHeaderBroadcast'
import { sendMessageBundleDeclared } from '../../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../../messageOrchestration'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'
import { presentStepSequence } from '../manipulation/kernel/presentStepSequence'
import type { MutationKernelCaptures } from '../manipulation/kernel/types'
import { compilePositionKernelOp } from '../manipulation/kernel/compile/compilePositionKernelOp'
import type { PositionKernelMoveOp } from '../manipulation/kernel/compile/positionKernelOp'
import { buildNavigateMoveOp } from './buildNavigateMoveOp'
import { NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'

/** Navigate's compiled narration never includes a `describe` step (the header renders through the ingress-slot mechanism below, not this pipeline), so this dep is structurally unused --- present only because `PresentStepSequenceDeps` requires it. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

export type OrchestrateCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    characterMeta: CharacterMetaItem;
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    /** messageOrchestration bundle correlation id; defaults to a fresh uuidv4() when the caller (connect/disconnect/repair) has no matching intent-leg bundleId. */
    bundleId?: string;
    /** Threaded from `executeCharacterNavigate.ts` --- see `buildNavigateMoveOp.ts` for how these select copy-kind. Absent (connect/disconnect/repair) means no narration is compiled here; those routes stay on the old async fan-in path until Phase 3. */
    intentKind?: 'navigate' | 'home';
    intentFromRoomId?: EphemeraRoomId;
    exitName?: string;
    /** The commit's captured rosters, from `applyCharacterRoomMembership`'s result --- required to resolve narration audiences. */
    captures?: MutationKernelCaptures;
    messageBus: MessageBus;
}

/**
 * Post-persist navigate presentation (S1-13): declares this move's messageOrchestration bundle and
 * reports its narration (Phase 2, `AGENT.presentationKernel.planning.md`), resolves the header slot
 * via the async render pipeline's Ingress registration, imperative header fallback. Does not perform
 * membership Dynamo writes or `RoomUpdate`/`EphemeraUpdate` (coordinator owns those).
 *
 * The `Move` op is compiled a **second** time here (`executeCharacterNavigate.ts` already compiled it
 * once, pre-commit, for the mutation-only step subset) --- this call additionally has the resolved
 * `headerSlot`, which only affects `slots` ordering, never `steps`; `compilePositionKernelOp`'s
 * capture ids are pure functions of `froms`/`to` alone, so both compiles agree on the same ids and
 * the narration steps built here resolve against captures taken by the other call's committed
 * transaction. When `intentKind` is absent (connect/disconnect/repair, not migrated this phase), no
 * narration is compiled and only the header-render machinery below runs, unchanged from before.
 */
export const orchestrateCharacterNavigate = async ({
    characterId,
    characterMeta,
    froms,
    to,
    bundleId: suppliedBundleId,
    intentKind,
    intentFromRoomId,
    exitName,
    captures,
    messageBus,
}: OrchestrateCharacterNavigateArgs): Promise<void> => {
    if (!to || (froms.length === 1 && froms[0] === to)) {
        return
    }

    const bundleId = suppliedBundleId ?? uuidv4()
    const perspectiveKey = await getCharacterRoomPerspectiveKey(
        to,
        characterMeta.assets || []
    )

    const headerSlotSpec: MessageOrchestrationSlotSpec | null = perspectiveKey ? {
        slotId: NAVIGATE_HEADER_SLOT_ID,
        expectedPublishType: 'PerceptionMessage',
        componentId: to,
        perspectiveKey,
        targets: [characterId],
        contentStream: 'render',
        format: 'header',
    } : null

    const op: PositionKernelMoveOp = intentKind
        ? buildNavigateMoveOp({
            characterId,
            characterName: characterMeta.Name,
            froms,
            to,
            bundleId,
            intentKind,
            intentFromRoomId,
            exitName,
            headerSlot: headerSlotSpec,
        })
        : { kind: 'move', entityId: characterId, froms, to, bundleId, headerSlot: headerSlotSpec }

    const plan = compilePositionKernelOp(op)

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
