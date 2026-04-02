/**
 * Passive `RenderRequested` **A-phase only**: load `Meta::Room`, validate `state.marks`, build {@link RenderResolveInput}
 * (pointer hint from `currentCacheByPerspective`). B-phase and delivery live in `dataSource/renderOrchestration/orchestrationHandler.ts` and
 * `renderOrchestration/index.ts`. See `AGENT.planning.simplification.md`.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isRenderPreviewRequested, type RenderPreviewRequested, type RenderRequested } from './events'
import type { RenderResolveInput, RenderResolveInputSuccess } from './baseClasses'

export type RequestIntakeDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    computePerspectiveKey?: typeof computePerspectiveKey;
}

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    await ephemeraDB.getItem<EphemeraMetaRoom>({
        Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
        getAllFields: true
    }) ?? undefined
)

type RequestIntakeDepsResolved = Required<RequestIntakeDependencies>

/**
 * A-phase: `RenderRequested` + `Meta::Room` -> {@link RenderResolveInput} or intake-only outcomes (no I/O beyond Meta).
 */
export const intakeRenderRequested = async (
    payload: RenderRequested | RenderPreviewRequested,
    _deps?: RequestIntakeDependencies
): Promise<RenderResolveInput> => {
    if (isRenderPreviewRequested(payload)) {
        return {
            type: 'success',
            roomId: payload.componentId,
            perspective: payload.perspective,
            markState: payload.markState,
            markProvenance: 'preview',
            allowGeneration: payload.allowGeneration,
            generationContextWml: payload.generationContextWml,
        }
    }

    if (!isEphemeraRoomId(payload.componentId)) {
        return {
            type: 'error',
            errorCode: 'RENDER_REQUESTED_NOT_ROOM',
            errorMessage: `RenderRequested componentId must be a room id for passive render: ${payload.componentId}`,
        }
    }

    const deps: RequestIntakeDepsResolved = {
        getMetaRoom: _deps?.getMetaRoom ?? defaultGetMetaRoom,
        computePerspectiveKey: _deps?.computePerspectiveKey ?? computePerspectiveKey,
    }

    const roomId = payload.componentId
    const metaRoom = await deps.getMetaRoom(roomId)
    const stateMarks = metaRoom?.state?.marks
    const perspective = payload.perspective

    if (!stateMarks) {
        return {
            type: 'error',
            errorCode: 'META_ROOM_MARKS_MISSING',
            errorMessage: `RenderRequested requires Meta::Room.state.marks for ${payload.componentId}`,
        }
    }

    const perspectiveKey = deps.computePerspectiveKey(perspective.assetStack)
    const pointerId = metaRoom?.currentCacheByPerspective?.[perspectiveKey] as EphemeraCacheId | undefined

    const input: RenderResolveInputSuccess = {
        type: 'success',
        roomId,
        perspective,
        markState: stateMarks,
        markProvenance: 'meta',
        allowGeneration: payload.allowGeneration,
        generationContextWml: payload.generationContextWml,
        ...(pointerId !== undefined ? { pointerHint: pointerId } : {}),
    }

    return input
}
