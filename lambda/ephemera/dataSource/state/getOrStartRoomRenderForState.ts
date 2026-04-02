import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PerspectiveSpec } from './computeDefaultMarksForRoom'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraCacheDynamoItem, type EphemeraCacheDynamoItem } from '../../renderCache/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { perspectiveMatches } from '@tonylb/mtw-interfaces/ts/perspective'
import { markStatesEqual } from '../../renderCache/markStateUtils'

export type GetOrStartRoomRenderForStateReady = {
    status: 'ready';
    cacheRecord: EphemeraCacheDynamoItem;
}

export type GetOrStartRoomRenderForStateGenerating = {
    status: 'generating';
}

export type GetOrStartRoomRenderForStateError = {
    status: 'error';
    errorCode: string;
    errorMessage: string;
}

export type GetOrStartRoomRenderForStateResult =
    | GetOrStartRoomRenderForStateReady
    | GetOrStartRoomRenderForStateGenerating
    | GetOrStartRoomRenderForStateError

export type GetOrStartRoomRenderForStateOptions = {
    allowGeneration?: boolean;
    generationContextWml?: string;
}

export type GetOrStartRoomRenderForStateDependencies = {
    //
    // Meta::Room accessors (ephemeraDB record)
    //
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    setMetaRoomState?: (roomId: EphemeraRoomId, next: { state: NonNullable<EphemeraMetaRoom['state']>; currentCacheId?: string }) => Promise<void>;

    //
    // Cache accessors
    //
    getCacheRecordById?: (roomId: EphemeraRoomId, dataCategory: string) => Promise<EphemeraCacheDynamoItem | undefined>;
}

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => {
    const fetched = await ephemeraDB.getItem<EphemeraMetaRoom>({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        getAllFields: true
    })
    return fetched ?? undefined
}

const defaultGetCacheRecordById = async (roomId: EphemeraRoomId, dataCategory: string): Promise<EphemeraCacheDynamoItem | undefined> => {
    const fetched = await ephemeraDB.getItem<any>({
        Key: { EphemeraId: roomId, DataCategory: dataCategory },
        getAllFields: true
    })
    if (isEphemeraCacheDynamoItem(fetched)) {
        return fetched
    }
    return undefined
}

const defaultSetMetaRoomState = async (
    roomId: EphemeraRoomId,
    next: { state: NonNullable<EphemeraMetaRoom['state']>; currentCacheId?: string }
): Promise<void> => {
    await ephemeraDB.optimisticUpdate({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['state', 'currentCacheId'],
        updateReducer: (draft) => {
            draft.state = next.state
            draft.currentCacheId = next.currentCacheId
        }
    })
}

/**
 * getOrStartRoomRenderForState
 *
 * Orchestrates Room state -> renderCache selection (and optional generation start).
 *
 * Stubbed for TDD: unit tests should be written first and are expected to fail
 * until this function is implemented.
 */
export const getOrStartRoomRenderForState = async ({
    roomId,
    perspective,
    options
}: {
    roomId: EphemeraRoomId;
    perspective: PerspectiveSpec;
    options?: GetOrStartRoomRenderForStateOptions;
}, _deps?: GetOrStartRoomRenderForStateDependencies): Promise<GetOrStartRoomRenderForStateResult> => {
    const deps: Required<GetOrStartRoomRenderForStateDependencies> = {
        getMetaRoom: _deps?.getMetaRoom ?? defaultGetMetaRoom,
        setMetaRoomState: _deps?.setMetaRoomState ?? defaultSetMetaRoomState,
        getCacheRecordById: _deps?.getCacheRecordById ?? defaultGetCacheRecordById
    }

    const metaRoom = await deps.getMetaRoom(roomId)
    const currentCacheId = metaRoom?.currentCacheId

    //
    // Fast path: currentCacheId points at an existing cache record that still matches
    // Meta::Room state.marks and the requested perspective.
    //
    if (currentCacheId) {
        const stateMarks = metaRoom?.state?.marks
        const state = metaRoom?.state

        if (!state || !stateMarks) {
            await deps.setMetaRoomState(roomId, {
                state: state ?? { marks: { markValue: [] } },
                currentCacheId: undefined
            })
            return {
                status: 'error',
                errorCode: 'FAST_PATH_INVALID',
                errorMessage: 'Meta::Room missing state.marks for fast-path validation'
            }
        }

        const cacheRecord = await deps.getCacheRecordById(roomId, currentCacheId)
        const markStateMatches = cacheRecord ? markStatesEqual(stateMarks, cacheRecord.markState) : false
        const perspectiveMatchesRequest = cacheRecord ? perspectiveMatches(cacheRecord.perspectiveMatcher, perspective as any) : false

        if (cacheRecord && markStateMatches && perspectiveMatchesRequest) {
            return { status: 'ready', cacheRecord }
        }

        await deps.setMetaRoomState(roomId, {
            state,
            currentCacheId: undefined
        })
        return {
            status: 'error',
            errorCode: 'FAST_PATH_INVALID',
            errorMessage: 'Meta::Room.currentCacheId did not resolve to a valid matching cache record'
        }
    }

    void options
    return {
        status: 'error',
        errorCode: 'NOT_IMPLEMENTED',
        errorMessage: 'Slow path not implemented'
    }
}

export default getOrStartRoomRenderForState

