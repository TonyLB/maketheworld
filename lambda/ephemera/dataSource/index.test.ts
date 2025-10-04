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
        it('should process Component Updated events and send Perception messages for room components', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room uuid=(test-room)>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))

            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Component Updated' as const,
                        component: roomComponent
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'Perception',
                ephemeraId: 'ROOM#test-room',
                header: true
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
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Component Updated' as const,
                        component: characterComponent
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).not.toHaveBeenCalled()
        })

        it('should not send Perception message when component universalKey is missing', async () => {
            const roomComponent = new StandardRoom(deIndentWML(`
                <Room key=(test-room)>
                    <ShortName>Test Room</ShortName>
                </Room>
            `))

            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Component Updated' as const,
                        component: roomComponent
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).not.toHaveBeenCalled()
        })
    })

    describe('Canon Updated Events', () => {
        it('should process Canon Updated events and send CanonSet messages', async () => {
            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'canon-update',
                    event: {
                        type: 'Canon Updated' as const,
                        assetIds: ['ASSET#canon1', 'ASSET#canon2', 'ASSET#canon3']
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: ['ASSET#canon1', 'ASSET#canon2', 'ASSET#canon3']
            })
        })

        it('should filter out non-ephemera asset IDs', async () => {
            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'canon-update',
                    event: {
                        type: 'Canon Updated' as const,
                        assetIds: ['ASSET#canon1', 'NON-ASSET#invalid', 'ASSET#canon2']
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'CanonSet',
                assetIds: ['ASSET#canon1', 'ASSET#canon2']
            })
        })

        it('should send CanonSet message even when assetIds is empty', async () => {
            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'canon-update',
                    event: {
                        type: 'Canon Updated' as const,
                        assetIds: []
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

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
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Canon'
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'CanonAdd',
                assetId: 'ASSET#test-asset'
            })
        })

        it('should process Zone Updated events moving from Canon', async () => {
            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Zone Updated' as const,
                        fromZone: 'Canon',
                        toZone: 'Library'
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'CanonRemove',
                assetId: 'ASSET#test-asset'
            })
        })

        it('should not send messages for non-Canon zone changes', async () => {
            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Personal'
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).not.toHaveBeenCalled()
        })

        it('should not send messages for non-ephemera asset IDs', async () => {
            const events = [
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'NON-ASSET#test-asset',
                    event: {
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Canon'
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

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
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#test-asset',
                    event: {
                        type: 'Component Updated' as const,
                        component: roomComponent
                    },
                    timestamp: getCurrentTimestamp()
                },
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'canon-update',
                    event: {
                        type: 'Canon Updated' as const,
                        assetIds: ['ASSET#canon1', 'ASSET#canon2']
                    },
                    timestamp: getCurrentTimestamp()
                },
                {
                    dataSourceKey: 'mtw.assets' as const,
                    streamKey: 'ASSET#zone-asset',
                    event: {
                        type: 'Zone Updated' as const,
                        fromZone: 'Library',
                        toZone: 'Canon'
                    },
                    timestamp: getCurrentTimestamp()
                }
            ]

            const mockStreamEvent = jest.fn().mockResolvedValue(undefined)
            await ephemeraDataSource.receiveEvents?.({ events, streamEvent: mockStreamEvent })

            expect(mockMessageBus.send).toHaveBeenCalledTimes(3)
            expect(mockMessageBus.send).toHaveBeenCalledWith({
                type: 'Perception',
                ephemeraId: 'ROOM#test-room',
                header: true
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
            const event = {
                dataSourceKey: 'mtw.assets',
                streamKey: 'test-stream',
                event: {
                    type: 'Component Updated' as const,
                    component: new StandardRoom(deIndentWML(`
                        <Room uuid=(test) />
                    `))
                },
                timestamp: getCurrentTimestamp()
            } as const

            expect(ephemeraDataSource.subscribedEventTypeGuard?.(event)).toBe(true)
        })

        it('should not subscribe to events from other data sources', () => {
            const otherEvent = {
                dataSourceKey: 'mtw.other',
                streamKey: 'test-stream',
                event: {
                    type: 'Test Event' as const
                },
                timestamp: getCurrentTimestamp()
            } as const

            expect(ephemeraDataSource.subscribedEventTypeGuard?.(otherEvent)).toBe(false)
        })
    })
})