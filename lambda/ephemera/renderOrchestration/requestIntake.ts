/**
 * Passive `RenderRequested` intake: Meta pointer, exact-match, optional generation when
 * {@link RenderResolveInput.allowGeneration} is set.
 *
 * **Delivery note:** Intermediate and terminal messages are published via `messageBus` (e.g. `RenderReady`,
 * `RenderLookupRequested`, `Error`). There may be no subscribers yet that forward these to clients; and
 * under the current `messageBus` flush model, nested sends may not be observable until the active handler
 * completes. See `renderOrchestration/AGENT.planning.simplification.md`.
 */
import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { findRender } from './findRender'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { MessageBus } from '../messageBus/baseClasses'
import { isEphemeraCacheDynamoItem, type EphemeraCacheDynamoItem, type EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/markStateUtils'
import {
    CONVERSATION_PAYLOAD_STUB,
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    isConversationCompositeReadHandleRoomStateRender,
} from '../conversations/conversationTypes'
import type { RenderRequested } from './events'
import type { RenderResolveInput, RenderResolveOutput } from './baseClasses'
import { deliverRenderResolveForPassive } from './deliverRenderResolve'
import { generateRoomPreview } from './generateRoomPreview'
import internalCache from '../internalCache'

export type RequestIntakeDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    getCacheRecordById?: (roomId: EphemeraRoomId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>;
    getExactMatch?: (input: {
        componentId: EphemeraRoomId;
        proposedMarkState: EphemeraCacheMarkState;
        perspective: Perspective;
    }) => Promise<EphemeraCacheDynamoItem | null>;
    clearPerspectivePointer?: (roomId: EphemeraRoomId, perspectiveKey: string) => Promise<void>;
    computePerspectiveKey?: typeof computePerspectiveKey;
    markStatesEqual?: typeof markStatesEqual;
    /** Override for tests; default is {@link generateRoomPreview}. */
    generateRoomPreview?: typeof generateRoomPreview;
}

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    await ephemeraDB.getItem<EphemeraMetaRoom>({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        getAllFields: true
    }) ?? undefined
)

const defaultGetCacheRecordById = async (
    roomId: EphemeraRoomId,
    cacheId: EphemeraCacheId
): Promise<EphemeraCacheDynamoItem | undefined> => {
    const item = await ephemeraDB.getItem({
        Key: { EphemeraId: roomId, DataCategory: cacheId },
        getAllFields: true
    })
    return isEphemeraCacheDynamoItem(item) ? item : undefined
}

const defaultClearPerspectivePointer = async (roomId: EphemeraRoomId, perspectiveKey: string): Promise<void> => {
    await ephemeraDB.optimisticUpdate({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['currentCacheByPerspective'],
        updateReducer: (draft) => {
            if (draft.currentCacheByPerspective && typeof draft.currentCacheByPerspective === 'object') {
                delete draft.currentCacheByPerspective[perspectiveKey]
            }
        }
    })
}

type RequestIntakeDepsResolved = Required<Omit<RequestIntakeDependencies, 'generateRoomPreview'>> & {
    generateRoomPreview: typeof generateRoomPreview;
}

/**
 * When exact-match fails and {@link RenderResolveInput.allowGeneration} is set, mint a conversation id,
 * register `roomStateRender`, and run the shared slow-path generator (same core as preview).
 * Returns `null` when generation is not allowed (caller should hand off to lookup).
 */
const tryRequestIntakeGeneration = async (
    resolve: RenderResolveInput,
    deps: RequestIntakeDepsResolved
): Promise<RenderResolveOutput | null> => {
    if (!resolve.allowGeneration) {
        return null
    }

    const conversationId = uuidv4()
    const perspectiveId = deps.computePerspectiveKey(resolve.perspective.assetStack)
    internalCache.Conversations.set({
        conversationId,
        type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
        routing: { roomId: resolve.roomId, perspectiveId },
        payload: CONVERSATION_PAYLOAD_STUB,
    })

    const composite = internalCache.Conversations.get(conversationId)
    const rawHandle = composite?.handle
    const roomStateHandle =
        rawHandle !== undefined && isConversationCompositeReadHandleRoomStateRender(rawHandle)
            ? rawHandle
            : undefined

    const result = await deps.generateRoomPreview(
        {
            roomId: resolve.roomId,
            markState: resolve.markState,
            assetStack: resolve.perspective.assetStack,
            generationContextWml: resolve.generationContextWml,
        },
        {
            conversationId,
            onGenerating: async () => {
                await roomStateHandle?.sendMessage('generating')
            },
        }
    )

    if (result.success) {
        return {
            type: 'resolved',
            renderedContent: result.renderedContent,
            cacheId: result.cacheId,
            cacheRecord: result.cacheRecord,
        }
    }
    return {
        type: 'failed',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
    }
}

/**
 * Core room path: Meta::Room load, pointer validation, exact-match, pointer clear.
 * Returns {@link RenderResolveOutput} (no bus delivery). Caller must have verified `componentId` is a room.
 */
const executeRequestIntakeResolve = async (
    payload: RenderRequested,
    roomId: EphemeraRoomId,
    deps: RequestIntakeDepsResolved
): Promise<RenderResolveOutput> => {
    const metaRoom = await deps.getMetaRoom(roomId)
    const stateMarks = metaRoom?.state?.marks
    const perspective = payload.perspective

    if (!stateMarks) {
        return {
            type: 'failed',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: `RenderRequested requires Meta::Room.state.marks for ${payload.componentId}`,
        }
    }

    const perspectiveKey = deps.computePerspectiveKey(perspective.assetStack)
    const pointerId = metaRoom?.currentCacheByPerspective?.[perspectiveKey] as EphemeraCacheId | undefined

    const resolve: RenderResolveInput = {
        roomId,
        perspective,
        markState: stateMarks,
        markProvenance: 'meta',
        allowGeneration: payload.allowGeneration,
        generationContextWml: payload.generationContextWml,
        ...(pointerId !== undefined ? { pointerHint: pointerId } : {}),
    }

    return findRender(resolve, {
        getExactMatch: deps.getExactMatch,
        getCacheRecordById: deps.getCacheRecordById,
        clearPerspectivePointer: deps.clearPerspectivePointer,
        computePerspectiveKey: deps.computePerspectiveKey,
        markStatesEqual: deps.markStatesEqual,
        perspectiveMatches,
        tryGeneration: (r) => tryRequestIntakeGeneration(r, deps),
    })
}

export const requestIntakeMessage = async (
    { payloads, messageBus }: { payloads: RenderRequested[]; messageBus: MessageBus },
    _deps?: RequestIntakeDependencies
): Promise<void> => {
    const deps: RequestIntakeDepsResolved = {
        getMetaRoom: _deps?.getMetaRoom ?? defaultGetMetaRoom,
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById,
        getExactMatch: _deps?.getExactMatch ?? ((input) => internalCache.RenderCache.getExactMatch(input)),
        clearPerspectivePointer: _deps?.clearPerspectivePointer ?? defaultClearPerspectivePointer,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? computePerspectiveKey,
        markStatesEqual: _deps?.markStatesEqual ?? markStatesEqual,
        generateRoomPreview: _deps?.generateRoomPreview ?? generateRoomPreview,
    }

    await Promise.all(payloads.map(async (payload) => {
        if (!isEphemeraRoomId(payload.componentId)) {
            deliverRenderResolveForPassive(payload, messageBus, { type: 'lookup_handoff' })
            return
        }

        const output = await executeRequestIntakeResolve(payload, payload.componentId, deps)
        deliverRenderResolveForPassive(payload, messageBus, output)
    }))
}

export default requestIntakeMessage

