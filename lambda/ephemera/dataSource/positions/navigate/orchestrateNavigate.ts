import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { MessageBus } from '../../../messageBus/baseClasses'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import {
    getCharacterRoomPerspectiveKey,
    kickPassiveRenderRequestedForCharacterInRoom,
} from '../../perception/kickRoomHeaderBroadcast'
import { inferMembershipEmissionShape } from '../../perception/membershipPresentationFanIn'
import { sendMessageBundleDeclared } from '../../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../../messageOrchestration'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'
import { navigateLeaveSlotId, NAVIGATE_ARRIVE_SLOT_ID, NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'

export type OrchestrateCharacterNavigateArgs = {
    characterId: EphemeraCharacterId;
    characterMeta: CharacterMetaItem;
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    /** messageOrchestration bundle correlation id; defaults to a fresh uuidv4() when the caller (connect/disconnect/repair) has no matching intent-leg bundleId. */
    bundleId?: string;
    messageBus: MessageBus;
}

/**
 * Post-persist navigate presentation (S1-13): declares this move's messageOrchestration bundle
 * (leave/arrive slots resolved by membership presentation fan-in, header slot resolved by the
 * async render pipeline via the seam's Ingress registration), imperative header fallback.
 * Does not perform membership Dynamo writes or RoomUpdate / EphemeraUpdate (coordinator owns those).
 */
export const orchestrateCharacterNavigate = async ({
    characterId,
    characterMeta,
    froms,
    to,
    bundleId: suppliedBundleId,
    messageBus,
}: OrchestrateCharacterNavigateArgs): Promise<void> => {
    if (!to || (froms.length === 1 && froms[0] === to)) {
        return
    }

    const bundleId = suppliedBundleId ?? uuidv4()
    const shape = inferMembershipEmissionShape(froms, to)
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

    const slots: MessageOrchestrationSlotSpec[] = [
        ...((shape === 'leaveOnly' || shape === 'leaveAndArrive')
            ? froms.map((roomId) => ({ slotId: navigateLeaveSlotId(roomId), expectedPublishType: 'WorldMessage' as const }))
            : []),
        ...(headerSlotSpec ? [headerSlotSpec] : []),
        ...((shape === 'arriveOnly' || shape === 'leaveAndArrive')
            ? [{ slotId: NAVIGATE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' as const }]
            : []),
    ]
    if (slots.length > 0) {
        sendMessageBundleDeclared(messageBus, bundleId, { bundleId, slots })
    }

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
