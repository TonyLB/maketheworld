import {
    collectObjectIdsFromPositionGraph,
    collectObjectIdsFromRoomPositionGraphs,
} from './collectObjectIdsFromRoomPositionGraphs'

describe('collectObjectIdsFromRoomPositionGraphs', () => {
    const objectA = 'OBJECT#a' as const
    const objectB = 'OBJECT#b' as const
    const roomOne = 'ROOM#One' as const
    const roomTwo = 'ROOM#Two' as const

    it('collects Object nodes from a single graph', () => {
        expect(collectObjectIdsFromPositionGraph({
            nodes: [
                { tag: 'Character', universalKey: 'CHARACTER#X' },
                { tag: 'Object', universalKey: objectA },
            ],
        })).toEqual([objectA])
    })

    it('dedupes across room graphs', () => {
        expect(collectObjectIdsFromRoomPositionGraphs({
            [roomOne]: {
                nodes: [{ tag: 'Object', universalKey: objectA }],
            },
            [roomTwo]: {
                nodes: [
                    { tag: 'Object', universalKey: objectA },
                    { tag: 'Object', universalKey: objectB },
                ],
            },
        })).toEqual([objectA, objectB])
    })

    it('returns empty when graphs have no Object nodes', () => {
        expect(collectObjectIdsFromRoomPositionGraphs({
            [roomOne]: { nodes: [{ tag: 'Character', universalKey: 'CHARACTER#X' }] },
        })).toEqual([])
        expect(collectObjectIdsFromPositionGraph(undefined)).toEqual([])
    })
})
