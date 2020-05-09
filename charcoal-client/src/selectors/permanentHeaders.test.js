import {
    getPermanentHeaders,
    getRoomIdsInNeighborhood,
    treeify,
    getNeighborhoodOnlyTree,
    getNeighborhoodSubtree,
    getExternalTree,
    getNeighborhoodOnlyTreeExcludingSubTree
} from './permanentHeaders'

const testState = {
    permanentHeaders: {
        ABC: {
            PermanentId: 'ABC',
            Ancestry: 'ABC',
            Type: 'NEIGHBORHOOD'
        },
        BCD: {
            PermanentId: 'BCD',
            Ancestry: 'ABC:BCD',
            Type: 'ROOM'
        },
        CDE: {
            PermanentId: 'CDE',
            Ancestry: 'ABC:CDE',
            Type: 'NEIGHBORHOOD'
        },
        DEF: {
            PermanentId: 'DEF',
            Ancestry: 'ABC:CDE:DEF',
            Type: 'ROOM'
        },
        EFG: {
            PermanentId: 'EFG',
            Ancestry: 'ABC:CDE:EFG',
            Type: 'ROOM'
        },
        FGH: {
            PermanentId: 'FGH',
            Ancestry: 'FGH',
            Type: 'NEIGHBORHOOD'
        },
        GHI: {
            PermanentId: 'GHI',
            Ancestry: 'FGH:GHI',
            Type: 'ROOM'
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
                PermanentId: 'ABC',
                Ancestry: 'ABC',
                Type: 'NEIGHBORHOOD',
                children: {
                    BCD: {
                        PermanentId: 'BCD',
                        Ancestry: 'ABC:BCD',
                        Type: 'ROOM'
                    },
                    CDE: {
                        PermanentId: 'CDE',
                        Ancestry: 'ABC:CDE',
                        Type: 'NEIGHBORHOOD',
                        children: {
                            DEF: {
                                PermanentId: 'DEF',
                                Ancestry: 'ABC:CDE:DEF',
                                Type: 'ROOM'
                            },
                            EFG: {
                                PermanentId: 'EFG',
                                Ancestry: 'ABC:CDE:EFG',
                                Type: 'ROOM'
                            }
                        }
                    },
                }
            },
            FGH: {
                PermanentId: 'FGH',
                Ancestry: 'FGH',
                Type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        PermanentId: 'GHI',
                        Ancestry: 'FGH:GHI',
                        Type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should exclude a ghost sub-branch', () => {
        expect(treeify([
            { PermanentId: 'ABC' },
            { PermanentId: 'BCD' },
            { PermanentId: 'CDE', Ancestry: 'ABC:BCD:CDE' },
        ])).toEqual({
            ABC: {
                PermanentId: 'ABC'
            },
            BCD: {
                PermanentId: 'BCD'
            }
        })
    })

    it('should exclude a ghost root branch', () => {
        expect(treeify([
            { PermanentId: 'ABC' },
            { PermanentId: 'BCD', Ancestry: 'ABC:BCD' },
            { PermanentId: 'CDE', Ancestry: 'BCD:CDE' },
        ])).toEqual({
            ABC: {
                PermanentId: 'ABC',
                children: {
                    BCD: {
                        Ancestry: 'ABC:BCD',
                        PermanentId: 'BCD'
                    }
                }
            }
        })
    })

    it('should correctly return a neighborhood only tree', () => {
        expect(getNeighborhoodOnlyTree(testState)).toEqual({
            ABC: {
                PermanentId: 'ABC',
                Ancestry: 'ABC',
                Type: 'NEIGHBORHOOD',
                children: {
                    CDE: {
                        PermanentId: 'CDE',
                        Ancestry: 'ABC:CDE',
                        Type: 'NEIGHBORHOOD'
                    },
                }
            },
            FGH: {
                PermanentId: 'FGH',
                Ancestry: 'FGH',
                Type: 'NEIGHBORHOOD'
            }
        })
    })

    it('should return tree except room on getNeighborhoodSubtree for root room', () => {
        expect(getNeighborhoodSubtree({ roomId: 'VORTEX', ancestry: 'VORTEX' })({ permanentHeaders: { ...testState.permanentHeaders, VORTEX: { PermanentId: 'VORTEX', Ancestry: 'VORTEX' } }})).toEqual({
            ABC: {
                PermanentId: 'ABC',
                Ancestry: 'ABC',
                Type: 'NEIGHBORHOOD',
                children: {
                    BCD: {
                        PermanentId: 'BCD',
                        Ancestry: 'ABC:BCD',
                        Type: 'ROOM'
                    },
                    CDE: {
                        PermanentId: 'CDE',
                        Ancestry: 'ABC:CDE',
                        Type: 'NEIGHBORHOOD',
                        children: {
                            DEF: {
                                PermanentId: 'DEF',
                                Ancestry: 'ABC:CDE:DEF',
                                Type: 'ROOM'
                            },
                            EFG: {
                                PermanentId: 'EFG',
                                Ancestry: 'ABC:CDE:EFG',
                                Type: 'ROOM'
                            }
                        }
                    },
                }
            },
            FGH: {
                PermanentId: 'FGH',
                Ancestry: 'FGH',
                Type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        PermanentId: 'GHI',
                        Ancestry: 'FGH:GHI',
                        Type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should return subtree for getNeighborhoodSubtree', () => {
        expect(getNeighborhoodSubtree({ roomId: 'BCD', ancestry: 'ABC:BCD' })(testState)).toEqual({
            ABC: {
                PermanentId: 'ABC',
                Ancestry: 'ABC',
                Type: 'NEIGHBORHOOD',
                children: {
                    CDE: {
                        PermanentId: 'CDE',
                        Ancestry: 'ABC:CDE',
                        Type: 'NEIGHBORHOOD',
                        children: {
                            DEF: {
                                PermanentId: 'DEF',
                                Ancestry: 'ABC:CDE:DEF',
                                Type: 'ROOM'
                            },
                            EFG: {
                                PermanentId: 'EFG',
                                Ancestry: 'ABC:CDE:EFG',
                                Type: 'ROOM'
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
                PermanentId: 'FGH',
                Ancestry: 'FGH',
                Type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        PermanentId: 'GHI',
                        Ancestry: 'FGH:GHI',
                        Type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should exclude nested subtree on getExternalTree', () => {
        expect(getExternalTree({ roomId: 'DEF', ancestry: 'ABC:CDE:DEF' })(testState)).toEqual({
            ABC: {
                PermanentId: 'ABC',
                Ancestry: 'ABC',
                Type: 'NEIGHBORHOOD',
                children: {
                    BCD: {
                        PermanentId: 'BCD',
                        Ancestry: 'ABC:BCD',
                        Type: 'ROOM'
                    }
                }
            },
            FGH: {
                PermanentId: 'FGH',
                Ancestry: 'FGH',
                Type: 'NEIGHBORHOOD',
                children: {
                    GHI: {
                        PermanentId: 'GHI',
                        Ancestry: 'FGH:GHI',
                        Type: 'ROOM'
                    }
                }
            }
        })
    })

    it('should exclude nested subtree on getNeighborhoodOnlyTreeExcludingSubTree', () => {
        expect(getNeighborhoodOnlyTreeExcludingSubTree('ABC:CDE')(testState)).toEqual({
            ABC: {
                PermanentId: 'ABC',
                Ancestry: 'ABC',
                Type: 'NEIGHBORHOOD'
            },
            FGH: {
                PermanentId: 'FGH',
                Ancestry: 'FGH',
                Type: 'NEIGHBORHOOD'
            }
        })
    })

})
