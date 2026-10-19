import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import { parentRemainderKey, testLudicGraph } from '../ludicGraph/testFixtures'
import { markHostsStale, markRoomsStale } from './markStale'
import * as store from './store'

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const cup = 'OBJECT#Cup' as EphemeraObjectId

describe('markStale', () => {
    const markLudicCacheStale = jest.spyOn(store, 'markLudicCacheStale')
    const bus = { publish: jest.fn() }

    beforeEach(() => {
        markLudicCacheStale.mockReset()
        markLudicCacheStale.mockResolvedValue(undefined)
        bus.publish.mockReset()
    })

    afterAll(() => markLudicCacheStale.mockRestore())

    it('writes the marker, then publishes Ludic Cache Invalidated once for the distinct rooms', async () => {
        const order: string[] = []
        markLudicCacheStale.mockImplementation(async () => { order.push('mark') })
        bus.publish.mockImplementation(() => { order.push('publish') })

        await expect(markRoomsStale([roomA, roomB, roomA], { messageBus: bus })).resolves.toEqual([roomA, roomB])

        expect(markLudicCacheStale).toHaveBeenCalledWith([roomA, roomB])
        expect(order).toEqual(['mark', 'publish'])
        expect(bus.publish).toHaveBeenCalledTimes(1)
        const message = bus.publish.mock.calls[0][0]
        expect(message).toMatchObject({ type: 'StreamingEvent', dataSourceKey: 'mtw.ephemera.positions', header: { type: 'Ludic Cache Invalidated' } })
        await expect(message.getContent()).resolves.toEqual({ type: 'Ludic Cache Invalidated', roomIds: [roomA, roomB] })
    })

    it('does nothing for no rooms', async () => {
        await expect(markRoomsStale([], { messageBus: bus })).resolves.toEqual([])
        expect(markLudicCacheStale).not.toHaveBeenCalled()
        expect(bus.publish).not.toHaveBeenCalled()
    })

    it('publishes nothing when the mark fails', async () => {
        markLudicCacheStale.mockRejectedValue(new Error('slow down'))
        await expect(markRoomsStale([roomA], { messageBus: bus })).rejects.toThrow('slow down')
        expect(bus.publish).not.toHaveBeenCalled()
    })

    it('markHostsStale resolves the hosts to their rooms first', async () => {
        const getGraph = async (hostId: EphemeraMembershipHostId) => testLudicGraph(hostId, {
            nodes: hostId === cup
                ? [{ tag: 'Presence', universalKey: PresenceKey('cup-binding'), fromHostPresence: { host: roomA, presence: parentRemainderKey(roomA) }, cover: { members: [] } }]
                : [],
        })
        await expect(markHostsStale([cup], { messageBus: bus, getGraph })).resolves.toEqual([roomA])
        expect(markLudicCacheStale).toHaveBeenCalledWith([roomA])
    })
})
