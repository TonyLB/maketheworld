import { diffSignedStringSets, SignedStringSet } from './utils'

describe('diffSignedStringSets', () => {
    it('should return correct diff when there are additions and removals', () => {
        const base: SignedStringSet = {
            add: ['a', 'b', 'c'],
            remove: ['x', 'y', 'z']
        }
        const incoming: SignedStringSet = {
            add: ['b', 'd'],
            remove: ['y', 'w']
        }
        const expected: SignedStringSet = {
            add: ['x', 'z', 'd'],
            remove: ['a', 'c', 'w']
        }
        expect(diffSignedStringSets(base, incoming)).toEqual(expected)
    })

    it('should return correct diff when there are no changes', () => {
        const base: SignedStringSet = {
            add: ['a', 'b', 'c'],
            remove: ['x', 'y', 'z']
        }
        const incoming: SignedStringSet = {
            add: ['a', 'b', 'c'],
            remove: ['x', 'y', 'z']
        }
        const expected: SignedStringSet = {
            add: [],
            remove: []
        }
        expect(diffSignedStringSets(base, incoming)).toEqual(expected)
    })

    it('should return correct diff when all items are new', () => {
        const base: SignedStringSet = {
            add: [],
            remove: []
        }
        const incoming: SignedStringSet = {
            add: ['a', 'b', 'c'],
            remove: ['x', 'y', 'z']
        }
        const expected: SignedStringSet = {
            add: ['a', 'b', 'c'],
            remove: ['x', 'y', 'z']
        }
        expect(diffSignedStringSets(base, incoming)).toEqual(expected)
    })

    it('should return correct diff when all items are removed', () => {
        const base: SignedStringSet = {
            add: ['a', 'b', 'c'],
            remove: ['x', 'y', 'z']
        }
        const incoming: SignedStringSet = {
            add: [],
            remove: []
        }
        const expected: SignedStringSet = {
            add: ['x', 'y', 'z'],
            remove: ['a', 'b', 'c']
        }
        expect(diffSignedStringSets(base, incoming)).toEqual(expected)
    })
})