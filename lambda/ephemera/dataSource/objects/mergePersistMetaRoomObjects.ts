import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'

/**
 * Multiset patch: remove all occurrences whose value is in `remove` (stable order), then append `add` in order.
 * Missing `base` is treated as empty.
 */
export const mergeMetaRoomObjectsList = (base: string[] | undefined, add: string[], remove: string[]): string[] => {
    const removeSet = new Set(remove)
    const filtered = (base ?? []).filter((x) => !removeSet.has(x))
    return [...filtered, ...add]
}

export type MergePersistMetaRoomObjectsArgs = {
    roomId: EphemeraRoomId;
    add: string[];
    remove: string[];
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
    | { ok: true; persisted: true; priorObjects: string[]; newObjects: string[] }
    | { ok: true; persisted: false }
    | { ok: false; errorCode: 'META_ROOM_MISSING'; errorMessage: string }

const defaultGetMetaRoom = async (roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> => (
    internalCache.ComponentEphemeraMeta.get(roomId)
)

const snapshotObjects = (meta: Partial<EphemeraMetaRoom> | undefined): string[] => [...(meta?.objects ?? [])]

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

    let persistedSnapshot: { priorObjects: string[]; newObjects: string[] } | undefined

    await optimisticUpdate({
        Key: { EphemeraId: args.roomId, DataCategory: 'Meta::Room' },
        updateKeys: ['objects'],
        priorFetch: meta,
        updateReducer: (draft) => {
            draft.objects = mergeMetaRoomObjectsList(draft.objects, args.add, args.remove)
        },
        successCallback: (output, prior) => {
            persistedSnapshot = {
                priorObjects: snapshotObjects(prior),
                newObjects: snapshotObjects(output),
            }
        },
    })

    internalCache.ComponentEphemeraMeta.invalidate(args.roomId)

    if (persistedSnapshot) {
        return { ok: true, persisted: true, ...persistedSnapshot }
    }
    return { ok: true, persisted: false }
}

export default mergePersistMetaRoomObjects
