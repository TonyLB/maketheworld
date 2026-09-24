import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from './index'
import { hasPresenceAncestor } from './presenceAncestry'
import { testLudicGraph } from './testFixtures'

const room = 'ROOM#A' as EphemeraRoomId
const shelf = 'OBJECT#Shelf' as EphemeraObjectId
const table = 'OBJECT#Table' as EphemeraObjectId
const box = 'OBJECT#Box' as EphemeraObjectId
const cup = 'OBJECT#Cup' as EphemeraObjectId
const ball = 'OBJECT#Ball' as EphemeraObjectId

/** A presence binding on the member's own graph, naming the parent it is present at. */
const presenceAt = (fromHostId: EphemeraMembershipHostId): EphemeraLudicGraphStructureNode => ({
    tag: 'Presence',
    universalKey: PresenceKey(`${fromHostId.replace('#', '-')}-binding`),
    fromHostId,
    cover: { tag: 'Full' },
})

/** `parents` maps each host to the hosts it is present at; every graph also lists itself. */
const graphsFrom = (parents: Partial<Record<EphemeraMembershipHostId, EphemeraMembershipHostId[]>>) => (
    jest.fn(async (hostId: EphemeraMembershipHostId): Promise<EphemeraLudicGraph> => (
        testLudicGraph(hostId, { nodes: (parents[hostId] ?? []).map(presenceAt) })
    ))
)

describe('hasPresenceAncestor', () => {
    it('counts a host as its own ancestor, without fetching anything', async () => {
        const getGraph = graphsFrom({})
        await expect(hasPresenceAncestor(box, box, getGraph)).resolves.toBe(true)
        expect(getGraph).not.toHaveBeenCalled()
    })

    it('finds a direct parent and a grandparent', async () => {
        const getGraph = graphsFrom({ [cup]: [box], [box]: [room] })
        await expect(hasPresenceAncestor(cup, box, getGraph)).resolves.toBe(true)
        await expect(hasPresenceAncestor(cup, room, getGraph)).resolves.toBe(true)
    })

    it('does not count a descendant or a sibling as an ancestor', async () => {
        const getGraph = graphsFrom({ [cup]: [box], [ball]: [box], [box]: [room] })
        await expect(hasPresenceAncestor(box, cup, getGraph)).resolves.toBe(false)
        await expect(hasPresenceAncestor(ball, cup, getGraph)).resolves.toBe(false)
    })

    it('follows every parent of a multi-hosted host, not just the first', async () => {
        const getGraph = graphsFrom({ [ball]: [box, shelf], [shelf]: [table], [box]: [room], [table]: [room] })
        await expect(hasPresenceAncestor(ball, table, getGraph)).resolves.toBe(true)
    })

    it('fetches a shared ancestor once, however many paths reach it', async () => {
        const getGraph = graphsFrom({ [ball]: [box, shelf], [box]: [table], [shelf]: [table], [table]: [room] })
        await expect(hasPresenceAncestor(ball, cup, getGraph)).resolves.toBe(false)
        expect(getGraph.mock.calls.map(([hostId]) => hostId).sort()).toEqual([ball, box, room, shelf, table].sort())
    })

    it('terminates on a cycle already in storage', async () => {
        const getGraph = graphsFrom({ [box]: [cup], [cup]: [box] })
        await expect(hasPresenceAncestor(box, room, getGraph)).resolves.toBe(false)
    })
})
