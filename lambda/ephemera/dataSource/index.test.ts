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

    describe('Component Updated Events: containment population (RD-4, presenceRefactor step 3)', () => {
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

        it('does not call populateContainmentAtCache for a component with no ludicGraph nodes', async () => {
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

            expect(populateContainmentAtCache).not.toHaveBeenCalled()
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