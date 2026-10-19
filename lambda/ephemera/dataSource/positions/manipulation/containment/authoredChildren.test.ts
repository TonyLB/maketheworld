import { addedNodesOf, authoredChildIdsFromNodeLists } from './authoredChildren'

describe('addedNodesOf', () => {
    it('drops removed (ref < 0) and presence nodes, and treats a missing ref as added', () => {
        expect(addedNodesOf([
            { universalKey: 'FEATURE#a', ref: 1 },
            { universalKey: 'FEATURE#b', ref: -1 },
            { universalKey: 'FEATURE#c' },
            { universalKey: 'PRESENCE#d', isPresence: true },
        ])).toEqual([{ universalKey: 'FEATURE#a', ref: 1 }, { universalKey: 'FEATURE#c' }])
    })
})

describe('authoredChildIdsFromNodeLists', () => {
    it('unions Room and Feature children across assets, sorted, without Objects or duplicates', () => {
        expect(authoredChildIdsFromNodeLists([
            [{ universalKey: 'ROOM#b', ref: 1 }, { universalKey: 'OBJECT#cup', ref: 1 }],
            [{ universalKey: 'FEATURE#a', ref: 1 }, { universalKey: 'ROOM#b', ref: 1 }],
        ])).toEqual(['FEATURE#a', 'ROOM#b'])
    })

    it('does not count a child one asset adds and another removes as removed from the union', () => {
        expect(authoredChildIdsFromNodeLists([
            [{ universalKey: 'FEATURE#a', ref: 1 }],
            [{ universalKey: 'FEATURE#a', ref: -1 }],
        ])).toEqual(['FEATURE#a'])
    })
})
