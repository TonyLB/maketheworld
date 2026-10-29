import { StandardLudicRelationalEdge } from './ludicEdge'
import { isStandardLudicRelationalEdgeData } from './dataTypes/ludicEdge'

describe('StandardLudicRelationalEdge edge terminals', () => {
    const data = { kind: 'Justifies' as const, from: { edgeId: 'support1' }, to: { edgeId: 'secured1' }, edgeId: 'justify1' }

    it('accepts a Justifies edge whose terminals are edge ids', () => {
        expect(isStandardLudicRelationalEdgeData(data)).toBe(true)
        expect(isStandardLudicRelationalEdgeData({ ...data, from: { edgeId: '' } })).toBe(false)
    })

    it('passes edge terminals through toJSON, clone, toFormat and lookup unchanged', () => {
        const edge = new StandardLudicRelationalEdge(data)
        expect(edge.toJSON()).toMatchObject({ kind: 'Justifies', from: { edgeId: 'support1' }, to: { edgeId: 'secured1' } })
        expect(edge.clone().toJSON()).toEqual(edge.toJSON())
        expect(edge.toFormat('key' as any).toJSON()).toEqual(edge.toJSON())
        expect(edge.lookup({ keyMapping: {}, universalKeyMapping: {} } as any).toJSON()).toEqual(edge.toJSON())
    })

    it('tells edge terminals apart by id', () => {
        const edge = new StandardLudicRelationalEdge(data)
        expect(edge.sameKey(new StandardLudicRelationalEdge(data))).toBe(true)
        expect(edge.sameKey(new StandardLudicRelationalEdge({ ...data, to: { edgeId: 'other' } }))).toBe(false)
    })
})
