import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom, EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'

/**
 * Merge runtime objects on Meta::Room:
 * 1. Remove every entry whose uuid is in `remove`.
 * 2. For each entry in `add` (in order), strip existing rows with the same uuid, then append.
 * Missing `base` is treated as empty.
 *
 * Each `add` row is stored as an `EphemeraMetaRoomObject` as given (optional fields such as
 * `stableKey`, `tropeAffinities`, `tropeAffinitiesFailed` persist when present).
 */
export const mergeMetaRoomObjects = (
    base: EphemeraMetaRoomObject[] | undefined,
    add: EphemeraMetaRoomObject[],
    remove: EphemeraObjectId[]
): EphemeraMetaRoomObject[] => {
    const removeSet = new Set(remove)
    let working = (base ?? []).filter((x) => !removeSet.has(x.uuid))
    for (const entry of add) {
        working = working.filter((x) => x.uuid !== entry.uuid)
        working = [...working, entry]
    }
    return working
}

export type MergePersistMetaRoomObjectsArgs = {
    roomId: EphemeraRoomId;
    add: EphemeraMetaRoomObject[];
    remove: EphemeraObjectId[];
}

export type MergePersistMetaRoomObjectsOptimisticUpdateParams = {
    Key: { EphemeraId: EphemeraRoomId; DataCategory: 'Meta::Room' };
    updateKeys: ['objects'];
    updateReducer: (draft: EphemeraMetaRoom) => void;
    priorFetch?: EphemeraMetaRoom;
    successCallback?: (output: Partial<EphemeraMetaRoom>, prior: Partial<EphemeraMetaRoom>) => void | Promise<void>;
}

export type MergePersistMetaRoomObjectsDependencies = {
    getMetaRoom?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
    optimisticUpdate?: (params: MergePersistMetaRoomObjectsOptimisticUpdateParams) => Promise<Partial<EphemeraMetaRoom> | undefined>;
}

export type MergePersistMetaRoomObjectsResult =
    | { ok: true; persisted: true; priorObjects: EphemeraMetaRoomObject[]; newObjects: EphemeraMetaRoomObject[] }
    | { ok: true; persisted: false }
    | { ok: false; errorCode: 'META_ROOM_MISSING'; errorMessage: string }

export type ClearPersistMetaRoomObjectsArgs = {
    roomId: EphemeraRoomId;
}

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    internalCache.ComponentEphemeraMeta.get(roomId)
)

/** Shallow snapshot for stream payloads; preserves optional Acme enrich fields on each object. */
const snapshotObjects = (meta: Partial<EphemeraMetaRoom> | undefined): EphemeraMetaRoomObject[] => (
    (meta?.objects ?? []).map((entry) => ({ ...entry }))
)

/**
 * Load `Meta::Room`, merge `add` / `remove` into `objects` via `optimisticUpdate` (`updateKeys: ['objects']`).
 * Requires an existing row. Invalidates `ComponentEphemeraMeta` after the update attempt.
 */
export const mergePersistMetaRoomObjects = async (
    args: MergePersistMetaRoomObjectsArgs,
    _deps?: MergePersistMetaRoomObjectsDependencies
): Promise<MergePersistMetaRoomObjectsResult> => {
    const getMetaRoom = _deps?.getMetaRoom ?? defaultGetMetaRoom
    const optimisticUpdate =
        _deps?.optimisticUpdate
        ?? ((params: MergePersistMetaRoomObjectsOptimisticUpdateParams) => ephemeraDB.optimisticUpdate(params))

    const meta = await getMetaRoom(args.roomId)
    if (!meta) {
        return {
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: `Meta::Room not found for ${args.roomId}`,
        }
    }

    let persistedSnapshot: { priorObjects: EphemeraMetaRoomObject[]; newObjects: EphemeraMetaRoomObject[] } | undefined

    await optimisticUpdate({
        Key: { EphemeraId: args.roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['objects'],
        priorFetch: meta,
        updateReducer: (draft) => {
            draft.objects = mergeMetaRoomObjects(draft.objects, args.add, args.remove)
        },
        successCallback: (output, prior) => {
            persistedSnapshot = {
                priorObjects: snapshotObjects(prior),
                newObjects: snapshotObjects(output),
            }
        },
    })

    internalCache.ComponentEphemeraMeta.invalidate(args.roomId)
    internalCache.AffordanceRoomDeliverable.invalidate(args.roomId)

    if (persistedSnapshot) {
        return { ok: true, persisted: true, ...persistedSnapshot }
    }
    return { ok: true, persisted: false }
}

/**
 * Force `Meta::Room.objects` to empty for a room, regardless of current contents.
 * Requires an existing row. Invalidates `ComponentEphemeraMeta` after update attempt.
 */
export const clearPersistMetaRoomObjects = async (
    args: ClearPersistMetaRoomObjectsArgs,
    _deps?: MergePersistMetaRoomObjectsDependencies
): Promise<MergePersistMetaRoomObjectsResult> => {
    const getMetaRoom = _deps?.getMetaRoom ?? defaultGetMetaRoom
    const optimisticUpdate =
        _deps?.optimisticUpdate
        ?? ((params: MergePersistMetaRoomObjectsOptimisticUpdateParams) => ephemeraDB.optimisticUpdate(params))

    const meta = await getMetaRoom(args.roomId)
    if (!meta) {
        return {
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: `Meta::Room not found for ${args.roomId}`,
        }
    }

    let persistedSnapshot: { priorObjects: EphemeraMetaRoomObject[]; newObjects: EphemeraMetaRoomObject[] } | undefined

    await optimisticUpdate({
        Key: { EphemeraId: args.roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['objects'],
        priorFetch: meta,
        updateReducer: (draft) => {
            draft.objects = []
        },
        successCallback: (output, prior) => {
            persistedSnapshot = {
                priorObjects: snapshotObjects(prior),
                newObjects: snapshotObjects(output),
            }
        },
    })

    internalCache.ComponentEphemeraMeta.invalidate(args.roomId)
    internalCache.AffordanceRoomDeliverable.invalidate(args.roomId)

    if (persistedSnapshot) {
        return { ok: true, persisted: true, ...persistedSnapshot }
    }
    return { ok: true, persisted: false }
}

export default mergePersistMetaRoomObjects
