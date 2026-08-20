import {
    collectObjectIdsFromLudicGraph,
    collectObjectIdsFromRoomLudicGraphs,
} from './collectObjectIdsFromRoomLudicGraphs'

describe('collectObjectIdsFromRoomLudicGraphs', () => {
    const objectA = 'OBJECT#a' as const
    const objectB = 'OBJECT#b' as const
    const roomOne = 'ROOM#One' as const
    const roomTwo = 'ROOM#Two' as const

    it('collects Object nodes from a single graph', () => {
        expect(collectObjectIdsFromLudicGraph({
            rootId: roomOne, ports: [],
            nodes: [
                { tag: 'Character', universalKey: 'CHARACTER#X' },
                { tag: 'Object', universalKey: objectA },
            ],
        })).toEqual([objectA])
    })

    it('dedupes across room graphs', () => {
        expect(collectObjectIdsFromRoomLudicGraphs({
            [roomOne]: {
                rootId: roomOne, ports: [],
                nodes: [{ tag: 'Object', universalKey: objectA }],
            },
            [roomTwo]: {
                rootId: roomTwo, ports: [],
                nodes: [
                    { tag: 'Object', universalKey: objectA },
                    { tag: 'Object', universalKey: objectB },
                ],
            },
        })).toEqual([objectA, objectB])
    })

    it('returns empty when graphs have no Object nodes', () => {
        expect(collectObjectIdsFromRoomLudicGraphs({
            [roomOne]: { rootId: roomOne, ports: [], nodes: [{ tag: 'Character', universalKey: 'CHARACTER#X' }] },
        })).toEqual([])
        expect(collectObjectIdsFromLudicGraph(undefined)).toEqual([])
    })
})
