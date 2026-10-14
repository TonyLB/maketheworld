import messageBus from '../messageBus'
import { ephemeraDataSource } from './index'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardArea } from '@tonylb/mtw-wml/ts/standardize/components/area'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import getCurrentTimestamp from '../internalUtils/dateUtil'

// Mock the messageBus
jest.mock('../messageBus', () => ({
    send: jest.fn(),
    publish: jest.fn(),
    flush: jest.fn(),
    subscribe: jest.fn()
}))

jest.mock('./perception/kickRoomHeaderBroadcast', () => ({
    kickRoomHeaderBroadcastForRoom: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./positions/manipulation/containment/populateContainmentAtCache', () => ({
    populateContainmentAtCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./positions/manipulation/containment/removeAuthoredObject', () => ({
    removeAuthoredObject: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./positions/ludicCache/markStale', () => ({
    markHostsStale: jest.fn().mockResolvedValue([]),
    markRoomsStale: jest.fn().mockResolvedValue([]),
}))

import { markHostsStale, markRoomsStale } from './positions/ludicCache/markStale'
import internalCache from '../internalCache'
import { removeAuthoredObject } from './positions/manipulation/containment/removeAuthoredObject'
import { kickRoomHeaderBroadcastForRoom } from './perception/kickRoomHeaderBroadcast'
import { populateContainmentAtCache } from './positions/manipulation/containment/populateContainmentAtCache'

// Mock the date utility
jest.mock('../internalUtils/dateUtil', () => ({
    __esModule: true,
    default: jest.fn()
}))

const mockMessageBus = messageBus as jest.Mocked<typeof messageBus>
const getCurrentTimestampMock = getCurrentTimestamp as jest.MockedFunction<typeof getCurrentTimestamp>

describe('Ephemera DataSource receiveEvents', () => {
    const FIXED_TS = 1700000000000

    beforeEach(() => {
        jest.clearAllMocks()
        getCurrentTimestampMock.mockReturnValue(FIXED_TS)
        // No test here reads Dynamo: a zone change finds the asset in no room unless a test says otherwise.
        jest.spyOn(internalCache.AssetRooms, 'get').mockResolvedValue({ EphemeraId: 'ASSET#test-asset', rooms: [] } as any)
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    describe('Component Updated Events', () => {
        it('should process Component Updated events and kick room header broadcast for room components', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room uuid=(test-room)>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: roomComponent
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(kickRoomHeaderBroadcastForRoom).toHaveBeenCalledWith({
                roomId: 'ROOM#test-room',
                messageBus: mockMessageBus,
            })
        })

        it('should not send Perception message for non-room components', async () => {
            const characterComponent = new StandardCharacter(deIndentWML(`
                <Character uuid=(test-character)>
                    <ShortName>Test Character</ShortName>
                </Character>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: characterComponent
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).not.toHaveBeenCalled()
        })

        it('should not send Perception message when component universalKey is missing', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room key=(testRoom)>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: roomComponent
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).not.toHaveBeenCalled()
        })
    })

    describe('Component Updated Events: stale-marking', () => {
        const componentEvent = (component: any) => [{
            header: { dataSourceKey: 'mtw.assets' as const, streamKey: 'ASSET#test-asset', timestamp: getCurrentTimestamp(), type: 'Component Updated' },
            getContent: () => Promise.resolve({ type: 'Component Updated' as const, component }),
        }]
        const receive = (events: any[]) => ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

        it('marks the rooms showing an edited room, before its header is kicked (a room whose participating assets changed arrives here too)', async () => {
            const room = new StandardRoom(deIndentWML(`<Room uuid=(test-room)><ShortName>Test Room</ShortName></Room>`))
            await receive(componentEvent(room))
            expect(markHostsStale).toHaveBeenCalledWith(['ROOM#test-room'], { includeCharacterStarts: true })
            expect((markHostsStale as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((kickRoomHeaderBroadcastForRoom as jest.Mock).mock.invocationCallOrder[0])
        })

        it('marks the room a renamed character stands in', async () => {
            const character = new StandardCharacter(deIndentWML(`<Character uuid=(test-character)><ShortName>Test Character</ShortName></Character>`))
            await receive(componentEvent(character))
            expect(markHostsStale).toHaveBeenCalledWith(['CHARACTER#test-character'], { includeCharacterStarts: true })
        })

        it('marks nothing for a component with no universalKey', async () => {
            const room = new StandardRoom(deIndentWML(`<Room key=(testRoom)><ShortName>Test Room</ShortName></Room>`))
            await receive(componentEvent(room))
            expect(markHostsStale).not.toHaveBeenCalled()
        })
    })

    describe('Component Updated Events: containment population', () => {
        it('populates Feature-in-Room containment when a Room with a Feature child is cache-updated', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room uuid=(cafe)>
                    <ShortName>Cafe</ShortName>
                    <Feature uuid=(sign) />
                </Room>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: roomComponent
                    })
                }
            ]

            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(populateContainmentAtCache).toHaveBeenCalledWith(
                'ROOM#cafe',
                [expect.objectContaining({ universalKey: 'FEATURE#sign' })],
                { messageBus: mockMessageBus }
            )
        })

        it('populates Room-in-Area containment when an Area with a Room child is cache-updated', async () => {
            const areaComponent = new StandardArea(deIndentWML(`
                <Area uuid=(overworld)>
                    <ShortName>Overworld</ShortName>
                    <Room uuid=(cafe) />
                </Area>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: areaComponent
                    })
                }
            ]

            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(populateContainmentAtCache).toHaveBeenCalledWith(
                'AREA#overworld',
                [expect.objectContaining({ universalKey: 'ROOM#cafe' })],
                { messageBus: mockMessageBus }
            )
        })

        it('calls populateContainmentAtCache for a Room with no ludicGraph nodes, so it gets its root remainder', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room uuid=(empty)>
                    <ShortName>Empty Room</ShortName>
                </Room>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: roomComponent
                    })
                }
            ]

            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(populateContainmentAtCache).toHaveBeenCalledWith(roomComponent.universalKey, [], expect.objectContaining({ messageBus: expect.anything() }))
        })

        it('does not call populateContainmentAtCache for a component kind with no ludicGraph field (e.g. Character)', async () => {
            const characterComponent = new StandardCharacter(deIndentWML(`
                <Character uuid=(test-character)>
                    <ShortName>Test Character</ShortName>
                </Character>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: characterComponent
                    })
                }
            ]

            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(populateContainmentAtCache).not.toHaveBeenCalled()
        })
    })

    describe('Component Removed Events', () => {
        const removedEvent = (universalKey: string) => ({
            header: {
                dataSourceKey: 'mtw.assets' as const,
                streamKey: 'ASSET#test-asset',
                timestamp: getCurrentTimestamp(),
                type: 'Component Removed'
            },
            getContent: () => Promise.resolve({ component: { universalKey } })
        })
        const receive = (events: any[]) => ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

        it('removes a de-authored Object', async () => {
            await receive([removedEvent('OBJECT#cup')])
            expect(removeAuthoredObject).toHaveBeenCalledWith('OBJECT#cup', { messageBus: mockMessageBus })
        })

        it('ignores removed Rooms and Features (their removal stays deferred)', async () => {
            await receive([removedEvent('ROOM#cafe'), removedEvent('FEATURE#sign')])
            expect(removeAuthoredObject).not.toHaveBeenCalled()
        })
    })

    describe('Canon Updated Events', () => {
        it('should process Canon Updated events and send CanonSet messages', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'canon-update',
                        timestamp: getCurrentTimestamp(),
                        type: 'Canon Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Canon Updated' as const,
                        assetIds: ['ASSET#canon1', 'ASSET#canon2', 'ASSET#canon3']
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: ['ASSET#canon1', 'ASSET#canon2', 'ASSET#canon3']
            })
        })

        it('should filter out non-ephemera asset IDs', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'canon-update',
                        timestamp: getCurrentTimestamp(),
                        type: 'Canon Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Canon Updated' as const,
                        assetIds: ['ASSET#canon1', 'NON-ASSET#invalid', 'ASSET#canon2']
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: ['ASSET#canon1', 'ASSET#canon2']
            })
        })

        it('should send CanonSet message even when assetIds is empty', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'canon-update',
                        timestamp: getCurrentTimestamp(),
                        type: 'Canon Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Canon Updated' as const,
                        assetIds: []
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: []
            })
        })
    })

    describe('Zone Updated Events: stale-marking', () => {
        const assetRooms = () => internalCache.AssetRooms.get as unknown as jest.Mock
        const zoneEvent = (fromZone: string, toZone: string) => [{
            header: { dataSourceKey: 'mtw.assets' as const, streamKey: 'ASSET#test-asset', timestamp: getCurrentTimestamp(), type: 'Zone Updated' },
            getContent: () => Promise.resolve({ type: 'Zone Updated' as const, fromZone, toZone }),
        }]
        const receive = (events: any[]) => ephemeraDataSource.receiveEvents?.({ events, streamEvent: jest.fn().mockResolvedValue(undefined), streamEnvelope: jest.fn().mockResolvedValue(undefined) })

        beforeEach(() => {
            assetRooms().mockReset()
            assetRooms().mockResolvedValue({ EphemeraId: 'ASSET#test-asset', rooms: ['ROOM#a', 'ROOM#b'] } as any)
        })

        it('marks every room using an asset that enters Canon', async () => {
            await receive(zoneEvent('Library', 'Canon'))
            expect(assetRooms()).toHaveBeenCalledWith('ASSET#test-asset')
            expect(markRoomsStale).toHaveBeenCalledWith(['ROOM#a', 'ROOM#b'])
        })

        it('marks every room using an asset that leaves Canon', async () => {
            await receive(zoneEvent('Canon', 'Library'))
            expect(markRoomsStale).toHaveBeenCalledWith(['ROOM#a', 'ROOM#b'])
        })

        it('marks nothing for a zone change that does not touch Canon', async () => {
            await receive(zoneEvent('Library', 'Personal'))
            expect(markRoomsStale).not.toHaveBeenCalled()
        })

        it('marks nothing for an asset no room uses', async () => {
            assetRooms().mockResolvedValue(undefined)
            await receive(zoneEvent('Library', 'Canon'))
            expect(markRoomsStale).toHaveBeenCalledWith([])
        })

        it('marks nothing on Canon Updated alone: the global order is not read by any room stack', async () => {
            await receive([{
                header: { dataSourceKey: 'mtw.assets' as const, streamKey: 'canon-global', timestamp: getCurrentTimestamp(), type: 'Canon Updated' },
                getContent: () => Promise.resolve({ type: 'Canon Updated' as const, assetIds: ['ASSET#test-asset'] }),
            }])
            expect(markRoomsStale).not.toHaveBeenCalled()
        })
    })

    describe('Zone Updated Events', () => {
        it('should process Zone Updated events moving to Canon', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Zone Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Canon'
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonAdd',
                assetId: 'ASSET#test-asset'
            })
        })

        it('should process Zone Updated events moving from Canon', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Zone Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Canon',
                        toZone: 'Library'
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonRemove',
                assetId: 'ASSET#test-asset'
            })
        })

        it('should not send messages for non-Canon zone changes', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Zone Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Personal'
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).not.toHaveBeenCalled()
        })

        it('should not send messages for non-ephemera asset IDs', async () => {
            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'NON-ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Zone Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Canon'
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).not.toHaveBeenCalled()
        })
    })

    describe('Mixed Events', () => {
        it('should process multiple different event types in sequence', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room uuid=(test-room)>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))

            const events = [
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#test-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Component Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Component Updated' as const,
                        component: roomComponent
                    })
                },
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'canon-update',
                        timestamp: getCurrentTimestamp(),
                        type: 'Canon Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Canon Updated' as const,
                        assetIds: ['ASSET#canon1', 'ASSET#canon2']
                    })
                },
                {
                    header: {
                        dataSourceKey: 'mtw.assets' as const,
                        streamKey: 'ASSET#zone-asset',
                        timestamp: getCurrentTimestamp(),
                        type: 'Zone Updated'
                    },
                    getContent: () => Promise.resolve({
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Canon'
                    })
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent, streamEnvelope: jest.fn().mockResolvedValue(undefined) })

            expect(mockMessageBus.publish).toHaveBeenCalledTimes(2)
            expect(kickRoomHeaderBroadcastForRoom).toHaveBeenCalledWith({
                roomId: 'ROOM#test-room',
                messageBus: mockMessageBus,
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: ['ASSET#canon1', 'ASSET#canon2']
            })
            expect(mockMessageBus.publish).toHaveBeenCalledWith({
                type: 'CanonAdd',
                assetId: 'ASSET#zone-asset'
            })
        })
    })

    describe('Event Subscription', () => {
        it('should subscribe to events from mtw.assets', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.assets',
                    streamKey: 'test-stream',
                    timestamp: getCurrentTimestamp(),
                    type: 'Component Updated'
                },
                getContent: () => Promise.resolve({})
            }

            expect(ephemeraDataSource.subscribedEventTypeGuard?.(envelope)).toBe(true)
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEnvelope = {
                header: {
                    dataSourceKey: 'mtw.other',
                    streamKey: 'test-stream',
                    timestamp: getCurrentTimestamp(),
                    type: 'Test Event'
                },
                getContent: () => Promise.resolve({})
            }

            expect(ephemeraDataSource.subscribedEventTypeGuard?.(otherEnvelope)).toBe(false)
        })

        it('should not subscribe to Ephemera RenderCache Finding from mtw.diagnostics', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: getCurrentTimestamp(),
                    type: 'Ephemera RenderCache Finding'
                },
                getContent: () => Promise.resolve({})
            }

            expect(ephemeraDataSource.subscribedEventTypeGuard?.(envelope)).toBe(false)
        })

        it('should not subscribe to Room Occupancy Drift Finding from mtw.diagnostics', () => {
            const envelope = {
                header: {
                    dataSourceKey: 'mtw.diagnostics',
                    streamKey: 'global',
                    timestamp: getCurrentTimestamp(),
                    type: 'Room Occupancy Drift Finding'
                },
                getContent: () => Promise.resolve({})
            }

            expect(ephemeraDataSource.subscribedEventTypeGuard?.(envelope)).toBe(false)
        })
    })
})