import { jest, describe, expect, it } from '@jest/globals'

import sortImportTree from './sortImportTree.js'

describe('sortImportTree', () => {
    it('should return an empty list for an empty tree', () => {
        expect(sortImportTree({})).toEqual([])
    })

    it('should sort dependencies', () => {
        expect(sortImportTree({
            Final: {
                type: 'Asset',
                tree: {
                    Base: {
                        type: 'Asset',
                        tree: {}
                    },
                    LayerThree: {
                        type: 'Asset',
                        tree: {
                            LayerOne: {
                                type: 'Asset',
                                tree: {
                                    Base: {
                                        type: 'Asset',
                                        tree: {}
                                    }
                                }
                            }
                        }
                    }
                }
            },
            LayerOne: {
                type: 'Asset',
                tree: {
                    Base: {
                        type: 'Asset',
                        tree: {}
                    }
                }
            },
            LayerTwo: {
                type: 'Asset',
                tree: {
                    Base: {
                        type: 'Asset',
                        tree: {}
                    }
                }
            },
            Base: {
                type: 'Asset',
                tree: {}
            }
        })).toEqual(['Base', 'LayerOne', 'LayerTwo', 'LayerThree', 'Final'])
    })
})