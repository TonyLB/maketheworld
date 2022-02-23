import { jest, describe, expect, it } from '@jest/globals'

import sortImportTree from './sortImportTree.js'

describe('sortImportTree', () => {
    it('should return an empty list for an empty tree', () => {
        expect(sortImportTree({})).toEqual([])
    })

    it('should sort dependencies', () => {
        expect(sortImportTree({
            Final: {
                Base: {},
                LayerThree: { LayerOne: { Base: {} } }
            },
            LayerOne: { Base: {} },
            LayerTwo: { Base: {} },
            Base: {}
        })).toEqual(['Base', 'LayerOne', 'LayerTwo', 'LayerThree', 'Final'])
    })
})