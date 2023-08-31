import { describe, it, expect } from '@jest/globals'

import { unique } from './lists'

describe('unique', () => {
    it('should return empty on no arguments', () => {
        expect(unique()).toEqual([])
    })

    it('should join and deduplicate lists', () => {
        expect(unique(
            ['A', 'D', 'F'],
            ['B', 'C', 'D'],
            ['D', 'E', 'F', 'G']
        )).toEqual(['A', 'D', 'F', 'B', 'C', 'E', 'G'])
    })
})