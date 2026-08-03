import { v4 as uuidv4 } from 'uuid'
import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import internalCache from '../../internalCache'
import type { MessageBus, PublishTarget } from '../../messageBus/baseClasses'
import { resolveCanonAssetStackForRoom, resolveRoomAssetStackForRoom } from '../state/resolveAssetStackForRoom'
import { filterRoomCanonStackByCharacterAssets } from './fanOutStateChangedToPassiveRenders'
import { computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { orchestrateRenderRequest } from './orchestrationHandler'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import { prepareFeatureKnowledgeRenderForCharacter } from './prepareFeatureKnowledgeRenderForCharacter'
import { prepareObjectRenderForCharacter } from './prepareObjectRenderForCharacter'
import { prepareCharacterRenderForCharacter } from './prepareCharacterRenderForCharacter'
import { registerIngressSlot } from '../messageOrchestration'
import { sendMessageBundleDeclared } from '../messageOrchestration/subscribedEvents'
import type { MessageOrchestrationSlotSpec } from '../messageOrchestration/localApiEvents'
import { LOOK_DESCRIBE_SLOT_ID } from '../actions/lookBundleSlotIds'

export const prepareLookOrchestrationPerspective = async (
    characterId: EphemeraCharacterId,
    roomId: EphemeraRoomId,
): Promise<{ roomId: EphemeraRoomId; perspective: Perspective; perspectiveKey: string }> => {
    const roomAssetStack = await resolveRoomAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
    })
    const roomCanonStack = await resolveCanonAssetStackForRoom(roomId, {
        RoomAssets: internalCache.RoomAssets,
        AssetMetaData: internalCache.AssetMetaData,
    })
    const { assets: characterAssets = [] } = await internalCache.CharacterMeta.get(characterId) || {}
    const filteredAssetStack = filterRoomCanonStackByCharacterAssets(roomAssetStack, characterAssets, roomCanonStack)
    const perspective = { assetStack: filteredAssetStack }
    const perspectiveKey = computePerspectiveKey(perspective.assetStack)
    return { roomId, perspective, perspectiveKey }
}

/**
 * Declares a fresh one-slot messageOrchestration bundle and registers its ingress slot (Phase 7).
 * Minted locally here, not threaded through the `Look Command Requested` payload: every event this
 * handler processes maps 1:1 to its own invocation with no sibling slots to correlate with (unlike
 * navigate's leave/header/arrive, which are genuinely resolved by separate components) --- see the
 * planning doc's note on why the earlier declare-upstream-and-thread-through-the-payload shape was
 * simplified back out.
 */
async function registerLookSlot(
    bus: MessageBus,
    spec: Omit<MessageOrchestrationSlotSpec, 'slotId' | 'expectedPublishType'>,
    kickoff: () => Promise<void>
): Promise<void> {
    const bundleId = uuidv4()
    sendMessageBundleDeclared(bus, bundleId, {
        bundleId,
        slots: [{ slotId: LOOK_DESCRIBE_SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
    })
    await registerIngressSlot(
        bus,
        bundleId,
        { ...spec, slotId: LOOK_DESCRIBE_SLOT_ID, expectedPublishType: 'PerceptionMessage' } as MessageOrchestrationSlotSpec,
        kickoff
    )
}

/**
 * Event-driven look: register a messageOrchestration ingress slot (Phase 7), then run passive
 * orchestration as this slot's kickoff. Dispatches by `componentId` kind (room vs feature/knowledge
 * vs object).
 */
export async function handleLookCommandRequestedForRenderOrchestration(
    messageBus: MessageBus,
    payload: LookCommandRequestedPublishedPayload,
    streamEvent: StreamEventFunction<RenderOrchestrationPublishedPayload>,
): Promise<void> {
    const { componentId, characterId } = payload

    if (isEphemeraRoomId(componentId)) {
        const { perspective, perspectiveKey } = await prepareLookOrchestrationPerspective(
            characterId,
            componentId,
        )
        await registerLookSlot(
            messageBus,
            { componentId, perspectiveKey, targets: [characterId], contentStream: 'render', format: 'full' },
            async () => {
                await orchestrateRenderRequest({
                    payload: {
                        type: 'RenderRequested',
                        componentId,
                        perspective,
                        characterId,
                    },
                    streamEvent,
                })
            }
        )
        return
    }

    if (isEphemeraFeatureId(componentId) || isEphemeraKnowledgeId(componentId)) {
        const prepared = await prepareFeatureKnowledgeRenderForCharacter(characterId, componentId)
        const targets: PublishTarget[] = payload.directResponse
            ? [`SESSION#${await internalCache.Global.get('SessionId')}` as PublishTarget]
            : [characterId]
        await registerLookSlot(
            messageBus,
            { componentId, perspectiveKey: prepared.perspectiveKey, targets, contentStream: 'render', format: 'full' },
            async () => {
                await orchestrateRenderRequest({
                    payload: {
                        type: 'RenderRequested',
                        ...prepared.renderCommand,
                    },
                    streamEvent,
                })
            }
        )
        return
    }

    if (isEphemeraObjectId(componentId)) {
        // Object (see `perception/AGENT.md`, Correlated Object description): reuses the same
        // register-then-orchestrate pipeline as Room/Feature/Knowledge, riding the real
        // `ensureAuthoredCatalog` (Phase 4) --- no override. Object's name is still guaranteed even
        // without an authored `SITUATION#DEFAULT` facet via the live-shortName fallback in
        // `objectRenderWmlFromCacheRecord`/`orchestrate.ts`'s `handleObjectRenderPertains`, not this seam.
        const prepared = await prepareObjectRenderForCharacter(characterId, componentId)
        await registerLookSlot(
            messageBus,
            { componentId, perspectiveKey: prepared.perspectiveKey, targets: [characterId], contentStream: 'render', format: 'full' },
            async () => {
                await orchestrateRenderRequest({
                    payload: {
                        type: 'RenderRequested',
                        ...prepared.renderCommand,
                    },
                    streamEvent,
                })
            }
        )
        return
    }

    if (isEphemeraCharacterId(componentId)) {
        // Character is an "authored" render-cache kind (real render content, per
        // requestIntake.ts's isCacheOnlyHost grouping), not a stub like Object --- so this uses the
        // real ensureAuthoredCatalog, no override. Perspective is resolved against the *acting*
        // character's own asset stack (RH-1), not the target's.
        const prepared = await prepareCharacterRenderForCharacter(characterId, componentId)
        await registerLookSlot(
            messageBus,
            { componentId, perspectiveKey: prepared.perspectiveKey, targets: [characterId], contentStream: 'render', format: 'full' },
            async () => {
                await orchestrateRenderRequest({
                    payload: {
                        type: 'RenderRequested',
                        ...prepared.renderCommand,
                    },
                    streamEvent,
                })
            }
        )
    }
}
