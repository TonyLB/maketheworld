/**
 * Passive `RenderRequested` **A-phase only**: branch on host kind, resolve {@link RenderResolveInputSuccess.markState},
 * build {@link RenderResolveInput} (pointer hint from catalog and, for rooms, legacy Meta map). B-phase and delivery live in
 * `orchestrationHandler.ts`.
 *
 * **Room hosts:** load `Meta::Room`; when `Meta::Room.state.marks` is absent, {@link computeDefaultMarksForRoom}
 * supplies lens defaults. If that yields no marks (no Lens on the merged room; primitives use **`SITUATION#DEFAULT`** as
 * the authored example / cache key), intake uses empty **`markValue`** and sets **`allowGeneration: false`** so resolve is
 * cache-only (no slow-path generation).
 *
 * **Feature/Knowledge/Object/Character hosts:** no `Meta::Room`; always **`markState: { markValue: [] }`** and **`allowGeneration: false`**
 * (cache only --- authored for Feature/Knowledge/Character, the Object description stub's shortName-derived row for Object;
 * see `renderCache/ensureObjectShortNameCacheRecord.ts`); **`pointerHint`** from catalog row via
 * {@link resolvePerspectivePointer}.
 */
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
    type EphemeraCharacterId,
    type EphemeraFeatureId,
    type EphemeraKnowledgeId,
    type EphemeraObjectId,
    type EphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheMarkState } from '../renderCache/baseClasses'
import type { RenderRequested } from '../../messageBus/baseClasses'
import type { RenderResolveInput, RenderResolveInputSuccess } from './baseClasses'
import { computeDefaultMarksForRoom } from '../state/computeDefaultMarksForRoom'
import { resolvePerspectivePointer } from '../renderCache/perspectivePointer'

export type RequestIntakeDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    computePerspectiveKey?: typeof computePerspectiveKey;
    computeDefaultMarksForRoom?: typeof computeDefaultMarksForRoom;
    resolvePerspectivePointer?: typeof resolvePerspectivePointer;
}

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    internalCache.ComponentEphemeraMeta.get(roomId)
)

type RequestIntakeDepsResolved = Required<RequestIntakeDependencies>

type CacheOnlyComponentId = EphemeraFeatureId | EphemeraKnowledgeId | EphemeraObjectId | EphemeraCharacterId

const isCacheOnlyHost = (componentId: string): componentId is CacheOnlyComponentId => (
    isEphemeraFeatureId(componentId)
    || isEphemeraKnowledgeId(componentId)
    || isEphemeraObjectId(componentId)
    || isEphemeraCharacterId(componentId)
)

const intakeCacheOnlyHost = async (
    componentId: CacheOnlyComponentId,
    payload: RenderRequested,
    deps: RequestIntakeDepsResolved,
): Promise<RenderResolveInputSuccess> => {
    const perspective = payload.perspective
    const perspectiveKey = deps.computePerspectiveKey(perspective.assetStack)
    const pointerId = await deps.resolvePerspectivePointer(componentId, perspectiveKey)

    return {
        type: 'success',
        componentId,
        perspective,
        markState: { markValue: [] },
        markProvenance: 'meta',
        allowGeneration: false,
        ...(pointerId !== undefined ? { pointerHint: pointerId } : {}),
    }
}

const intakeRoom = async (
    payload: RenderRequested,
    roomId: EphemeraRoomId,
    deps: RequestIntakeDepsResolved,
): Promise<RenderResolveInput> => {
    const metaRoom = await deps.getMetaRoom(roomId)
    const stateMarks = metaRoom?.state?.marks
    const perspective = payload.perspective

    let markState: EphemeraCacheMarkState
    let allowGeneration: boolean | undefined
    if (stateMarks) {
        markState = stateMarks
        allowGeneration = payload.allowGeneration
    }
    else {
        let defaultMarks: EphemeraCacheMarkState
        try {
            defaultMarks = await deps.computeDefaultMarksForRoom({ roomId })
        }
        catch (err) {
            const detail = err instanceof Error ? err.message : String(err)
            return {
                type: 'error',
                errorCode: 'META_ROOM_MARKS_MISSING',
                errorMessage: `RenderRequested could not resolve default marks for ${payload.componentId}: ${detail}`,
            }
        }
        if (defaultMarks.markValue.length === 0) {
            markState = { markValue: [] }
            allowGeneration = false
        }
        else {
            markState = defaultMarks
            allowGeneration = payload.allowGeneration
        }
    }

    const perspectiveKey = deps.computePerspectiveKey(perspective.assetStack)
    const pointerId = await deps.resolvePerspectivePointer(roomId, perspectiveKey)

    const input: RenderResolveInputSuccess = {
        type: 'success',
        componentId: roomId,
        perspective,
        markState,
        markProvenance: 'meta',
        allowGeneration,
        ...(pointerId !== undefined ? { pointerHint: pointerId } : {}),
    }

    return input
}

/**
 * A-phase: `RenderRequested` -> {@link RenderResolveInput} or intake-only outcomes.
 * Room hosts load `Meta::Room`; Feature/Knowledge hosts use empty marks and catalog-only pointers.
 */
export const intakeRenderRequested = async (
    payload: RenderRequested,
    _deps?: RequestIntakeDependencies
): Promise<RenderResolveInput> => {
    const deps: RequestIntakeDepsResolved = {
        getMetaRoom: _deps?.getMetaRoom ?? defaultGetMetaRoom,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? computePerspectiveKey,
        computeDefaultMarksForRoom: _deps?.computeDefaultMarksForRoom ?? computeDefaultMarksForRoom,
        resolvePerspectivePointer: _deps?.resolvePerspectivePointer ?? resolvePerspectivePointer,
    }

    if (isCacheOnlyHost(payload.componentId)) {
        return intakeCacheOnlyHost(payload.componentId, payload, deps)
    }

    if (!isEphemeraRoomId(payload.componentId)) {
        return {
            type: 'error',
            errorCode: 'RENDER_REQUESTED_NOT_ROOM',
            errorMessage: `RenderRequested componentId must be a room id for passive render: ${payload.componentId}`,
        }
    }

    return intakeRoom(payload, payload.componentId, deps)
}
