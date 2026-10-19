import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { parentRemainderKey, testLudicGraph } from '../ludicGraph/testFixtures'
import { roomsInvalidatedByHosts } from './roomsInvalidatedByHosts'

const roomA = 'ROOM#A' as EphemeraRoomId
const roomB = 'ROOM#B' as EphemeraRoomId
const table = 'OBJECT#Table' as EphemeraObjectId
const box = 'OBJECT#Box' as EphemeraObjectId
const bigBox = 'OBJECT#BigBox' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const hero = 'CHARACTER#Hero' as EphemeraCharacterId

const presenceAt = (fromHostId: EphemeraMembershipHostId): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: PresenceKey(`${fromHostId.replace('#', '-')}-binding`),
    fromHostPresences: [{ host: fromHostId, presence: parentRemainderKey(fromHostId) }],
    cover: { members: [] },
})

const graphsFrom = (parents: Partial<Record<EphemeraMembershipHostId, EphemeraMembershipHostId>>) => (
    jest.fn(async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => (
        testLudicGraph(hostId, { nodes: parents[hostId] ? [presenceAt(parents[hostId]!)] : [] })
    ))
)

describe('roomsInvalidatedByHosts', () => {
    it('marks the room a cup placed on a table sits in', async () => {
        const getGraph = graphsFrom({ [cup]: table, [table]: roomA })
        await expect(roomsInvalidatedByHosts([cup, table], getGraph)).resolves.toEqual([roomA])
    })

    it('marks a room once when several written hosts reach it (box-on-table to table)', async () => {
        const getGraph = graphsFrom({ [cup]: box, [box]: table, [table]: roomA })
        await expect(roomsInvalidatedByHosts([cup, box, table], getGraph)).resolves.toEqual([roomA])
    })

    it('walks the full depth (cup moved between two boxes inside a box)', async () => {
        const getGraph = graphsFrom({ [cup]: box, [box]: bigBox, [bigBox]: roomA })
        await expect(roomsInvalidatedByHosts([cup], getGraph)).resolves.toEqual([roomA])
    })

    it('marks both rooms when written hosts sit in different rooms', async () => {
        const getGraph = graphsFrom({ [cup]: roomA, [box]: roomB })
        await expect(roomsInvalidatedByHosts([cup, box], getGraph)).resolves.toEqual([roomA, roomB])
    })

    it('marks nothing for an object handed between characters, however deep the room they stand in', async () => {
        const getGraph = graphsFrom({ [cup]: hero, [hero]: roomA })
        await expect(roomsInvalidatedByHosts([cup, hero], getGraph)).resolves.toEqual([])
    })

    it('marks a room that is itself a written host, with no fetch', async () => {
        const getGraph = graphsFrom({})
        await expect(roomsInvalidatedByHosts([roomA], getGraph)).resolves.toEqual([roomA])
        expect(getGraph).not.toHaveBeenCalled()
    })

    it('marks nothing for a commit that touches only a character shard', async () => {
        const getGraph = graphsFrom({ [hero]: roomA })
        await expect(roomsInvalidatedByHosts([hero], getGraph)).resolves.toEqual([])
        expect(getGraph).not.toHaveBeenCalled()
    })

    it('still marks the rooms a moving character leaves and arrives at', async () => {
        const getGraph = graphsFrom({ [hero]: roomB })
        await expect(roomsInvalidatedByHosts([hero, roomA, roomB], getGraph)).resolves.toEqual([roomA, roomB])
    })
})
