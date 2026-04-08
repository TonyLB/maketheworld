import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraRoomState } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import type { EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { normalizeMarkState } from '../renderCache/utils/markState'
import { computeDefaultMarksForRoom } from './computeDefaultMarksForRoom'

/**
 * Merge two mark states: `incoming` entries win on duplicate `mark` keys (same semantics as
 * {@link normalizeMarkState} after concatenation).
 */
export const mergeMarkState = (base: EphemeraCacheMarkState, incoming: EphemeraCacheMarkState): EphemeraCacheMarkState => (
    normalizeMarkState({
        markValue: [...base.markValue, ...incoming.markValue],
    })
)

export type MergePersistMetaRoomMarksArgs = {
    roomId: EphemeraRoomId;
    incomingMarks: EphemeraCacheMarkState;
}

export type MergePersistMetaRoomMarksOptimisticUpdateParams = {
    Key: { EphemeraId: EphemeraRoomId; DataCategory: 'Meta::Room' };
    updateKeys: ['state'];
    updateReducer: (draft: EphemeraMetaRoom) => void;
    /** Same row as `getMetaRoom` avoids a duplicate `getItem` on the first optimistic attempt. */
    priorFetch?: EphemeraMetaRoom;
    successCallback?: (output: Partial<EphemeraMetaRoom>, prior: Partial<EphemeraMetaRoom>) => void | Promise<void>;
}

export type MergePersistMetaRoomMarksDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    computeDefaultMarksForRoom?: typeof computeDefaultMarksForRoom;
    optimisticUpdate?: (params: MergePersistMetaRoomMarksOptimisticUpdateParams) => Promise<Partial<EphemeraMetaRoom> | undefined>;
}

export type MergePersistMetaRoomMarksResult =
    | { ok: true; persisted: true; priorState: EphemeraRoomState; newState: EphemeraRoomState }
    | { ok: true; persisted: false }
    | { ok: false; errorCode: 'META_ROOM_MISSING'; errorMessage: string }

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    internalCache.ComponentEphemeraMeta.get(roomId)
)

const hasUsableStoredMarks = (meta: EphemeraMetaRoom): boolean => {
    const marks = meta.state?.marks
    return !!marks && Array.isArray(marks.markValue) && marks.markValue.length > 0
}

/** Maps a partial meta row (projection / return value) to `EphemeraRoomState` for outbound events. */
const toPersistedRoomState = (meta: Partial<EphemeraMetaRoom> | undefined): EphemeraRoomState => {
    const s = meta?.state
    const marks = s?.marks ?? { markValue: [] }
    return {
        marks,
        ...(s?.situationId !== undefined ? { situationId: s.situationId } : {}),
    }
}

/**
 * Load `Meta::Room`, merge `incomingMarks` onto stored marks (or onto `computeDefaultMarksForRoom`
 * when there are no non-empty stored marks), then persist `state.marks` via `optimisticUpdate`.
 * Passes `priorFetch` from the same `getMetaRoom` read so the first update attempt skips a duplicate `getItem`.
 * Merge runs inside `updateReducer` so optimistic retries (after conditional conflicts) recompute from the latest
 * fetched `draft`, not from a snapshot taken before the update.
 * `computeDefaultMarksForRoom` is awaited only when the initial `meta` has no usable stored marks; it is reused when
 * a reducer pass still sees none (reducer stays synchronous). If the initial row had usable marks but a later
 * reducer pass does not (e.g. concurrent clear), the base falls back to `{ markValue: [] }` instead of lens defaults.
 * Does not modify `currentCacheId` / `currentCacheByPerspective`. Requires an existing `Meta::Room` row.
 */
export const mergePersistMetaRoomMarks = async (
    args: MergePersistMetaRoomMarksArgs,
    _deps?: MergePersistMetaRoomMarksDependencies
): Promise<MergePersistMetaRoomMarksResult> => {
    const getMetaRoom = _deps?.getMetaRoom ?? defaultGetMetaRoom
    const computeDefaults = _deps?.computeDefaultMarksForRoom ?? computeDefaultMarksForRoom
    const optimisticUpdate =
        _deps?.optimisticUpdate
        ?? ((params: MergePersistMetaRoomMarksOptimisticUpdateParams) => ephemeraDB.optimisticUpdate(params))

    const meta = await getMetaRoom(args.roomId)
    if (!meta) {
        return {
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: `Meta::Room not found for ${args.roomId}`,
        }
    }

    const defaultMarksWhenNoStored: EphemeraCacheMarkState | undefined = hasUsableStoredMarks(meta)
        ? undefined
        : await computeDefaults({
            roomId: args.roomId,
        })

    let persistedSnapshot: { priorState: EphemeraRoomState; newState: EphemeraRoomState } | undefined

    await optimisticUpdate({
        Key: { EphemeraId: args.roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['state'],
        priorFetch: meta,
        updateReducer: (draft) => {
            const base: EphemeraCacheMarkState = hasUsableStoredMarks(draft)
                ? draft.state!.marks
                : (defaultMarksWhenNoStored ?? { markValue: [] })
            const merged = mergeMarkState(base, args.incomingMarks)
            draft.state = {
                marks: merged,
                ...(draft.state?.situationId !== undefined ? { situationId: draft.state.situationId } : {}),
            }
        },
        successCallback: (output, prior) => {
            persistedSnapshot = {
                priorState: toPersistedRoomState(prior),
                newState: toPersistedRoomState(output),
            }
        },
    })

    internalCache.ComponentEphemeraMeta.invalidate(args.roomId)

    if (persistedSnapshot) {
        return { ok: true, persisted: true, ...persistedSnapshot }
    }
    return { ok: true, persisted: false }
}

export default mergePersistMetaRoomMarks
