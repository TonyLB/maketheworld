/**
 * Passive `RenderRequested` **A-phase only**: load `Meta::Room`, validate `state.marks`, build {@link RenderResolveInput}
 * (pointer hint from `currentCacheByPerspective`). B-phase and delivery live in `passiveRenderOrchestration.ts` and
 * `renderOrchestration/index.ts`. See `AGENT.planning.simplification.md`.
 */
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { RenderRequested } from './events'
import type { RenderResolveInput } from './baseClasses'
import type { PassiveIntakeResult } from './renderIntake'

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
export const intakePassiveRenderRequested = async (
    payload: RenderRequested,
    _deps?: RequestIntakeDependencies
): Promise<PassiveIntakeResult> => {
    if (!isEphemeraRoomId(payload.componentId)) {
        return { type: 'not_room', payload }
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
        return { type: 'marks_missing', payload }
    }

    const perspectiveKey = deps.computePerspectiveKey(perspective.assetStack)
    const pointerId = metaRoom?.currentCacheByPerspective?.[perspectiveKey] as EphemeraCacheId | undefined

    const input: RenderResolveInput = {
        roomId,
        perspective,
        markState: stateMarks,
        markProvenance: 'meta',
        allowGeneration: payload.allowGeneration ?? false,
        generationContextWml: payload.generationContextWml,
        ...(pointerId !== undefined ? { pointerHint: pointerId } : {}),
    }

    return { type: 'ok', input, payload }
}
