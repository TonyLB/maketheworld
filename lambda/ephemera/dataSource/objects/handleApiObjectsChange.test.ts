import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    handleAcmeOrderAddObjects,
    handleApiObjectsChangeCommand,
    handleAwaitRoadRunnerClearObjects,
} from './handleApiObjectsChange'
import { applyObjectsChange } from './applyObjectsChange'
import { clearCoyoteGameImprovisationObjects } from './clearCoyoteGameImprovisationObjects'
import { spawnOneImprovisationObject } from './spawnImprovisationObjectsBatch'

jest.mock('./applyObjectsChange', () => ({
    applyObjectsChange: jest.fn(),
}))

jest.mock('./clearCoyoteGameImprovisationObjects', () => ({
    clearCoyoteGameImprovisationObjects: jest.fn(),
}))

jest.mock('./spawnImprovisationObjectsBatch', () => ({
    ...jest.requireActual('./spawnImprovisationObjectsBatch'),
    spawnOneImprovisationObject: jest.fn(),
}))

const applyObjectsChangeMock = applyObjectsChange as jest.MockedFunction<typeof applyObjectsChange>
const clearCoyoteGameImprovisationObjectsMock = clearCoyoteGameImprovisationObjects as jest.MockedFunction<typeof clearCoyoteGameImprovisationObjects>
const spawnOneMock = spawnOneImprovisationObject as jest.MockedFunction<typeof spawnOneImprovisationObject>

const obj = (suffix: string, shortName: string): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
    stableKey: suffix,
})

describe('handleApiObjectsChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        applyObjectsChangeMock.mockReset()
        applyObjectsChangeMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('calls applyObjectsChange with roomId, add, and remove', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            {
                componentId: roomId,
                add: [obj('o1', 'One')],
                remove: ['OBJECT#o2' as EphemeraObjectId],
            },
            { streamEvent }
        )
        expect(applyObjectsChangeMock).toHaveBeenCalledWith({
            roomId,
            add: [obj('o1', 'One')],
            remove: ['OBJECT#o2' as EphemeraObjectId],
        })
    })

    it('does not persist for non-room component ids', async () => {
        await handleApiObjectsChangeCommand(
            { componentId: 'FEATURE#f1', add: [], remove: [] },
            { streamEvent }
        )
        expect(applyObjectsChangeMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('does not stream when apply did not persist', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when apply fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        applyObjectsChangeMock.mockResolvedValue({
            ok: false,
            errorMessage: 'no row',
        })
        const roomId = 'ROOM#fail' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [obj('x', 'X')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })

    it('streams I4 Objects Changed when apply persisted', async () => {
        const roomId = 'ROOM#r3' as EphemeraRoomId
        applyObjectsChangeMock.mockResolvedValue({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#b' as EphemeraObjectId],
            destroyedIds: [],
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [obj('b', 'B')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                createdIds: ['OBJECT#b'],
                destroyedIds: [],
            },
        })
    })

    it('streams partial createdIds when some adds failed', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const roomId = 'ROOM#partial' as EphemeraRoomId
        applyObjectsChangeMock.mockResolvedValue({
            ok: true,
            persisted: true,
            createdIds: ['OBJECT#a' as EphemeraObjectId],
            destroyedIds: [],
            addFailures: [{
                objectId: 'OBJECT#b' as EphemeraObjectId,
                stableKey: 'b',
                errorMessage: 'placement failed',
            }],
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [obj('a', 'A'), obj('b', 'B')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({
            streamKey: roomId,
            update: expect.objectContaining({
                createdIds: ['OBJECT#a'],
            }),
        }))
        expect(consoleSpy).toHaveBeenCalledWith('[mtw.ephemera.objects] add failed', expect.objectContaining({
            objectId: 'OBJECT#b',
            stableKey: 'b',
        }))
        consoleSpy.mockRestore()
    })

    it('does not stream when all adds failed', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        applyObjectsChangeMock.mockResolvedValue({
            ok: false,
            errorMessage: '1 add(s) failed',
            addFailures: [{
                objectId: 'OBJECT#x' as EphemeraObjectId,
                stableKey: 'x',
                errorMessage: 'placement failed',
            }],
        })
        await handleApiObjectsChangeCommand(
            { componentId: 'ROOM#allfail' as EphemeraRoomId, add: [obj('x', 'X')], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})

describe('handleAwaitRoadRunnerClearObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        clearCoyoteGameImprovisationObjectsMock.mockReset()
        clearCoyoteGameImprovisationObjectsMock.mockResolvedValue({ ok: true, persisted: false, destroyedIds: [] })
        streamEvent.mockClear()
    })

    it('delegates to clearCoyoteGameImprovisationObjects with objects streamEvent', async () => {
        const getGameRooms = jest.fn(async () => ['VORTEX', 'BRIDGE'])

        await handleAwaitRoadRunnerClearObjects({
            streamEvent,
            getGameRooms,
        })

        expect(clearCoyoteGameImprovisationObjectsMock).toHaveBeenCalledWith(
            { getGameRooms },
            { objectsStreamEvent: streamEvent }
        )
    })
})

describe('handleAcmeOrderAddObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)
    const environmentAffordanceMatrixOrder = {
        shortName: 'paint tunnel kit',
        stableKey: 'paint-tunnel-kit',
        tropeAffinities: [
            {
                trope: 'Contraption' as const,
                aptness: 'High' as const,
                narrowing: 'scene-dependent rig',
                environmentAffordances: [
                    { object: 'rock-wall' as const, roles: ['Finishing Move' as const] },
                    { object: 'long-fall' as const, roles: ['Finishing Move' as const] },
                    { object: 'cactus' as const, roles: ['Disadvantage' as const] },
                    { object: 'boulder' as const, roles: ['Contraption' as const] },
                    { object: 'tumbleweed' as const, roles: ['Misdirection' as const] },
                ],
            },
            {
                trope: 'Bait' as const,
                aptness: 'Good' as const,
                narrowing: 'portable bait',
            },
        ],
    }

    beforeEach(() => {
        spawnOneMock.mockReset()
        spawnOneMock.mockImplementation(async (args) => ({ ok: true, objectId: args.objectId }))
        streamEvent.mockClear()
    })

    it('spawns each order line in character current room and streams createdIds', async () => {
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#VORTEX' as EphemeraRoomId)
        const uuidValues = ['u1', 'u2']
        const uuidFactory = jest.fn(() => uuidValues.shift() || 'fallback')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [
                { shortName: 'anvil', stableKey: 'anvil' },
                {
                    shortName: 'giant magnet',
                    stableKey: 'giant-magnet',
                    tropeAffinities: [{
                        trope: 'Contraption',
                        aptness: 'High',
                        narrowing: 'magnetic winch rig',
                    }],
                },
            ],
            confidence: 0.9,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            uuidFactory,
            spawnOneImpl: spawnOneMock,
        })

        expect(spawnOneMock).toHaveBeenCalledTimes(2)
        expect(spawnOneMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                objectId: 'OBJECT#u1',
                shortName: 'anvil',
                stableKey: 'anvil',
                targetRoomId: 'ROOM#VORTEX',
            }),
            expect.any(Object)
        )
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: 'ROOM#VORTEX',
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                createdIds: ['OBJECT#u1', 'OBJECT#u2'],
                destroyedIds: [],
            },
        })
    })

    it('uses resolveCharacterRoomId for delivery room', async () => {
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#STRAIGHTAWAY' as EphemeraRoomId)
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'anvil', stableKey: 'anvil' }],
            confidence: 0.9,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            uuidFactory,
            spawnOneImpl: spawnOneMock,
        })

        expect(resolveCharacterRoomId).toHaveBeenCalledWith('CHARACTER#123')
        expect(spawnOneMock).toHaveBeenCalledWith(
            expect.objectContaining({ targetRoomId: 'ROOM#STRAIGHTAWAY' }),
            expect.any(Object)
        )
        expect(streamEvent).toHaveBeenCalledWith(expect.objectContaining({ streamKey: 'ROOM#STRAIGHTAWAY' }))
    })

    it('does nothing when orders are empty', async () => {
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#VORTEX' as EphemeraRoomId)

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [],
            confidence: 0.9,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            spawnOneImpl: spawnOneMock,
        })

        expect(resolveCharacterRoomId).not.toHaveBeenCalled()
        expect(spawnOneMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('filters environment affordances for ROOM#STRAIGHTAWAY', async () => {
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#STRAIGHTAWAY' as EphemeraRoomId)
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            uuidFactory,
            spawnOneImpl: spawnOneMock,
        })

        const spawnArgs = spawnOneMock.mock.calls[0]?.[0]
        expect(spawnArgs?.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Misdirection'] },
        ])
    })

    it('filters environment affordances for ROOM#VORTEX', async () => {
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#VORTEX' as EphemeraRoomId)
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            uuidFactory,
            spawnOneImpl: spawnOneMock,
        })

        const spawnArgs = spawnOneMock.mock.calls[0]?.[0]
        expect(spawnArgs?.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'rock-wall', roles: ['Finishing Move'] },
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Misdirection'] },
        ])
    })

    it('streams partial createdIds when some spawns fail (S3)', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#VORTEX' as EphemeraRoomId)
        const uuidValues = ['u1', 'u2']
        const uuidFactory = jest.fn(() => uuidValues.shift() || 'fallback')
        spawnOneMock.mockImplementation(async (args) => {
            if (args.objectId === 'OBJECT#u2') {
                return { ok: false, errorMessage: 'placement failed' }
            }
            return { ok: true, objectId: args.objectId }
        })

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [
                { shortName: 'anvil', stableKey: 'anvil' },
                { shortName: 'magnet', stableKey: 'magnet' },
            ],
            confidence: 0.9,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            uuidFactory,
            spawnOneImpl: spawnOneMock,
        })

        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: 'ROOM#VORTEX',
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                createdIds: ['OBJECT#u1'],
                destroyedIds: [],
            },
        })
        expect(consoleSpy).toHaveBeenCalledWith('[mtw.ephemera.objects] add failed', expect.objectContaining({
            objectId: 'OBJECT#u2',
            stableKey: 'magnet',
            errorMessage: 'placement failed',
        }))
        consoleSpy.mockRestore()
    })

    it('does not stream when all spawns fail', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        const resolveCharacterRoomId = jest.fn(async () => 'ROOM#VORTEX' as EphemeraRoomId)
        const uuidFactory = jest.fn(() => 'u1')
        spawnOneMock.mockResolvedValue({ ok: false, errorMessage: 'placement failed' })

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'anvil', stableKey: 'anvil' }],
            confidence: 0.9,
        }, {
            streamEvent,
            resolveCharacterRoomId,
            uuidFactory,
            spawnOneImpl: spawnOneMock,
        })

        expect(streamEvent).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('[mtw.ephemera.objects] add failed', expect.objectContaining({
            objectId: 'OBJECT#u1',
            stableKey: 'anvil',
        }))
        consoleSpy.mockRestore()
    })
})
