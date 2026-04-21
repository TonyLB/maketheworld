import messageBus from '../messageBus'
import { ephemeraDataSource } from './index'
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import getCurrentTimestamp from '../internalUtils/dateUtil'

// Mock the messageBus
jest.mock('../messageBus', () => ({
    send: jest.fn(),
    flush: jest.fn(),
    subscribe: jest.fn()
}))

jest.mock('./perception/kickRoomHeaderBroadcast', () => ({
    kickRoomHeaderBroadcastForRoom: jest.fn().mockResolvedValue(undefined),
}))

import { kickRoomHeaderBroadcastForRoom } from './perception/kickRoomHeaderBroadcast'

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

            expect(mockMessageBus.send).not.toHaveBeenCalled()
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

            expect(mockMessageBus.send).not.toHaveBeenCalled()
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

            expect(mockMessageBus.send).toHaveBeenCalledWith({
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

            expect(mockMessageBus.send).toHaveBeenCalledWith({
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

            expect(mockMessageBus.send).toHaveBeenCalledWith({
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

            expect(mockMessageBus.send).toHaveBeenCalledWith({
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

            expect(mockMessageBus.send).toHaveBeenCalledWith({
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

            expect(mockMessageBus.send).not.toHaveBeenCalled()
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

            expect(mockMessageBus.send).not.toHaveBeenCalled()
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

            expect(mockMessageBus.send).toHaveBeenCalledTimes(2)
            expect(kickRoomHeaderBroadcastForRoom).toHaveBeenCalledWith({
                roomId: 'ROOM#test-room',
                messageBus: mockMessageBus,
            })
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: ['ASSET#canon1', 'ASSET#canon2']
            })
            expect(mockMessageBus.send).toHaveBeenCalledWith({
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
    })
})