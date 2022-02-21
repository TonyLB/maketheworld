import { jest, describe, it, expect } from '@jest/globals'

import { recalculateComputes } from "./index.js"

describe('recalculateComputes', () => {
    it('should return unchanged on empty recalculated string', () => {
        expect(recalculateComputes(
            {
                power: {
                    value: 'on'
                }
            },
            {},
            []
        )).toEqual({
            state: {
                power: { value: 'on' },
            },
            recalculated: []
        })
    })
})