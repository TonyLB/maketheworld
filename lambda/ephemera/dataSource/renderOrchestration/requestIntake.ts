/**
 * Passive `RenderRequested` **A-phase only**: load `Meta::Room`, resolve {@link RenderResolveInputSuccess.markState},
 * build {@link RenderResolveInput} (pointer hint from `currentCacheByPerspective`). B-phase and delivery live in
 * `orchestrationHandler.ts`.
 *
 * When `Meta::Room.state.marks` is absent, {@link computeDefaultMarksForRoom} supplies lens defaults. If that yields no
 * marks (no Lens on the merged room; primitives use **`SITUATION#DEFAULT`** as the authored example / cache key), intake
 * uses empty **`markValue`** and sets **`allowGeneration: false`** so resolve is cache-only (no slow-path generation).
 * Planning notes: `AGENT.planning.md` (same package; *Input boundary*, open work).
 */
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheMarkState } from '../renderCache/baseClasses'
import type { RenderRequested } from './events'
import type { RenderResolveInput, RenderResolveInputSuccess } from './baseClasses'
import { computeDefaultMarksForRoom } from '../state/computeDefaultMarksForRoom'

export type RequestIntakeDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    computePerspectiveKey?: typeof computePerspectiveKey;
    computeDefaultMarksForRoom?: typeof computeDefaultMarksForRoom;
}

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    internalCache.ComponentEphemeraMeta.get(roomId)
)

type RequestIntakeDepsResolved = Required<RequestIntakeDependencies>

/**
 * A-phase: `RenderRequested` + `Meta::Room` -> {@link RenderResolveInput} or intake-only outcomes (no I/O beyond Meta).
 */
export const intakeRenderRequested = async (
    payload: RenderRequested,
    _deps?: RequestIntakeDependencies
): Promise<RenderResolveInput> => {
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
        computeDefaultMarksForRoom: _deps?.computeDefaultMarksForRoom ?? computeDefaultMarksForRoom,
    }

    const roomId = payload.componentId
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
    const pointerId = metaRoom?.currentCacheByPerspective?.[perspectiveKey] as EphemeraCacheId | undefined

    const input: RenderResolveInputSuccess = {
        type: 'success',
        roomId,
        perspective,
        markState,
        markProvenance: 'meta',
        allowGeneration,
        ...(pointerId !== undefined ? { pointerHint: pointerId } : {}),
    }

    return input
}
