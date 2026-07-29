/**
 * Session orientation kick on `mtw.connections` / `Character Registered`.
 *
 * Resolves room + canon-filtered perspective from play membership (or eviction ladder
 * when out of play), registers a channel-specific perception thread with `CHARACTER#` targets, and kicks orchestration
 * with routing identity only (no delivery fields on orchestration ingress).
 *
 * Each orchestration DataSource calls this with its own `channel` so both threads
 * register in parallel without double-registering from a monolithic helper.
 *
 * Cross-layer integration: ../characterRegisteredOrientation.integration.test.ts
 */
import { v4 as uuidv4 } from 'uuid'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { ConnectionsCharacterRegisteredEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/connections'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import internalCache from '../../internalCache'
import type { PublishTarget } from '../../messageBus/baseClasses'
import type { MessageBus } from '../../messageBus/baseClasses'
import { resolveCharacterRoomId } from '../positions/membership/resolveCharacterRoomId'
import { resolveCharacterRoomPerspectiveForRoom } from '../perception/kickRoomHeaderBroadcast'
import { sendPerceptionThreadRegistered } from '../perception/subscribedEvents'
import { orchestrateAffordanceRequest } from '../affordanceOrchestration/orchestrationHandler'
import type { AffordanceOrchestrationPublishedPayload } from '../affordanceOrchestration/publishedEvents'
import { orchestrateRenderRequest } from '../renderOrchestration/orchestrationHandler'
import type { RenderOrchestrationPublishedPayload } from '../renderOrchestration/publishedEvents'
import { sendMessageBundleDeclared } from '../messageOrchestration/subscribedEvents'
import { registerIngressSlot } from '../messageOrchestration'

const SESSION_ORIENTATION_RENDER_SLOT_ID = 'sessionOrientationRender'

export type SessionOrientationChannel = 'render' | 'affordances'

const LOG_PREFIX = '[mtw.ephemera.connectionsCharacterRegistered] sessionOrientation'

export type SessionOrientationSkipReason = 'no_room' | 'no_perspective'

export type SessionOrientationContext = {
    characterId: EphemeraCharacterId;
    roomId: EphemeraRoomId;
    perspective: Perspective;
    perspectiveKey: string;
    targets: PublishTarget[];
}

export type ResolveSessionOrientationContextDeps = {
    resolveCharacterRoomId?: typeof resolveCharacterRoomId;
    characterMetaGet?: (characterId: EphemeraCharacterId) => Promise<{ assets?: readonly string[] } | undefined>;
    resolvePerspective?: (
        roomId: EphemeraRoomId,
        characterAssets: readonly string[]
    ) => Promise<{ perspective: Perspective; perspectiveKey: string } | null>;
}

export async function resolveSessionOrientationContext(
    event: ConnectionsCharacterRegisteredEvent,
    deps?: ResolveSessionOrientationContextDeps
): Promise<SessionOrientationContext | null> {
    const { characterId } = event
    const resolveRoomId = deps?.resolveCharacterRoomId ?? resolveCharacterRoomId
    const characterMetaGet = deps?.characterMetaGet ?? ((id: EphemeraCharacterId) => internalCache.CharacterMeta.get(id))
    const resolvePerspective = deps?.resolvePerspective ?? resolveCharacterRoomPerspectiveForRoom

    const roomId = await resolveRoomId(characterId)
    const meta = await characterMetaGet(characterId)
    const resolved = await resolvePerspective(roomId, meta?.assets ?? [])
    if (!resolved) {
        return null
    }

    const { perspective, perspectiveKey } = resolved
    const targets: PublishTarget[] = [characterId]

    return {
        characterId,
        roomId,
        perspective,
        perspectiveKey,
        targets,
    }
}

async function resolveSessionOrientationSkipReason(
    _event: ConnectionsCharacterRegisteredEvent,
    _deps?: ResolveSessionOrientationContextDeps
): Promise<SessionOrientationSkipReason> {
    return 'no_perspective'
}

export async function handleCharacterRegisteredOrientation(
    messageBus: MessageBus,
    event: ConnectionsCharacterRegisteredEvent,
    channel: SessionOrientationChannel,
    deps?: ResolveSessionOrientationContextDeps,
    streamEvent?: StreamEventFunction<RenderOrchestrationPublishedPayload> | StreamEventFunction<AffordanceOrchestrationPublishedPayload>,
): Promise<void> {
    const { characterId, sessionId } = event
    const context = await resolveSessionOrientationContext(event, deps)
    if (!context) {
        const reason = await resolveSessionOrientationSkipReason(event, deps)
        console.log(LOG_PREFIX, {
            event: 'skip',
            channel,
            characterId,
            sessionId,
            reason,
        })
        return
    }

    const { roomId, perspective, perspectiveKey, targets } = context

    if (channel === 'render') {
        if (!streamEvent) {
            throw new Error('sessionOrientation render channel requires streamEvent')
        }
        const bundleId = uuidv4()
        sendMessageBundleDeclared(messageBus, bundleId, {
            bundleId,
            slots: [{ slotId: SESSION_ORIENTATION_RENDER_SLOT_ID, expectedPublishType: 'PerceptionMessage' }],
        })
        await registerIngressSlot(
            messageBus,
            bundleId,
            {
                slotId: SESSION_ORIENTATION_RENDER_SLOT_ID,
                expectedPublishType: 'PerceptionMessage',
                componentId: roomId,
                perspectiveKey,
                targets,
                contentStream: 'render',
                format: 'header',
            },
            async () => {
                await orchestrateRenderRequest({
                    payload: {
                        type: 'RenderRequested',
                        componentId: roomId,
                        perspective,
                    },
                    streamEvent: streamEvent as StreamEventFunction<RenderOrchestrationPublishedPayload>,
                })
            }
        )
        console.log(LOG_PREFIX, {
            event: 'kicked',
            channel,
            characterId,
            sessionId,
            roomId,
            perspectiveKey,
            targets,
            threadKind: 'sessionOrientationRender',
            orchestrationKick: 'orchestrateRenderRequest',
        })
        return
    }

    sendPerceptionThreadRegistered(messageBus, roomId, {
        threadKind: 'sessionOrientationAffordances',
        componentId: roomId,
        perspectiveKey,
        characterId,
        targets,
    })
    if (!streamEvent) {
        throw new Error('sessionOrientation affordances channel requires streamEvent')
    }
    await orchestrateAffordanceRequest({
        payload: {
            type: 'AffordancesRequested',
            roomId,
            perspective,
            reason: 'roster',
        },
        streamEvent: streamEvent as StreamEventFunction<AffordanceOrchestrationPublishedPayload>,
    })
    console.log(LOG_PREFIX, {
        event: 'kicked',
        channel,
        characterId,
        sessionId,
        roomId,
        perspectiveKey,
        targets,
        threadKind: 'sessionOrientationAffordances',
        orchestrationKick: 'orchestrateAffordanceRequest',
    })
}
