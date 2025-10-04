import { DataSourceEventSerializer, EventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// For first iteration, Ephemera has no concrete emitted events. This pass-through
// serializer future-proofs the boundary without imposing structure yet.

export type EphemeraEventUpdate = EventPayload
export type EphemeraEventExternal = EventPayload

export class EphemeraEventSerializer implements DataSourceEventSerializer<EphemeraEventUpdate, EphemeraEventExternal> {
    serialize(params: { dataSourceKey: string; streamKey: string; update: EphemeraEventUpdate }): EphemeraEventExternal {
        return params.update
    }

    deserialize(params: { dataSourceKey: string; streamKey: string; externalUpdate: EphemeraEventExternal }): EphemeraEventUpdate | null {
        return params.externalUpdate
    }
}


