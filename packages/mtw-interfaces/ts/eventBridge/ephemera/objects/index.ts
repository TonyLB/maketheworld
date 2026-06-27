import { DataSourceEventSerializer, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import {
    EphemeraObjectId,
    EphemeraRoomId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

export type EphemeraObjectsSpawnCompensationProblemEvent = {
    type: 'Spawn Compensation Problem'
    objectId: EphemeraObjectId
    targetRoomId: EphemeraRoomId
    sourceOperation: string
    placementError: string
    deleteError: string
    attemptCount: number
    dedupeKey: string
    timestamp: string
}

export type EphemeraObjectsEventUpdate = EphemeraObjectsSpawnCompensationProblemEvent

export type EphemeraObjectsSpawnCompensationProblemEventExternal = {
    type: 'Spawn Compensation Problem'
    objectId: EphemeraObjectId
    targetRoomId: EphemeraRoomId
    sourceOperation: string
    placementError: string
    deleteError: string
    attemptCount: number
    dedupeKey: string
    timestamp?: string
}

export type EphemeraObjectsEventExternal = EphemeraObjectsSpawnCompensationProblemEventExternal

export const buildSpawnCompensationDedupeKey = (
    objectId: EphemeraObjectId,
    attemptCount: number
): string => `${objectId}::spawnCompensation::${attemptCount}`

export const isSpawnCompensationProblemEvent = (event: any): event is EphemeraObjectsSpawnCompensationProblemEvent => (
    Boolean(
        event &&
        typeof event === 'object' &&
        event.type === 'Spawn Compensation Problem' &&
        typeof event.objectId === 'string' &&
        isEphemeraObjectId(event.objectId) &&
        typeof event.targetRoomId === 'string' &&
        isEphemeraRoomId(event.targetRoomId) &&
        typeof event.sourceOperation === 'string' &&
        event.sourceOperation.length > 0 &&
        typeof event.placementError === 'string' &&
        typeof event.deleteError === 'string' &&
        typeof event.attemptCount === 'number' &&
        Number.isFinite(event.attemptCount) &&
        typeof event.dedupeKey === 'string' &&
        event.dedupeKey.length > 0
    )
)

export const isEphemeraObjectsEventUpdate = (event: unknown): event is EphemeraObjectsEventUpdate => (
    isSpawnCompensationProblemEvent(event)
)

export class EphemeraObjectsEventSerializer implements DataSourceEventSerializer<EphemeraObjectsEventUpdate, EphemeraObjectsEventExternal> {
    constructor(private readonly env: DataSourceEnvironment) {
        void env
    }

    serialize(params: {
        content: EphemeraObjectsEventUpdate;
        header: StreamingEventHeader;
    }): EphemeraObjectsEventExternal {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            throw new Error('EphemeraObjectsEventSerializer does not support snapshot serialization')
        }
        if (header.type === 'Spawn Compensation Problem' && isSpawnCompensationProblemEvent(content)) {
            return {
                type: 'Spawn Compensation Problem',
                objectId: content.objectId,
                targetRoomId: content.targetRoomId,
                sourceOperation: content.sourceOperation,
                placementError: content.placementError,
                deleteError: content.deleteError,
                attemptCount: content.attemptCount,
                dedupeKey: content.dedupeKey,
                timestamp: content.timestamp,
            }
        }
        throw new Error(`Unknown ephemera objects event type: ${header.type}`)
    }

    async deserialize(params: {
        content: any;
        header: StreamingEventHeader
    }): Promise<EphemeraObjectsEventUpdate | null> {
        const { content, header } = params
        if (header?.type === 'Snapshot') {
            return null
        }
        if (header.type === 'Spawn Compensation Problem') {
            if (
                typeof content?.objectId !== 'string' ||
                !isEphemeraObjectId(content.objectId) ||
                typeof content?.targetRoomId !== 'string' ||
                !isEphemeraRoomId(content.targetRoomId) ||
                typeof content?.sourceOperation !== 'string' ||
                content.sourceOperation.length === 0 ||
                typeof content?.placementError !== 'string' ||
                typeof content?.deleteError !== 'string' ||
                typeof content?.attemptCount !== 'number' ||
                !Number.isFinite(content.attemptCount) ||
                typeof content?.dedupeKey !== 'string' ||
                content.dedupeKey.length === 0
            ) {
                return null
            }
            return {
                type: 'Spawn Compensation Problem',
                objectId: content.objectId,
                targetRoomId: content.targetRoomId,
                sourceOperation: content.sourceOperation,
                placementError: content.placementError,
                deleteError: content.deleteError,
                attemptCount: content.attemptCount,
                dedupeKey: content.dedupeKey,
                timestamp: content.timestamp || new Date().toISOString(),
            }
        }
        return null
    }
}
