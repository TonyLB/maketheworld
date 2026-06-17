jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        transactWrite: jest.fn(),
        getItem: jest.fn(),
    },
    exponentialBackoffWrapper: jest.fn(async (fn: () => Promise<unknown>) => fn()),
}))

const improvisationSetMock = jest.fn()
const improvisationInvalidateMock = jest.fn()
const objectMetaSetMock = jest.fn()
const objectMetaInvalidateMock = jest.fn()
const objectMetaGetMock = jest.fn()
const affordanceInvalidateMock = jest.fn()

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ImprovisationComponentData: {
            set: (...args: unknown[]) => improvisationSetMock(...args),
            invalidate: (...args: unknown[]) => improvisationInvalidateMock(...args),
            get: jest.fn(),
        },
        ObjectEphemeraMeta: {
            set: (...args: unknown[]) => objectMetaSetMock(...args),
            invalidate: (...args: unknown[]) => objectMetaInvalidateMock(...args),
            get: (...args: unknown[]) => objectMetaGetMock(...args),
        },
        AffordanceRoomDeliverable: {
            invalidate: (...args: unknown[]) => affordanceInvalidateMock(...args),
        },
        CoyoteGame: {
            get: jest.fn(),
        },
        ComponentEphemeraMeta: {
            get: jest.fn(),
        },
    },
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import {
    persistClearCoyoteGameImprovisationObjects,
    persistDeleteImprovisationObject,
    persistSpawnImprovisationObject,
    persistUpdateImprovisationObject,
} from './persistImprovisationObject'

const transactWriteMock = ephemeraDB.transactWrite as jest.Mock

describe('persistImprovisationObject', () => {
    const objectId = 'OBJECT#Anvil' as const
    const roomId = 'ROOM#VORTEX' as const

    beforeEach(() => {
        jest.clearAllMocks()
        transactWriteMock.mockResolvedValue(undefined)
    })

    it('persistSpawnImprovisationObject writes pair + Meta::Object in one transact', async () => {
        const result = await persistSpawnImprovisationObject({
            objectId,
            shortName: 'Anvil',
            stableKey: 'anvil',
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'Anvil',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                },
            },
        ])
        expect(improvisationSetMock).toHaveBeenCalled()
        expect(objectMetaSetMock).toHaveBeenCalledWith(objectId, expect.objectContaining({ stableKey: 'anvil' }))
    })

    it('persistDeleteImprovisationObject deletes both rows', async () => {
        const result = await persistDeleteImprovisationObject({ objectId, affectedRoomIds: [roomId] })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            { Delete: { EphemeraId: objectId, DataCategory: 'ASSET#IMPROVISATION' } },
            { Delete: { EphemeraId: objectId, DataCategory: 'Meta::Object' } },
        ])
        expect(improvisationInvalidateMock).toHaveBeenCalledWith(objectId, 'ASSET#IMPROVISATION')
        expect(objectMetaInvalidateMock).toHaveBeenCalledWith(objectId)
        expect(affordanceInvalidateMock).toHaveBeenCalledWith(roomId)
    })

    it('persistUpdateImprovisationObject merges prior rows', async () => {
        objectMetaGetMock.mockResolvedValue({
            EphemeraId: objectId,
            DataCategory: 'Meta::Object',
            stableKey: 'anvil',
        })
        const priorComponent = new StandardObject({ tag: 'Object', universalKey: objectId, shortName: 'Old' })

        const result = await persistUpdateImprovisationObject({
            objectId,
            shortName: 'New',
        }, {
            getMetaObject: async () => ({
                EphemeraId: objectId,
                DataCategory: 'Meta::Object',
                stableKey: 'anvil',
            }),
            getImprovisationPair: async () => priorComponent,
        })

        expect(result).toEqual({ ok: true, objectId })
        expect(transactWriteMock).toHaveBeenCalledWith([
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'ASSET#IMPROVISATION',
                    tag: 'Object',
                    shortName: 'New',
                },
            },
            {
                Put: {
                    EphemeraId: objectId,
                    DataCategory: 'Meta::Object',
                    stableKey: 'anvil',
                },
            },
        ])
    })

    it('persistClearCoyoteGameImprovisationObjects deletes objects from game room graphs only', async () => {
        const objectTwo = 'OBJECT#Boulder' as const

        const result = await persistClearCoyoteGameImprovisationObjects({
            getGameRooms: async () => ['VORTEX', 'CORNER'],
            getRoomPositionGraph: async (room) => {
                if (room === 'ROOM#VORTEX') {
                    return {
                        EphemeraId: room,
                        DataCategory: 'Meta::Room',
                        positionGraph: {
                            nodes: [{ tag: 'Object', universalKey: objectId }],
                        },
                    }
                }
                if (room === 'ROOM#CORNER') {
                    return {
                        EphemeraId: room,
                        DataCategory: 'Meta::Room',
                        positionGraph: {
                            nodes: [{ tag: 'Object', universalKey: objectTwo }],
                        },
                    }
                }
                return undefined
            },
        })

        expect(result).toEqual({
            ok: true,
            deletedObjectIds: [objectId, objectTwo],
            affectedRoomIds: ['ROOM#VORTEX', 'ROOM#CORNER'],
        })
        expect(transactWriteMock).toHaveBeenCalledTimes(1)
        expect(transactWriteMock.mock.calls[0][0]).toHaveLength(4)
        expect(improvisationInvalidateMock).toHaveBeenCalledTimes(2)
    })

    it('persistClearCoyoteGameImprovisationObjects is a no-op when graphs have no Object nodes', async () => {
        const result = await persistClearCoyoteGameImprovisationObjects({
            getGameRooms: async () => ['VORTEX'],
            getRoomPositionGraph: async (room) => ({
                EphemeraId: room,
                DataCategory: 'Meta::Room',
                positionGraph: { nodes: [{ tag: 'Character', universalKey: 'CHARACTER#X' }] },
            }),
        })

        expect(result).toEqual({
            ok: true,
            deletedObjectIds: [],
            affectedRoomIds: ['ROOM#VORTEX'],
        })
        expect(transactWriteMock).not.toHaveBeenCalled()
    })
})
