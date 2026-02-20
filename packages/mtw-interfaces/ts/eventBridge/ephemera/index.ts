// Ephemera Data Source Event Contracts
// 
// This file contains event types, type guards, and serializers for the Ephemera data source.
// Migrated from lambda/ephemera/dataSource/serializers.ts

import { DataSourceEventSerializer, EventPayload, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

// For first iteration, Ephemera has no concrete emitted events. This pass-through
// serializer future-proofs the boundary without imposing structure yet.

export type EphemeraEventUpdate = EventPayload
export type EphemeraEventExternal = EventPayload

export class EphemeraEventSerializer implements DataSourceEventSerializer<EphemeraEventUpdate, EphemeraEventExternal> {
    serialize(params: { content: EphemeraEventUpdate; header: StreamingEventHeader }): EphemeraEventExternal {
        return params.content
    }

    async deserialize(params: { content: EphemeraEventExternal; header: StreamingEventHeader }): Promise<EphemeraEventUpdate | null> {
        return params.content
    }
}