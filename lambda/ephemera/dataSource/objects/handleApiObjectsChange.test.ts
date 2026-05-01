import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import {
    clearRoomObjectsAndPublishUpdate,
    handleAcmeOrderAddObjects,
    handleApiObjectsChangeCommand,
    handleAwaitRoadRunnerClearObjects,
} from './handleApiObjectsChange'
import { clearPersistMetaRoomObjects, mergePersistMetaRoomObjects } from './mergePersistMetaRoomObjects'

jest.mock('./mergePersistMetaRoomObjects', () => ({
    clearPersistMetaRoomObjects: jest.fn(),
    mergePersistMetaRoomObjects: jest.fn(),
}))

const mergePersistMetaRoomObjectsMock = mergePersistMetaRoomObjects as jest.MockedFunction<typeof mergePersistMetaRoomObjects>
const clearPersistMetaRoomObjectsMock = clearPersistMetaRoomObjects as jest.MockedFunction<typeof clearPersistMetaRoomObjects>

const obj = (suffix: string, shortName: string): EphemeraMetaRoomObject => ({
    uuid: `OBJECT#${suffix}` as EphemeraObjectId,
    shortName,
    stableKey: suffix,
})

describe('handleApiObjectsChangeCommand', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        mergePersistMetaRoomObjectsMock.mockReset()
        mergePersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        clearPersistMetaRoomObjectsMock.mockReset()
        clearPersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('calls mergePersistMetaRoomObjects with roomId, add, and remove', async () => {
        const roomId = 'ROOM#r1' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            {
                componentId: roomId,
                add: [obj('o1', 'One')],
                remove: ['OBJECT#o2' as EphemeraObjectId],
            },
            { streamEvent }
        )
        expect(mergePersistMetaRoomObjectsMock).toHaveBeenCalledWith({
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
        expect(mergePersistMetaRoomObjectsMock).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('does not stream when merge did not persist', async () => {
        const roomId = 'ROOM#r2' as EphemeraRoomId
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add: [], remove: [] },
            { streamEvent }
        )
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when merge fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
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

    it('streams Objects Changed when merge persisted', async () => {
        const roomId = 'ROOM#r3' as EphemeraRoomId
        const add = [obj('b', 'B')]
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('a', 'A')],
            newObjects: [obj('a', 'A'), obj('b', 'B')],
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add, remove: [] },
            { streamEvent }
        )
        expect(streamEvent).toHaveBeenCalledTimes(1)
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: roomId,
                add,
                remove: [],
                priorObjects: [obj('a', 'A')],
                newObjects: [obj('a', 'A'), obj('b', 'B')],
            },
        })
    })

    it('passes tropeAffinities affordancesProvided through to merge unchanged', async () => {
        const roomId = 'ROOM#r-pass' as EphemeraRoomId
        const affordancesProvided = [{
            object: 'spring-loaded crate',
            intended: true as const,
            roles: ['Contraption' as const],
        }]
        const add = [{
            uuid: 'OBJECT#o1' as EphemeraObjectId,
            shortName: 'crate',
            stableKey: 'crate',
            tropeAffinities: [{
                trope: 'Contraption' as const,
                aptness: 'High' as const,
                narrowing: 'boxed rig',
                affordancesProvided,
            }],
        }]
        mergePersistMetaRoomObjectsMock.mockResolvedValue({
            ok: true,
            persisted: false,
        })
        await handleApiObjectsChangeCommand(
            { componentId: roomId, add, remove: [] },
            { streamEvent }
        )
        expect(mergePersistMetaRoomObjectsMock).toHaveBeenCalledWith({
            roomId,
            add,
            remove: [],
        })
    })
})

describe('clearRoomObjectsAndPublishUpdate', () => {
    const roomId = 'ROOM#clear' as EphemeraRoomId
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        clearPersistMetaRoomObjectsMock.mockReset()
        clearPersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('publishes Objects Changed with empty newObjects when clear persists', async () => {
        clearPersistMetaRoomObjectsMock.mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('a', 'A'), obj('b', 'B')],
            newObjects: [],
        })

        await clearRoomObjectsAndPublishUpdate(roomId, { streamEvent })

        expect(clearPersistMetaRoomObjectsMock).toHaveBeenCalledWith({ roomId })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: roomId,
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: roomId,
                add: [],
                remove: ['OBJECT#a' as EphemeraObjectId, 'OBJECT#b' as EphemeraObjectId],
                priorObjects: [obj('a', 'A'), obj('b', 'B')],
                newObjects: [],
            },
        })
    })

    it('does not stream when clear does not persist', async () => {
        await clearRoomObjectsAndPublishUpdate(roomId, { streamEvent })
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('logs and does not stream when clear fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        clearPersistMetaRoomObjectsMock.mockResolvedValue({
            ok: false,
            errorCode: 'META_ROOM_MISSING',
            errorMessage: 'no row',
        })
        await clearRoomObjectsAndPublishUpdate(roomId, { streamEvent })
        expect(streamEvent).not.toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})

describe('handleAwaitRoadRunnerClearObjects', () => {
    const streamEvent = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
        streamEvent.mockClear()
    })

    it('clears all coyote rooms in parallel via Promise.all', async () => {
        const clearRoomObjectsAndPublishUpdateImpl = jest
            .fn()
            .mockImplementation(async () => Promise.resolve())
        const getGameRooms = jest.fn(async () => ['VORTEX', 'ROOM#BRIDGE', 'CLIFFTOP'])

        await handleAwaitRoadRunnerClearObjects({
            streamEvent,
            getGameRooms,
            clearRoomObjectsAndPublishUpdateImpl,
        })

        expect(getGameRooms).toHaveBeenCalledTimes(1)
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenCalledTimes(3)
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenNthCalledWith(1, 'ROOM#VORTEX', { streamEvent })
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenNthCalledWith(2, 'ROOM#BRIDGE', { streamEvent })
        expect(clearRoomObjectsAndPublishUpdateImpl).toHaveBeenNthCalledWith(3, 'ROOM#CLIFFTOP', { streamEvent })
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
                    { object: 'tumbleweed' as const, roles: ['Distraction' as const] },
                ],
            },
            {
                trope: 'Distraction' as const,
                aptness: 'Good' as const,
                narrowing: 'portable bait',
            },
        ],
    }

    beforeEach(() => {
        mergePersistMetaRoomObjectsMock.mockReset()
        mergePersistMetaRoomObjectsMock.mockResolvedValue({ ok: true, persisted: false })
        streamEvent.mockClear()
    })

    it('adds incoming order lines as room objects for character current room', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [obj('old', 'Old')],
            newObjects: [
                obj('old', 'Old'),
                {
                    uuid: 'OBJECT#u1' as EphemeraObjectId,
                    shortName: 'anvil',
                    stableKey: 'anvil',
                },
                {
                    uuid: 'OBJECT#u2' as EphemeraObjectId,
                    shortName: 'giant magnet',
                    stableKey: 'giant-magnet',
                    tropeAffinities: [
                        {
                            trope: 'Contraption' as const,
                            aptness: 'High' as const,
                            narrowing: 'magnetic winch rig',
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Contraption', 'Finishing Move'],
                            }],
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'hanging chain mount',
                        },
                    ],
                },
            ],
        })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
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
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'magnetic winch rig',
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Contraption', 'Finishing Move'],
                            }],
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'hanging chain mount',
                        },
                    ],
                },
            ],
            confidence: 0.9,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(getCharacterMeta).toHaveBeenCalledWith('CHARACTER#123')
        expect(mergePersistMetaRoomObjectsImpl).toHaveBeenCalledWith({
            roomId: 'ROOM#VORTEX',
            add: [
                { uuid: 'OBJECT#u1', shortName: 'anvil', stableKey: 'anvil' },
                {
                    uuid: 'OBJECT#u2',
                    shortName: 'giant magnet',
                    stableKey: 'giant-magnet',
                    tropeAffinities: [
                        {
                            trope: 'Contraption',
                            aptness: 'High',
                            narrowing: 'magnetic winch rig',
                            environmentAffordances: [{
                                object: 'boulder',
                                roles: ['Contraption', 'Finishing Move'],
                            }],
                        },
                        {
                            trope: 'Contraption',
                            aptness: 'Good',
                            narrowing: 'hanging chain mount',
                        },
                    ],
                },
            ],
            remove: [],
        })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: 'ROOM#VORTEX',
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: 'ROOM#VORTEX',
                add: [
                    { uuid: 'OBJECT#u1', shortName: 'anvil', stableKey: 'anvil' },
                    {
                        uuid: 'OBJECT#u2',
                        shortName: 'giant magnet',
                        stableKey: 'giant-magnet',
                        tropeAffinities: [
                            {
                                trope: 'Contraption',
                                aptness: 'High',
                                narrowing: 'magnetic winch rig',
                                environmentAffordances: [{
                                    object: 'boulder',
                                    roles: ['Contraption', 'Finishing Move'],
                                }],
                            },
                            {
                                trope: 'Contraption',
                                aptness: 'Good',
                                narrowing: 'hanging chain mount',
                            },
                        ],
                    },
                ],
                remove: [],
                priorObjects: [obj('old', 'Old')],
                newObjects: [
                    obj('old', 'Old'),
                    { uuid: 'OBJECT#u1', shortName: 'anvil', stableKey: 'anvil' },
                    {
                        uuid: 'OBJECT#u2',
                        shortName: 'giant magnet',
                        stableKey: 'giant-magnet',
                        tropeAffinities: [
                            {
                                trope: 'Contraption',
                                aptness: 'High',
                                narrowing: 'magnetic winch rig',
                                environmentAffordances: [{
                                    object: 'boulder',
                                    roles: ['Contraption', 'Finishing Move'],
                                }],
                            },
                            {
                                trope: 'Contraption',
                                aptness: 'Good',
                                narrowing: 'hanging chain mount',
                            },
                        ],
                    },
                ],
            },
        })
    })

    it('persists tropeAffinitiesFailed when present on the bus payload', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [],
            newObjects: [{
                uuid: 'OBJECT#u1' as EphemeraObjectId,
                shortName: 'box',
                stableKey: 'box',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            }],
        })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'box', stableKey: 'box', tropeAffinities: [], tropeAffinitiesFailed: true }],
            confidence: 0.5,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(mergePersistMetaRoomObjectsImpl).toHaveBeenCalledWith({
            roomId: 'ROOM#VORTEX',
            add: [{
                uuid: 'OBJECT#u1',
                shortName: 'box',
                stableKey: 'box',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            }],
            remove: [],
        })
    })

    it('persists tropeAffinitiesFailed when present on the bus payload', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [],
            newObjects: [{
                uuid: 'OBJECT#u1' as EphemeraObjectId,
                shortName: 'box',
                stableKey: 'box',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            }],
        })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{
                shortName: 'box',
                stableKey: 'box',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            }],
            confidence: 0.5,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(mergePersistMetaRoomObjectsImpl).toHaveBeenCalledWith({
            roomId: 'ROOM#VORTEX',
            add: [{
                uuid: 'OBJECT#u1',
                shortName: 'box',
                stableKey: 'box',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            }],
            remove: [],
        })
    })

    it('does nothing when character room cannot be resolved as ephemera room id', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn()
        const getCharacterMeta = jest.fn(async () => ({}))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [{ shortName: 'anvil', stableKey: 'anvil' }],
            confidence: 0.9,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(mergePersistMetaRoomObjectsImpl).not.toHaveBeenCalled()
        expect(streamEvent).not.toHaveBeenCalled()
    })

    it('filters environment affordances for ROOM#STRAIGHTAWAY', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({ ok: true, persisted: false })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#STRAIGHTAWAY' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        const addLine = mergePersistMetaRoomObjectsImpl.mock.calls[0]?.[0]?.add?.[0]
        expect(addLine.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Distraction'] },
        ])
        expect(addLine.tropeAffinities?.[1]).toEqual({
            trope: 'Distraction',
            aptness: 'Good',
            narrowing: 'portable bait',
        })
    })

    it('preserves affordancesProvided while filtering environmentAffordances for ROOM#STRAIGHTAWAY', async () => {
        const affordancesProvided = [{
            object: 'fold-out cliff facade',
            intended: true as const,
            roles: ['Contraption' as const, 'Finishing Move' as const],
        }]
        const orderWithProvided = {
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
                        { object: 'tumbleweed' as const, roles: ['Distraction' as const] },
                    ],
                    affordancesProvided,
                },
                environmentAffordanceMatrixOrder.tropeAffinities[1],
            ],
        }
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({ ok: true, persisted: false })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#STRAIGHTAWAY' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [orderWithProvided],
            confidence: 0.7,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        const addLine = mergePersistMetaRoomObjectsImpl.mock.calls[0]?.[0]?.add?.[0]
        expect(addLine.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'cactus', roles: ['Disadvantage'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Distraction'] },
        ])
        expect(addLine.tropeAffinities?.[0]?.affordancesProvided).toEqual(affordancesProvided)
    })

    it('filters environment affordances for ROOM#BRIDGE', async () => {
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({ ok: true, persisted: false })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#BRIDGE' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        const addLine = mergePersistMetaRoomObjectsImpl.mock.calls[0]?.[0]?.add?.[0]
        expect(addLine.tropeAffinities?.[0]?.environmentAffordances).toEqual([
            { object: 'long-fall', roles: ['Finishing Move'] },
            { object: 'boulder', roles: ['Contraption'] },
            { object: 'tumbleweed', roles: ['Distraction'] },
        ])
    })

    it('filters environment affordances for ROOM#VORTEX and reflects filtered payload in stream event', async () => {
        const filteredAddObject = {
            uuid: 'OBJECT#u1' as EphemeraObjectId,
            shortName: 'paint tunnel kit',
            stableKey: 'paint-tunnel-kit',
            tropeAffinities: [
                {
                    trope: 'Contraption',
                    aptness: 'High',
                    narrowing: 'scene-dependent rig',
                    environmentAffordances: [
                        { object: 'rock-wall', roles: ['Finishing Move'] },
                        { object: 'cactus', roles: ['Disadvantage'] },
                        { object: 'boulder', roles: ['Contraption'] },
                        { object: 'tumbleweed', roles: ['Distraction'] },
                    ],
                },
                {
                    trope: 'Distraction',
                    aptness: 'Good',
                    narrowing: 'portable bait',
                },
            ],
        }
        const mergePersistMetaRoomObjectsImpl = jest.fn().mockResolvedValue({
            ok: true,
            persisted: true,
            priorObjects: [],
            newObjects: [filteredAddObject],
        })
        const getCharacterMeta = jest.fn(async () => ({ RoomId: 'ROOM#VORTEX' }))
        const uuidFactory = jest.fn(() => 'u1')

        await handleAcmeOrderAddObjects({
            type: 'Acme Order',
            characterId: 'CHARACTER#123',
            orders: [environmentAffordanceMatrixOrder],
            confidence: 0.7,
        }, {
            streamEvent,
            getCharacterMeta,
            uuidFactory,
            mergePersistMetaRoomObjectsImpl,
        })

        expect(mergePersistMetaRoomObjectsImpl).toHaveBeenCalledWith({
            roomId: 'ROOM#VORTEX',
            add: [filteredAddObject],
            remove: [],
        })
        expect(streamEvent).toHaveBeenCalledWith({
            streamKey: 'ROOM#VORTEX',
            header: { type: 'Objects Changed' },
            update: {
                type: 'Objects Changed',
                componentId: 'ROOM#VORTEX',
                add: [filteredAddObject],
                remove: [],
                priorObjects: [],
                newObjects: [filteredAddObject],
            },
        })
    })

})
