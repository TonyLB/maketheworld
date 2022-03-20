import { jest, describe, it, expect } from '@jest/globals'

import { objectMap } from './objects.js'

describe('unique', () => {
    const testCallback = ({ assetId }) => assetId
    it('should return empty on empty object', () => {
        expect(objectMap({}, testCallback)).toEqual({})
    })

    it('should map values', () => {
        expect(objectMap({
            test: { assetId: 'ASSET#test' },
            base: { assetId: 'ASSET#BASE' }
        }, testCallback)).toEqual({
            test: 'ASSET#test',
            base: 'ASSET#BASE'
        })
    })
})