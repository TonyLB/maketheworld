import {
    buildSpawnCompensationDedupeKey,
    EphemeraObjectsEventSerializer,
    isEphemeraObjectsEventUpdate,
    isSpawnCompensationProblemEvent,
} from './index'
import type { DataSourceEnvironment } from '@tonylb/mtw-interfaces/ts/DataSourceEnvironment'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

const OBJECT_ID = 'OBJECT#Skates' as EphemeraObjectId
const ROOM_ID = 'ROOM#Cafe' as EphemeraRoomId

const objectsHeader = (type: string): StreamingEventHeader => ({
    dataSourceKey: 'mtw.ephemera.objects',
    streamKey: 'global',
    timestamp: 0,
    type,
})

describe('EphemeraObjectsEventSerializer', () => {
    const testEnv: DataSourceEnvironment = {
        fetch: jest.fn() as any
    }
    const serializer = new EphemeraObjectsEventSerializer(testEnv)

    it('serializes and deserializes Spawn Compensation Problem', async () => {
        const event = {
            type: 'Spawn Compensation Problem' as const,
            objectId: OBJECT_ID,
            targetRoomId: ROOM_ID,
            sourceOperation: 'spawnOneImprovisationObject',
            placementError: 'placement failed',
            deleteError: 'delete failed',
            attemptCount: 1,
            dedupeKey: 'OBJECT#Skates::spawnCompensation::1',
            timestamp: '2026-01-01T00:01:00.000Z',
        }
        const serialized = serializer.serialize({
            content: event,
            header: objectsHeader('Spawn Compensation Problem'),
        })
        expect(serialized).toEqual(event)

        const deserialized = await serializer.deserialize({
            content: serialized,
            header: objectsHeader('Spawn Compensation Problem'),
        })
        expect(deserialized).toEqual(event)
    })

    it('returns null for malformed Spawn Compensation Problem', async () => {
        const deserialized = await serializer.deserialize({
            content: {
                objectId: OBJECT_ID,
                targetRoomId: ROOM_ID,
                sourceOperation: 'spawnOneImprovisationObject',
                placementError: 'placement failed',
                deleteError: 'delete failed',
                dedupeKey: 'x',
            },
            header: objectsHeader('Spawn Compensation Problem'),
        })
        expect(deserialized).toBeNull()
    })

    it('throws on Snapshot serialization', () => {
        expect(() => serializer.serialize({
            content: {
                type: 'Spawn Compensation Problem',
                objectId: OBJECT_ID,
                targetRoomId: ROOM_ID,
                sourceOperation: 'spawnOneImprovisationObject',
                placementError: 'placement failed',
                deleteError: 'delete failed',
                attemptCount: 1,
                dedupeKey: 'OBJECT#Skates::spawnCompensation::1',
                timestamp: '2026-01-01T00:01:00.000Z',
            },
            header: objectsHeader('Snapshot'),
        })).toThrow('EphemeraObjectsEventSerializer does not support snapshot serialization')
    })
})

describe('ephemera objects event guards', () => {
    it('validates Spawn Compensation Problem', () => {
        expect(isSpawnCompensationProblemEvent({
            type: 'Spawn Compensation Problem',
            objectId: OBJECT_ID,
            targetRoomId: ROOM_ID,
            sourceOperation: 'spawnOneImprovisationObject',
            placementError: 'placement failed',
            deleteError: 'delete failed',
            attemptCount: 1,
            dedupeKey: 'OBJECT#Skates::spawnCompensation::1',
            timestamp: '2026-01-01T00:00:00.000Z',
        })).toBe(true)
        expect(isSpawnCompensationProblemEvent({
            type: 'Spawn Compensation Problem',
            objectId: OBJECT_ID,
            targetRoomId: ROOM_ID,
            sourceOperation: 'spawnOneImprovisationObject',
            placementError: 'placement failed',
            deleteError: 'delete failed',
            attemptCount: '1',
            dedupeKey: 'key',
        })).toBe(false)
    })

    it('validates union update guard', () => {
        expect(isEphemeraObjectsEventUpdate({
            type: 'Spawn Compensation Problem',
            objectId: OBJECT_ID,
            targetRoomId: ROOM_ID,
            sourceOperation: 'spawnOneImprovisationObject',
            placementError: 'placement failed',
            deleteError: 'delete failed',
            attemptCount: 1,
            dedupeKey: 'OBJECT#Skates::spawnCompensation::1',
            timestamp: '2026-01-01T00:00:00.000Z',
        })).toBe(true)
        expect(isEphemeraObjectsEventUpdate({ type: 'Unknown Event' })).toBe(false)
    })
})

describe('buildSpawnCompensationDedupeKey', () => {
    it('builds stable dedupe keys', () => {
        expect(buildSpawnCompensationDedupeKey(OBJECT_ID, 1)).toBe('OBJECT#Skates::spawnCompensation::1')
        expect(buildSpawnCompensationDedupeKey(OBJECT_ID, 1)).toBe(
            buildSpawnCompensationDedupeKey(OBJECT_ID, 1)
        )
    })
})
