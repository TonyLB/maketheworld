import shortestCommonSuperSequence, { ShortestCommonSupersetDirection } from './shortestCommonSupersequence'

describe('shortestCommonSupersequence', () => {
    it('should return unchanged list when merged with empty list', () => {
        expect(shortestCommonSuperSequence([], [3, 1, 4, 1, 5, 9])).toEqual([3, 1, 4, 1, 5, 9])
        expect(shortestCommonSuperSequence([3, 1, 4, 1, 5, 9], [])).toEqual([3, 1, 4, 1, 5, 9])
    })

    it('should return merger of two lists in common order', () => {
        expect(shortestCommonSuperSequence([1, 2, 3, 4, 5], [4, 3, 2])).toEqual([1, 2, 3, 4, 5, 3, 2])
    })
    it('should handle repeated entries in the same list', () => {
        expect(shortestCommonSuperSequence([1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5], [4, 4, 3, 2])).toEqual([1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 3, 2])
    })
    it('should swap direction back and forth between lists as needed', () => {
        expect(shortestCommonSuperSequence([1, 2, 3, 4, 5], [3, 2, 1, 4, 3, 2])).toEqual([1, 2, 3, 2, 1, 4, 5, 3, 2])
    })

    it('should show source of items when option specified', () => {
        expect(shortestCommonSuperSequence([1, 2, 3, 4, 5], [4, 3, 2], { showSource: true })).toEqual([
            { value: 1, source: ShortestCommonSupersetDirection.A },
            { value: 2, source: ShortestCommonSupersetDirection.A },
            { value: 3, source: ShortestCommonSupersetDirection.A },
            { value: 4, source: ShortestCommonSupersetDirection.both },
            { value: 5, source: ShortestCommonSupersetDirection.A },
            { value: 3, source: ShortestCommonSupersetDirection.B },
            { value: 2, source: ShortestCommonSupersetDirection.B }
        ])
    })
})