import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { MessageBus } from '../messageBus/baseClasses'
import { isEphemeraCacheDynamoItem, type EphemeraCacheDynamoItem, type EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/markStateUtils'
import type { RenderLookupRequested, RenderReady, RenderRequested } from './events'
import type { RenderResolveInput, RenderResolveOutput } from './baseClasses'
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

const toLookupRequested = (payload: RenderRequested): RenderLookupRequested => ({
    type: 'RenderLookupRequested',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    allowGeneration: payload.allowGeneration,
    generationContextWml: payload.generationContextWml
})

const toRenderReady = (payload: RenderRequested, cacheId: EphemeraCacheId, cacheRecord: EphemeraCacheDynamoItem): RenderReady => ({
    type: 'RenderReady',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    cacheId,
    cacheRecord
})

const toMissingRoomStateError = (payload: RenderRequested) => ({
    type: 'Error' as const,
    body: {
        error: `RenderRequested requires Meta::Room.state.marks for ${payload.componentId}`,
        statusCode: 500
    }
})

/**
 * Core room path: Meta::Room load, pointer validation, exact-match, pointer clear.
 * Returns {@link RenderResolveOutput} (no bus delivery). Caller must have verified `componentId` is a room.
 */
const executeRequestIntakeResolve = async (
    payload: RenderRequested,
    roomId: EphemeraRoomId,
    deps: Required<RequestIntakeDependencies>
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

    if (!pointerId) {
        const exactMatch = await deps.getExactMatch({
            componentId: resolve.roomId,
            proposedMarkState: resolve.markState,
            perspective: resolve.perspective,
        })
        if (exactMatch) {
            return {
                type: 'resolved',
                renderedContent: exactMatch.renderedContent,
                cacheId: exactMatch.DataCategory as EphemeraCacheId,
                cacheRecord: exactMatch,
            }
        }
        return { type: 'lookup_handoff' }
    }

    const cacheRecord = await deps.getCacheRecordById(resolve.roomId, pointerId)

    const isValid = !!(
        cacheRecord
        && deps.markStatesEqual(resolve.markState, cacheRecord.markState)
        && perspectiveMatches(cacheRecord.perspectiveMatcher, resolve.perspective)
    )

    if (isValid && cacheRecord) {
        return {
            type: 'resolved',
            renderedContent: cacheRecord.renderedContent,
            cacheId: pointerId,
            cacheRecord,
        }
    }

    try {
        await deps.clearPerspectivePointer(resolve.roomId, perspectiveKey)
    }
    catch {
        // best-effort pointer clearing; continue to slow-path handoff
    }

    const exactMatch = await deps.getExactMatch({
        componentId: resolve.roomId,
        proposedMarkState: resolve.markState,
        perspective: resolve.perspective,
    })
    if (exactMatch) {
        return {
            type: 'resolved',
            renderedContent: exactMatch.renderedContent,
            cacheId: exactMatch.DataCategory as EphemeraCacheId,
            cacheRecord: exactMatch,
        }
    }

    return { type: 'lookup_handoff' }
}

/** Maps {@link RenderResolveOutput} to the messageBus envelopes used by `requestIntake` today. */
const deliverRequestIntakeOutput = (
    payload: RenderRequested,
    messageBus: MessageBus,
    output: RenderResolveOutput
): void => {
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            console.error('requestIntake deliver: resolved outcome missing cacheId or cacheRecord')
            return
        }
        messageBus.send(toRenderReady(payload, cacheId, cacheRecord))
        return
    }
    if (output.type === 'lookup_handoff') {
        messageBus.send(toLookupRequested(payload))
        return
    }
    if (output.errorCode === 'META_ROOM_MARKS_MISSING') {
        messageBus.send(toMissingRoomStateError(payload))
        return
    }
    console.error('requestIntake deliver: unexpected failure outcome', output)
    messageBus.send(toLookupRequested(payload))
}

export const requestIntakeMessage = async (
    { payloads, messageBus }: { payloads: RenderRequested[]; messageBus: MessageBus },
    _deps?: RequestIntakeDependencies
): Promise<void> => {
    const deps: Required<RequestIntakeDependencies> = {
        getMetaRoom: _deps?.getMetaRoom ?? defaultGetMetaRoom,
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById,
        getExactMatch: _deps?.getExactMatch ?? ((input) => internalCache.RenderCache.getExactMatch(input)),
        clearPerspectivePointer: _deps?.clearPerspectivePointer ?? defaultClearPerspectivePointer,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? computePerspectiveKey,
        markStatesEqual: _deps?.markStatesEqual ?? markStatesEqual
    }

    await Promise.all(payloads.map(async (payload) => {
        if (!isEphemeraRoomId(payload.componentId)) {
            deliverRequestIntakeOutput(payload, messageBus, { type: 'lookup_handoff' })
            return
        }

        const output = await executeRequestIntakeResolve(payload, payload.componentId, deps)
        deliverRequestIntakeOutput(payload, messageBus, output)
    }))
}

export default requestIntakeMessage

