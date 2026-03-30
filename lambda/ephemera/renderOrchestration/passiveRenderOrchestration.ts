/**
 * Passive B-phase hook and orchestration shell: {@link findRender} + terminal delivery via roomStateRender
 * `sendMessage` after {@link intakePassiveRenderRequested} (see `requestIntake.ts`).
 */
import { v4 as uuidv4 } from 'uuid'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey as defaultComputePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../messageBus/baseClasses'
import { isEphemeraCacheDynamoItem, type EphemeraCacheDynamoItem, type EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/markStateUtils'
import {
    CONVERSATION_PAYLOAD_STUB,
    CONVERSATION_TYPE_ROOM_STATE_RENDER,
    isConversationCompositeReadHandleRoomStateRender,
} from '../conversations/conversationTypes'
import type { ConversationId } from '../conversations'
import { toRenderError, type RenderRequested } from './events'
import type { RenderResolveOutput } from './baseClasses'
import { RENDER_ERROR_CODE_NOT_ROOM } from '../conversations/conversationTypes/roomStateRender/baseClasses'
import { findRender } from './findRender'
import { generateRoomPreview } from './generateRoomPreview'
import { intakePassiveRenderRequested } from './requestIntake'
import type { RequestIntakeDependencies } from './requestIntake'
import internalCache from '../internalCache'

export type PassiveOrchestrationDependencies = {
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

export type PassiveRenderPipelineDependencies = RequestIntakeDependencies & PassiveOrchestrationDependencies

type PassiveOrchestrationDepsResolved = {
    getCacheRecordById: NonNullable<PassiveOrchestrationDependencies['getCacheRecordById']>;
    getExactMatch: NonNullable<PassiveOrchestrationDependencies['getExactMatch']>;
    clearPerspectivePointer: NonNullable<PassiveOrchestrationDependencies['clearPerspectivePointer']>;
    computePerspectiveKey: NonNullable<PassiveOrchestrationDependencies['computePerspectiveKey']>;
    markStatesEqual: NonNullable<PassiveOrchestrationDependencies['markStatesEqual']>;
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
 * Passive shell: intake -> {@link findRender} -> terminal delivery via roomStateRender `sendMessage`
 * (materializes to the same bus mapping as `materializeRoomStateRender`).
 */
export const orchestratePassiveRenderRequestedBatch = async (
    { payloads, messageBus }: { payloads: RenderRequested[]; messageBus: MessageBus },
    _deps?: PassiveRenderPipelineDependencies
): Promise<void> => {
    const orchDeps: PassiveOrchestrationDepsResolved = {
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById,
        getExactMatch: _deps?.getExactMatch ?? ((input) => internalCache.RenderCache.getExactMatch(input)),
        clearPerspectivePointer: _deps?.clearPerspectivePointer ?? defaultClearPerspectivePointer,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? defaultComputePerspectiveKey,
        markStatesEqual: _deps?.markStatesEqual ?? markStatesEqual,
        generateRoomPreview: _deps?.generateRoomPreview ?? generateRoomPreview,
    }

    await Promise.all(payloads.map(async (payload) => {
        const intake = await intakePassiveRenderRequested(payload, _deps)

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

        if (intake.type === 'not_room') {
            messageBus.send(
                toRenderError(
                    intake.payload,
                    RENDER_ERROR_CODE_NOT_ROOM,
                    `RenderRequested componentId must be a room id for passive render: ${intake.payload.componentId}`,
                ),
            )
            return
        }

        if (intake.type === 'marks_missing') {
            const marksHandle = getRoomStateRenderHandle(conversationId, messageBus)
            const marksOutput: RenderResolveOutput = {
                type: 'failed',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: `RenderRequested requires Meta::Room.state.marks for ${intake.payload.componentId}`,
            }
            if (marksHandle !== undefined) {
                await marksHandle.sendMessage(marksOutput)
            }
            return
        }

        await findRender(intake.input, {
            getExactMatch: orchDeps.getExactMatch,
            getCacheRecordById: orchDeps.getCacheRecordById,
            clearPerspectivePointer: orchDeps.clearPerspectivePointer,
            computePerspectiveKey: orchDeps.computePerspectiveKey,
            markStatesEqual: orchDeps.markStatesEqual,
            perspectiveMatches,
            sendMessage: async (arg) => {
                const roomStateHandle = getRoomStateRenderHandle(conversationId, messageBus)
                await roomStateHandle?.sendMessage(arg)
            },
            generateRoomPreview: orchDeps.generateRoomPreview,
            conversationId,
        })
    }))
}

/** Back-compat name for the passive shell batch (same signature as the former `requestIntake` default export). */
export const requestIntakeMessage = orchestratePassiveRenderRequestedBatch
