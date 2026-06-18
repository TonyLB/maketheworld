import { buildObjectMovedFact } from './buildObjectMovedFact'

describe('buildObjectMovedFact', () => {
    it('returns undefined when diff is unchanged', () => {
        expect(buildObjectMovedFact({
            objectId: 'OBJECT#Skates',
            diff: { froms: [], to: 'ROOM#a', changed: false },
            beatAnchorTime: 1,
        })).toBeUndefined()
    })

    it('returns Object Moved payload when diff changed', () => {
        expect(buildObjectMovedFact({
            objectId: 'OBJECT#Skates',
            diff: { froms: ['ROOM#a'], to: 'ROOM#b', changed: true },
            beatAnchorTime: 1_700_000_000_000,
        })).toEqual({
            type: 'Object Moved',
            objectId: 'OBJECT#Skates',
            froms: ['ROOM#a'],
            to: 'ROOM#b',
            beatAnchorTime: 1_700_000_000_000,
        })
    })
})
