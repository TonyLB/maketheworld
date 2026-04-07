/**
 * Render orchestration handler: {@link findRender} + terminal delivery via conversation `sendMessage`
 * after {@link intakeRenderRequested} (see `./requestIntake.ts`).
 *
 * {@link orchestrateRenderRequest} is the unified entry for passive single-item orchestration.
 *
 * Lives under `dataSource/renderOrchestration/` so ingress, intake, and orchestration (`findRender`, `generateRoomPreview`, …)
 * stay co-located with planning docs (`AGENT.planning.md`, etc.) in this directory.
 */
import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey as defaultComputePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus } from '../../messageBus/baseClasses'
import { isEphemeraCacheDynamoItem, type EphemeraCacheDynamoItem, type EphemeraCacheMarkState } from '../../renderCache/baseClasses'
import { markStatesEqual } from '../../renderCache/markStateUtils'
import {
    CONVERSATION_PAYLOAD_STUB,
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    isConversationCompositeReadHandleRoomStateRender,
} from '../../conversations/conversationTypes'
import type { ConversationId } from '../../conversations'
import type { RenderRequested } from './events'
import { isRenderResolveInputSuccess } from './baseClasses'
import { deliverIntakeErrorsIfAny } from './intakeErrors'
import { buildOrchestrationRouting } from './orchestrationRouting'
import { publishRenderOrchestrationStreamEvent, type RenderOrchestrationPublishedPayload } from './publishedEvents'
import { findRender } from './findRender'
import { generateRoomPreview } from './generateRoomPreview'
import { intakeRenderRequested } from './requestIntake'
import type { RequestIntakeDependencies } from './requestIntake'
import internalCache from '../../internalCache'

export type OrchestrationHandlerDependencies = {
    getCacheRecordById?: (roomId: EphemeraRoomId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>;
    getExactMatch?: (input: {
        componentId: EphemeraRoomId;
        proposedMarkState: EphemeraCacheMarkState;
        perspective: Perspective;
    }) => Promise<EphemeraCacheDynamoItem | null>;
    clearPerspectivePointer?: (roomId: EphemeraRoomId, perspectiveKey: string) => Promise<void>;
    computePerspectiveKey?: typeof defaultComputePerspectiveKey;
    markStatesEqual?: typeof markStatesEqual;
    /** Override for tests; default is {@link generateRoomPreview}. */
    generateRoomPreview?: typeof generateRoomPreview;
};

export type OrchestrationPipelineDependencies = RequestIntakeDependencies & OrchestrationHandlerDependencies

type OrchestrationHandlerDepsResolved = {
    getCacheRecordById: NonNullable<OrchestrationHandlerDependencies['getCacheRecordById']>;
    getExactMatch: NonNullable<OrchestrationHandlerDependencies['getExactMatch']>;
    clearPerspectivePointer: NonNullable<OrchestrationHandlerDependencies['clearPerspectivePointer']>;
    computePerspectiveKey: NonNullable<OrchestrationHandlerDependencies['computePerspectiveKey']>;
    markStatesEqual: NonNullable<OrchestrationHandlerDependencies['markStatesEqual']>;
    generateRoomPreview: typeof generateRoomPreview;
};

export const defaultGetCacheRecordById = async (
    roomId: EphemeraRoomId,
    cacheId: EphemeraCacheId
): Promise<EphemeraCacheDynamoItem | undefined> => {
    const item = await ephemeraDB.getItem({
        Key: { EphemeraId: roomId, DataCategory: cacheId },
        getAllFields: true
    })
    return isEphemeraCacheDynamoItem(item) ? item : undefined
}

export const defaultClearPerspectivePointer = async (roomId: EphemeraRoomId, perspectiveKey: string): Promise<void> => {
    await ephemeraDB.optimisticUpdate({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['currentCacheByPerspective'],
        updateReducer: (draft) => {
            if (draft.currentCacheByPerspective && typeof draft.currentCacheByPerspective === 'object') {
                delete draft.currentCacheByPerspective[perspectiveKey]
            }
        }
    })
    internalCache.ComponentEphemeraMeta.invalidate(roomId)
}

const getRoomStateRenderHandle = (
    conversationId: ConversationId,
    messageBus: MessageBus
) => {
    const composite = internalCache.Conversations.get(conversationId, { messageBus })
    const rawHandle = composite?.handle
    return rawHandle !== undefined && isConversationCompositeReadHandleRoomStateRender(rawHandle)
        ? rawHandle
        : undefined
}

/**
 * Single-item orchestration: intake, {@link deliverIntakeErrorsIfAny}, and {@link findRender}.
 */
export const orchestrateRenderRequest = async (
    {
        payload,
        messageBus,
        streamEvent,
    }: {
        payload: RenderRequested;
        messageBus: MessageBus;
        streamEvent: StreamEventFunction<RenderOrchestrationPublishedPayload>;
    },
    _deps?: OrchestrationPipelineDependencies
): Promise<void> => {
    const orchDeps: OrchestrationHandlerDepsResolved = {
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById,
        getExactMatch: _deps?.getExactMatch ?? ((input) => internalCache.RenderCache.getExactMatch(input)),
        clearPerspectivePointer: _deps?.clearPerspectivePointer ?? defaultClearPerspectivePointer,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? defaultComputePerspectiveKey,
        markStatesEqual: _deps?.markStatesEqual ?? markStatesEqual,
        generateRoomPreview: _deps?.generateRoomPreview ?? generateRoomPreview,
    }

    const intake = await intakeRenderRequested(payload, _deps)

    const conversationId = uuidv4() as ConversationId
    const perspectiveId = orchDeps.computePerspectiveKey(payload.perspective.assetStack)
    internalCache.Conversations.set({
        conversationId,
        type: CONVERSATION_TYPE_ROOM_STATE_RENDER,
        routing: {
            componentId: payload.componentId,
            perspectiveId,
            passiveBusDelivery: {
                perspective: payload.perspective,
                characterId: payload.characterId,
                targets: payload.targets,
                messageGroupId: payload.messageGroupId,
            },
        },
        payload: CONVERSATION_PAYLOAD_STUB,
    })

    const streamKey = payload.componentId
    const intakeErrorHandled = await deliverIntakeErrorsIfAny(intake, async (output) => {
        if (output.type === 'failed') {
            const routing = buildOrchestrationRouting(payload.componentId, payload.perspective, orchDeps.computePerspectiveKey)
            await publishRenderOrchestrationStreamEvent(streamEvent, streamKey, {
                type: 'Orchestration Error',
                ...routing,
                errorCode: output.errorCode,
                errorMessage: output.errorMessage,
            })
        }
        const roomStateHandle = getRoomStateRenderHandle(conversationId, messageBus)
        await roomStateHandle?.sendMessage(output)
    })
    if (intakeErrorHandled) {
        return
    }

    if (!isRenderResolveInputSuccess(intake)) {
        return
    }

    const publishOrchestration = async (content: RenderOrchestrationPublishedPayload) => {
        await publishRenderOrchestrationStreamEvent(streamEvent, streamKey, content)
    }

    await findRender(intake, {
        getExactMatch: orchDeps.getExactMatch,
        getCacheRecordById: orchDeps.getCacheRecordById,
        clearPerspectivePointer: orchDeps.clearPerspectivePointer,
        computePerspectiveKey: orchDeps.computePerspectiveKey,
        markStatesEqual: orchDeps.markStatesEqual,
        perspectiveMatches,
        publishOrchestration,
        sendMessage: async (arg) => {
            const roomStateHandle = getRoomStateRenderHandle(conversationId, messageBus)
            await roomStateHandle?.sendMessage(arg)
        },
        generateRoomPreview: orchDeps.generateRoomPreview,
    })
}
