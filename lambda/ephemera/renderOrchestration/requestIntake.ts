import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { MessageBus } from '../messageBus/baseClasses'
import { isEphemeraCacheDynamoItem, type EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import { markStatesEqual } from '../renderCache/markStateUtils'
import type { RenderLookupRequested, RenderReady, RenderRequested } from './events'

export type RequestIntakeDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    getCacheRecordById?: (roomId: EphemeraRoomId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>;
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

export const requestIntakeMessage = async (
    { payloads, messageBus }: { payloads: RenderRequested[]; messageBus: MessageBus },
    _deps?: RequestIntakeDependencies
): Promise<void> => {
    const deps: Required<RequestIntakeDependencies> = {
        getMetaRoom: _deps?.getMetaRoom ?? defaultGetMetaRoom,
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById,
        clearPerspectivePointer: _deps?.clearPerspectivePointer ?? defaultClearPerspectivePointer,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? computePerspectiveKey,
        markStatesEqual: _deps?.markStatesEqual ?? markStatesEqual
    }

    await Promise.all(payloads.map(async (payload) => {
        if (!isEphemeraRoomId(payload.componentId)) {
            messageBus.send(toLookupRequested(payload))
            return
        }

        const roomId = payload.componentId
        const metaRoom = await deps.getMetaRoom(roomId)
        const perspectiveKey = deps.computePerspectiveKey(payload.perspective.assetStack)
        const pointerId = metaRoom?.currentCacheByPerspective?.[perspectiveKey] as EphemeraCacheId | undefined

        if (!pointerId) {
            messageBus.send(toLookupRequested(payload))
            return
        }

        const stateMarks = metaRoom?.state?.marks
        const cacheRecord = await deps.getCacheRecordById(roomId, pointerId)

        const isValid = !!(
            stateMarks
            && cacheRecord
            && deps.markStatesEqual(stateMarks, cacheRecord.markState)
            && perspectiveMatches(cacheRecord.perspectiveMatcher, payload.perspective)
        )

        if (isValid && cacheRecord) {
            messageBus.send(toRenderReady(payload, pointerId, cacheRecord))
            return
        }

        try {
            await deps.clearPerspectivePointer(roomId, perspectiveKey)
        }
        catch {
            // best-effort pointer clearing; continue to slow-path handoff
        }
        messageBus.send(toLookupRequested(payload))
    }))
}

export default requestIntakeMessage

