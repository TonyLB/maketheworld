import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

/**
 * Read-through cache for ephemeraDB `Meta::Object` rows (`EphemeraMetaObject`).
 */
export class ObjectEphemeraMetaData {
    /** Absent key = not cached; `null` = cached miss (no row). */
    private _metaObjectById: Partial<Record<EphemeraObjectId, EphemeraMetaObject | null>> = {}

    clear(): void {
        this._metaObjectById = {}
    }

    set(objectId: EphemeraObjectId, value: EphemeraMetaObject | undefined): void {
        if (value === undefined) {
            delete this._metaObjectById[objectId]
        }
        else {
            this._metaObjectById[objectId] = value
        }
    }

    invalidate(objectId: EphemeraObjectId): void {
        delete this._metaObjectById[objectId]
    }

    async get(objectId: EphemeraObjectId): Promise<EphemeraMetaObject | undefined> {
        if (Object.prototype.hasOwnProperty.call(this._metaObjectById, objectId)) {
            const cached = this._metaObjectById[objectId]
            return cached === null ? undefined : cached
        }
        const fetched = await ephemeraDB.getItem<EphemeraMetaObject>({
            Key: { EphemeraId: objectId, DataCategory: 'Meta::Object' },
            getAllFields: true,
        })
        this._metaObjectById[objectId] = fetched ?? null
        return fetched ?? undefined
    }
}

export default ObjectEphemeraMetaData
