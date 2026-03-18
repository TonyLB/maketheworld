import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { PerspectiveSpec } from './computeDefaultMarksForRoom'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'

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
    void roomId
    void perspective
    void options
    throw new Error('getOrStartRoomRenderForState not implemented')
}

export default getOrStartRoomRenderForState

