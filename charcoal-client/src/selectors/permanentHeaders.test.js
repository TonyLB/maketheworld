import {
    getPermanentHeaders,
    getRoomIdsInNeighborhood,
    treeify,
    getNeighborhoodOnlyTree,
    getNeighborhoodSubtree,
    getExternalTree
} from './permanentHeaders'

const testState = {
    permanentHeaders: {
        ABC: {
            permanentId: 'ABC',
            ancestry: 'ABC',
            type: 'NEIGHBORHOOD'
        },
        BCD: {
            permanentId: 'BCD',
            ancestry: 'ABC:BCD',
            type: 'ROOM'
        },
        CDE: {
            permanentId: 'CDE',
            ancestry: 'ABC:CDE',
            type: 'NEIGHBORHOOD'
        },
        DEF: {
            permanentId: 'DEF',
            ancestry: 'ABC:CDE:DEF',
            type: 'ROOM'
        },
        EFG: {
            permanentId: 'EFG',
            ancestry: 'ABC:CDE:EFG',
            type: 'ROOM'
        },
        FGH: {
            permanentId: 'FGH',
            ancestry: 'FGH',
            type: 'NEIGHBORHOOD'
        },
        GHI: {
            permanentId: 'GHI',
            ancestry: 'FGH:GHI',
            type: 'ROOM'
        }
    }
}

describe('permanentHeader selectors', () => {
    it('should extract permanentHeaders', () => {
        expect(getPermanentHeaders(testState)).toEqual(testState.permanentHeaders)
    })

    it('should correctly pull direct rooms from neighborhood', () => {
        expect(getRoomIdsInNeighborhood('FGH')(testState)).toEqual(['GHI'])
    })

    it('should correctly pull rooms from nested neighborhoods', () => {
        expect(getRoomIdsInNeighborhood('ABC')(testState)).toEqual(['BCD', 'DEF', 'EFG'])
    })

    it('should pull all rooms when no neighborhood provided', () => {
        expect(getRoomIdsInNeighborhood()(testState)).toEqual(['BCD', 'DEF', 'EFG', 'GHI'])
    })

    it('should correctly return a tree', () => {
        expect(treeify(Object.values(testState.permanentHeaders))).toEqual({
            ABC: {
                permanentId: 'ABC',
                ancestry: 'ABC',
                type: 'NEIGHBORHOOD',
                children: {
                    BCD: {
                        permanentId: 'BCD',
                        ancestry: 'ABC:BCD',
                        type: 'ROOM'
                    },
                    CDE: {
                        permanentId: 'CDE',
                        ancestry: 'ABC:CDE',
                        type: 'NEIGHBORHOOD',
                        children: {
                            DEF: {
                                permanentId: 'DEF',
                                ancestry: 'ABC:CDE:DEF',
                                type: 'ROOM'
                            },
                            EFG: {
                                permanentId: 'EFG',
                                ancestry: 'ABC:CDE:EFG',
                                type: 'ROOM'
                            }
                        }
                    },
                }
            },
            FGH: {
                permanentId: 'FGH',
                ancestry: 'FGH',
                type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        permanentId: 'GHI',
                        ancestry: 'FGH:GHI',
                        type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should correctly return a neighborhood only tree', () => {
        expect(getNeighborhoodOnlyTree(testState)).toEqual({
            ABC: {
                permanentId: 'ABC',
                ancestry: 'ABC',
                type: 'NEIGHBORHOOD',
                children: {
                    CDE: {
                        permanentId: 'CDE',
                        ancestry: 'ABC:CDE',
                        type: 'NEIGHBORHOOD'
                    },
                }
            },
            FGH: {
                permanentId: 'FGH',
                ancestry: 'FGH',
                type: 'NEIGHBORHOOD'
            }
        })
    })

    it('should return tree except room on getNeighborhoodSubtree for root room', () => {
        expect(getNeighborhoodSubtree({ roomId: 'VORTEX', ancestry: 'VORTEX' })({ permanentHeaders: { ...testState.permanentHeaders, VORTEX: { permanentId: 'VORTEX', ancestry: 'VORTEX' } }})).toEqual({
            ABC: {
                permanentId: 'ABC',
                ancestry: 'ABC',
                type: 'NEIGHBORHOOD',
                children: {
                    BCD: {
                        permanentId: 'BCD',
                        ancestry: 'ABC:BCD',
                        type: 'ROOM'
                    },
                    CDE: {
                        permanentId: 'CDE',
                        ancestry: 'ABC:CDE',
                        type: 'NEIGHBORHOOD',
                        children: {
                            DEF: {
                                permanentId: 'DEF',
                                ancestry: 'ABC:CDE:DEF',
                                type: 'ROOM'
                            },
                            EFG: {
                                permanentId: 'EFG',
                                ancestry: 'ABC:CDE:EFG',
                                type: 'ROOM'
                            }
                        }
                    },
                }
            },
            FGH: {
                permanentId: 'FGH',
                ancestry: 'FGH',
                type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        permanentId: 'GHI',
                        ancestry: 'FGH:GHI',
                        type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should return subtree for getNeighborhoodSubtree', () => {
        expect(getNeighborhoodSubtree({ roomId: 'BCD', ancestry: 'ABC:BCD' })(testState)).toEqual({
            ABC: {
                permanentId: 'ABC',
                ancestry: 'ABC',
                type: 'NEIGHBORHOOD',
                children: {
                    CDE: {
                        permanentId: 'CDE',
                        ancestry: 'ABC:CDE',
                        type: 'NEIGHBORHOOD',
                        children: {
                            DEF: {
                                permanentId: 'DEF',
                                ancestry: 'ABC:CDE:DEF',
                                type: 'ROOM'
                            },
                            EFG: {
                                permanentId: 'EFG',
                                ancestry: 'ABC:CDE:EFG',
                                type: 'ROOM'
                            }
                        }
                    },
                }
            }
        })
    })

    it('should return nothing for getExternalTree on root room', () => {
        expect(getExternalTree({ roomId: 'VORTEX', ancestry: 'VORTEX' })(testState)).toEqual({})
    })

    it('should exclude toplevel subtree on getExternalTree', () => {
        expect(getExternalTree({ roomId: 'BCD', ancestry: 'ABC:BCD' })(testState)).toEqual({
            FGH: {
                permanentId: 'FGH',
                ancestry: 'FGH',
                type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        permanentId: 'GHI',
                        ancestry: 'FGH:GHI',
                        type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should exclude nested subtree on getExternalTree', () => {
        expect(getExternalTree({ roomId: 'DEF', ancestry: 'ABC:CDE:DEF' })(testState)).toEqual({
            ABC: {
                permanentId: 'ABC',
                ancestry: 'ABC',
                type: 'NEIGHBORHOOD',
                children: {
                    BCD: {
                        permanentId: 'BCD',
                        ancestry: 'ABC:BCD',
                        type: 'ROOM'
                    }
                }
            },
            FGH: {
                permanentId: 'FGH',
                ancestry: 'FGH',
                type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        permanentId: 'GHI',
                        ancestry: 'FGH:GHI',
                        type: 'ROOM'
                    }
                }
            }
        })
    })

})
