import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { EphemeraLudicGraph } from '../../../positions/ludicGraph'
import { relationsCacheOfGraphs } from '../../objectCatalogTestSupport'
import { crossingSeedHosts, fetchChainGraphs } from './crossingGraphs'

const roomId = 'ROOM#Bridge' as EphemeraRoomId
const wallId = 'OBJECT#Wall' as EphemeraObjectId
const stringId = 'OBJECT#String' as EphemeraObjectId
const hookId = 'OBJECT#Hook' as EphemeraObjectId
const postId = 'OBJECT#Post' as EphemeraObjectId
const portAddress = { owner: wallId, port: 'PORT-wall' as const }
const port = { portId: 'PORT-wall' as const, fromHostId: roomId, kind: 'Custom' as const, exteriorRelationLabel: 'is tied to' }

// The string is tied to a hook through a port on the wall: the room holds the leg to the port, the wall the leg from it.
const roomGraph = EphemeraLudicGraph.empty(roomId)
    .addObject(stringId, 'In')
    .addObject(wallId, 'In')
    .addRelationalEdge({ from: stringId, to: portAddress, kind: 'Custom', relationLabel: 'is tied to' })
const wallGraph = EphemeraLudicGraph.empty(wallId)
    .addObject(hookId, 'In')
    .addPort(port)
    .addRelationalEdge({ from: portAddress, to: hookId, kind: 'Custom', relationLabel: 'is tied to' })
const sameHostGraph = EphemeraLudicGraph.empty(roomId)
    .addObject(stringId, 'In')
    .addObject(postId, 'In')
    .addRelationalEdge({ from: stringId, to: postId, kind: 'Custom', relationLabel: 'is lashed to' })

describe('crossingSeedHosts', () => {
    it('seeds the hosts of a relation whose far end the cache cannot name (an open leg)', () => {
        const cache = relationsCacheOfGraphs([roomGraph])

        expect(crossingSeedHosts([stringId], cache)).toEqual([roomId])
    })

    it('seeds nothing for a joined crossing: the cache names both its ends', () => {
        const cache = relationsCacheOfGraphs([roomGraph, wallGraph])

        expect(crossingSeedHosts([stringId], cache)).toEqual([])
    })

    it('seeds nothing for a relation inside one host, for an object with no relations, or without a cache', () => {
        const cache = relationsCacheOfGraphs([sameHostGraph])

        expect(crossingSeedHosts([stringId, postId], cache)).toEqual([])
        expect(crossingSeedHosts([hookId], relationsCacheOfGraphs([roomGraph]))).toEqual([])
        expect(crossingSeedHosts([stringId], undefined)).toEqual([])
    })
})

describe('fetchChainGraphs', () => {
    const graphs: Record<string, EphemeraLudicGraph> = { [roomId]: roomGraph, [wallId]: wallGraph }

    it('follows a port address to the owner\'s graph, reading only hosts it does not already know', async () => {
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => graphs[hostId])

        const reached = await fetchChainGraphs([roomId], new Map([[roomId, roomGraph]]), getGraph)

        expect([...reached.keys()].sort()).toEqual([roomId, wallId].sort())
        expect(getGraph).toHaveBeenCalledTimes(1)
        expect(getGraph).toHaveBeenCalledWith(wallId)
    })

    it('reads nothing when there is nothing to seed', async () => {
        const getGraph = jest.fn(async (hostId: EphemeraMembershipHostId) => graphs[hostId])

        expect(await fetchChainGraphs([], new Map(), getGraph)).toEqual(new Map())
        expect(getGraph).not.toHaveBeenCalled()
    })
})
