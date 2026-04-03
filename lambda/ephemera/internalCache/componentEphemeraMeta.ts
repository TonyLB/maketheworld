import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

/**
 * v1: ephemera-side meta for `Meta::Room` only. When additional `Meta::*` rows exist for
 * other component kinds, this type may become a union (see AGENT doc).
 */
export type ComponentEphemeraMetaItem = EphemeraMetaRoom

/**
 * Read-through cache for ephemeraDB `Meta::Room` rows (`EphemeraMetaRoom`).
 * Mirrors the lazy-map pattern in {@link characterMeta.ts}; not using DeferredCache (see componentAssetMeta).
 */
export class ComponentEphemeraMetaData {
    /** Absent key = not cached; `null` = cached miss (no row). */
    private _metaRoomById: Partial<Record<EphemeraRoomId, EphemeraMetaRoom | null>> = {}

    clear(): void {
        this._metaRoomById = {}
    }

    /**
     * Test helper: inject a row or `undefined` to simulate a cache miss after invalidate.
     */
    set(roomId: EphemeraRoomId, value: EphemeraMetaRoom | undefined): void {
        if (value === undefined) {
            delete this._metaRoomById[roomId]
        }
        else {
            this._metaRoomById[roomId] = value
        }
    }

    invalidate(roomId: EphemeraRoomId): void {
        delete this._metaRoomById[roomId]
    }

    async get(roomId: EphemeraRoomId): Promise<EphemeraMetaRoom | undefined> {
        if (Object.prototype.hasOwnProperty.call(this._metaRoomById, roomId)) {
            const cached = this._metaRoomById[roomId]
            return cached === null ? undefined : cached
        }
        const fetched = await ephemeraDB.getItem<EphemeraMetaRoom>({
            Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
            getAllFields: true,
        })
        this._metaRoomById[roomId] = fetched ?? null
        return fetched ?? undefined
    }
}

export default ComponentEphemeraMetaData
