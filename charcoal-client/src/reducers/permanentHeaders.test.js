import { NEIGHBORHOOD_UPDATE, NEIGHBORHOOD_MERGE } from '../actions/neighborhoods.js'
import reducer from './permanentHeaders'

const testState = {
    RootRoom: {
        PermanentId: 'RootRoom',
        Ancestry: 'RootRoom',
        Type: 'ROOM',
        Exits: [{
            RoomId: 'BlueRoom',
            Name: 'blue'
        }],
        Entries: [{
            RoomId: 'BlueRoom',
            Name: 'root'
        }]
    },
    AlternateRoom: {
        PermanentId: 'AlternateRoom',
        Ancestry: 'AlternateRoom',
        Type: 'ROOM',
        Exits: [],
        Entries: []
    },
    Alpha: {
        PermanentId: 'Alpha',
        Ancestry: 'Alpha',
        Name: 'Alpha',
        Type: 'NEIGHBORHOOD',
        Topology: 'Dead-End'
    },
    BlueRoom: {
        PermanentId: 'BlueRoom',
        ParentId: 'Alpha',
        Ancestry: 'Alpha:BlueRoom',
        Type: 'ROOM',
        Exits: [{
            RoomId: 'RootRoom',
            Name: 'root'
        },
        {
            RoomId: 'GreenRoom',
            Name: 'green'
        }],
        Entries: [{
            RoomId: 'RootRoom',
            Name: 'blue'
        },
        {
            RoomId: 'GreenRoom',
            Name: 'blue'
        }]
    },
    Beta: {
        PermanentId: 'Beta',
        ParentId: 'Alpha',
        Ancestry: 'Alpha:Beta',
        Topology: 'Connected',
        Type: 'NEIGHBORHOOD'
    },
    GreenRoom: {
        PermanentId: 'GreenRoom',
        ParentId: 'Beta',
        Ancestry: 'Alpha:Beta:GreenRoom',
        Type: 'ROOM',
        Exits: [{
            RoomId: 'BlueRoom',
            Name: 'blue'
        }],
        Entries: [{
            RoomId: 'BlueRoom',
            Name: 'green'
        }]
    },
}

describe('permanentHeaders reducer', () => {

    it('should return empty map on initialization', () => {
        expect(reducer()).toEqual({})
    })

    it('should return unchanged map on empty array', () => {
        expect(reducer(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: []
        })).toEqual(testState)
    })

    it('should correctly add a root-level room', () => {
        expect(reducer(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Room: {
                    PermanentId: 'PlumRoom',
                    Type: 'ROOM'
                }
            }]
        })).toEqual({
            ...testState,
            PlumRoom: {
                PermanentId: 'PlumRoom',
                Ancestry: 'PlumRoom',
                Type: 'ROOM',
                Exits: [],
                Entries: []
            }
        })
    })

    it('should correctly add a neighborhood room', () => {
        expect(reducer(testState, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Room: {
                    PermanentId: 'PlumRoom',
                    ParentId: 'Alpha'
                }
            }]
        })).toEqual({
            ...testState,
            PlumRoom: {
                PermanentId: 'PlumRoom',
                ParentId: 'Alpha',
                Ancestry: 'Alpha:PlumRoom',
                Type: 'ROOM',
                Exits: [],
                Entries: []
            }
        })
    })

    it('should correctly add a neighborhood room before the neighborhood is fetched', () => {
        expect(reducer({}, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Room: {
                    PermanentId: 'PlumRoom',
                    ParentId: 'Alpha'
                }
            }]
        })).toEqual({
            PlumRoom: {
                PermanentId: 'PlumRoom',
                ParentId: 'Alpha',
                Ancestry: 'PlumRoom',
                Type: 'ROOM',
                Exits: [],
                Entries: []
            }
        })
    })

    it('should correctly add a room with exits to rooms not fetched yet', () => {
        expect(reducer({}, {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Room: {
                    PermanentId: 'PlumRoom',
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    }],
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'plum'
                    }]
                }
            }]
        })).toEqual({
            PlumRoom: {
                PermanentId: 'PlumRoom',
                Ancestry: 'PlumRoom',
                Type: 'ROOM',
                Exits: [],
                Entries: []
            }
        })
    })

    it('should correctly add an exit', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Beta',
                        Ancestry: 'Alpha:Beta:GreenRoom',
                        Exits: [{
                            RoomId: 'BlueRoom',
                            Name: 'blue'
                        },
                        {
                            RoomId: 'AlternateRoom',
                            Name: 'alternate'
                        }],
                        Entries: [{
                            RoomId: 'BlueRoom',
                            Name: 'green'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:GreenRoom',
                    Type: 'ROOM',
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    },
                    {
                        RoomId: 'AlternateRoom',
                        Name: 'alternate'
                    }],
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green'
                    }]
                },
                AlternateRoom: {
                    PermanentId: 'AlternateRoom',
                    Ancestry: 'AlternateRoom',
                    Type: 'ROOM',
                    Exits: [],
                    Entries: [{
                        RoomId: 'GreenRoom',
                        Name: 'alternate'
                    }]
                }
        })
    })

    it('should correctly add an entry', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Beta',
                        Ancestry: 'Alpha:Beta:GreenRoom',
                        Exits: [{
                            RoomId: 'BlueRoom',
                            Name: 'blue'
                        }],
                        Entries: [{
                            RoomId: 'BlueRoom',
                            Name: 'green'
                        },
                        {
                            RoomId: 'AlternateRoom',
                            Name: 'green'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:GreenRoom',
                    Type: 'ROOM',
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    }],
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green'
                    },
                    {
                        RoomId: 'AlternateRoom',
                        Name: 'green'
                    }]
                },
                AlternateRoom: {
                    PermanentId: 'AlternateRoom',
                    Ancestry: 'AlternateRoom',
                    Type: 'ROOM',
                    Entries: [],
                    Exits: [{
                        RoomId: 'GreenRoom',
                        Name: 'green'
                    }]
                }
        })
    })

    it('should correctly remove an exit', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Beta',
                        Ancestry: 'Alpha:Beta:GreenRoom',
                        Exits: [],
                        Entries: [{
                            RoomId: 'BlueRoom',
                            Name: 'green'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:GreenRoom',
                    Type: 'ROOM',
                    Exits: [],
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green'
                    }]
                },
                BlueRoom: {
                    PermanentId: 'BlueRoom',
                    ParentId: 'Alpha',
                    Ancestry: 'Alpha:BlueRoom',
                    Type: 'ROOM',
                    Exits: [{
                        RoomId: 'RootRoom',
                        Name: 'root'
                    },
                    {
                        RoomId: 'GreenRoom',
                        Name: 'green'
                    }],
                    Entries: [{
                        RoomId: 'RootRoom',
                        Name: 'blue'
                    }]
                }
            })
    })

    it('should correctly remove an entry', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Beta',
                        Ancestry: 'Alpha:Beta:GreenRoom',
                        Entries: [],
                        Exits: [{
                            RoomId: 'BlueRoom',
                            Name: 'blue'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:GreenRoom',
                    Type: 'ROOM',
                    Entries: [],
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    }]
                },
                BlueRoom: {
                    PermanentId: 'BlueRoom',
                    ParentId: 'Alpha',
                    Ancestry: 'Alpha:BlueRoom',
                    Type: 'ROOM',
                    Exits: [{
                        RoomId: 'RootRoom',
                        Name: 'root'
                    }],
                    Entries: [{
                        RoomId: 'RootRoom',
                        Name: 'blue'
                    },
                    {
                        RoomId: 'GreenRoom',
                        Name: 'blue'
                    }]
                }
            })
    })

    it('should correctly reroute a path', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Beta',
                        Ancestry: 'Alpha:Beta:GreenRoom',
                        Entries: [{
                            RoomId: 'AlternateRoom',
                            Name: 'green'
                        }],
                        Exits: [{
                            RoomId: 'AlternateRoom',
                            Name: 'alternate'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:GreenRoom',
                    Type: 'ROOM',
                    Entries: [{
                        RoomId: 'AlternateRoom',
                        Name: 'green'
                    }],
                    Exits: [{
                        RoomId: 'AlternateRoom',
                        Name: 'alternate'
                    }]
                },
                BlueRoom: {
                    PermanentId: 'BlueRoom',
                    ParentId: 'Alpha',
                    Ancestry: 'Alpha:BlueRoom',
                    Type: 'ROOM',
                    Exits: [{
                        RoomId: 'RootRoom',
                        Name: 'root'
                    }],
                    Entries: [{
                        RoomId: 'RootRoom',
                        Name: 'blue'
                    }]
                },
                AlternateRoom: {
                    PermanentId: 'AlternateRoom',
                    Ancestry: 'AlternateRoom',
                    Type: 'ROOM',
                    Entries: [{
                        RoomId: 'GreenRoom',
                        Name: 'alternate'
                    }],
                    Exits: [{
                        RoomId: 'GreenRoom',
                        Name: 'green'
                    }]
                }
            })
    })

    it('should correctly rename a path', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Beta',
                        Ancestry: 'Alpha:Beta:GreenRoom',
                        Entries: [{
                            RoomId: 'BlueRoom',
                            Name: 'green room'
                        }],
                        Exits: [{
                            RoomId: 'BlueRoom',
                            Name: 'blue room'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:GreenRoom',
                    Type: 'ROOM',
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green room'
                    }],
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue room'
                    }]
                },
                BlueRoom: {
                    PermanentId: 'BlueRoom',
                    ParentId: 'Alpha',
                    Ancestry: 'Alpha:BlueRoom',
                    Type: 'ROOM',
                    Exits: [{
                        RoomId: 'RootRoom',
                        Name: 'root'
                    },
                    {
                        RoomId: 'GreenRoom',
                        Name: 'green room'
                    }],
                    Entries: [{
                        RoomId: 'RootRoom',
                        Name: 'blue'
                    },
                    {
                        RoomId: 'GreenRoom',
                        Name: 'blue room'
                    }]
                }
            })
    })

    it('should correctly reparent a room', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Room: {
                        PermanentId: 'GreenRoom',
                        ParentId: 'Alpha',
                        Entries: [{
                            RoomId: 'BlueRoom',
                            Name: 'green'
                        }],
                        Exits: [{
                            RoomId: 'BlueRoom',
                            Name: 'blue'
                        }]
                    }
                }]
            })).toEqual({
                ...testState,
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Alpha',
                    Ancestry: 'Alpha:GreenRoom',
                    Type: 'ROOM',
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green'
                    }],
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    }]
                }
            })
    })

    it('should correctly reparent a neighborhood to root', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Neighborhood: {
                        PermanentId: 'Beta',
                        ParentId: '',
                        Name: 'Beta',
                        Topology: 'Connected'
                    }
                }]
            })).toEqual({
                ...testState,
                Beta: {
                    PermanentId: 'Beta',
                    ParentId: '',
                    Ancestry: 'Beta',
                    Type: 'NEIGHBORHOOD',
                    Name: 'Beta',
                    Topology: 'Connected'
                },
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Beta:GreenRoom',
                    Type: 'ROOM',
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green'
                    }],
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    }]
                }
            })
    })

    it('should correctly add a neighborhood at root', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Neighborhood: {
                        PermanentId: 'Gamma',
                        Name: 'Gamma',
                        Topology: 'Connected'
                    }
                }]
            })).toEqual({
                ...testState,
                Gamma: {
                    PermanentId: 'Gamma',
                    Ancestry: 'Gamma',
                    Name: 'Gamma',
                    Type: 'NEIGHBORHOOD',
                    Topology: 'Connected'
                }
            })
    })

    it('should correctly add a sub-neighborhood', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Neighborhood: {
                        PermanentId: 'Gamma',
                        Name: 'Gamma',
                        ParentId: 'Beta',
                        Topology: 'Connected'
                    }
                }]
            })).toEqual({
                ...testState,
                Gamma: {
                    PermanentId: 'Gamma',
                    ParentId: 'Beta',
                    Ancestry: 'Alpha:Beta:Gamma',
                    Name: 'Gamma',
                    Type: 'NEIGHBORHOOD',
                    Topology: 'Connected'
                }
            })
    })

    it('should correctly reparent a neighborhood to another neighborhood', () => {
        expect(reducer(testState, {
                type: NEIGHBORHOOD_UPDATE,
                data: [{
                    Neighborhood: {
                        PermanentId: 'Gamma',
                        Name: 'Gamma',
                        Topology: 'Connected'
                    }
                },
                {
                    Neighborhood: {
                        PermanentId: 'Beta',
                        ParentId: 'Gamma',
                        Name: 'Beta',
                        Topology: 'Connected'
                    }
                }]
            })).toEqual({
                ...testState,
                Gamma: {
                    PermanentId: 'Gamma',
                    Ancestry: 'Gamma',
                    Name: 'Gamma',
                    Type: 'NEIGHBORHOOD',
                    Topology: 'Connected'
                },
                Beta: {
                    PermanentId: 'Beta',
                    ParentId: 'Gamma',
                    Ancestry: 'Gamma:Beta',
                    Type: 'NEIGHBORHOOD',
                    Name: 'Beta',
                    Topology: 'Connected'
                },
                GreenRoom: {
                    PermanentId: 'GreenRoom',
                    ParentId: 'Beta',
                    Ancestry: 'Gamma:Beta:GreenRoom',
                    Type: 'ROOM',
                    Entries: [{
                        RoomId: 'BlueRoom',
                        Name: 'green'
                    }],
                    Exits: [{
                        RoomId: 'BlueRoom',
                        Name: 'blue'
                    }]
                }
            })
    })

    it('should correctly establish ancestry when a gap is filled in', () => {
        expect(reducer({
            A: {
                PermanentId: 'A',
                Ancestry: 'A',
                Type: 'NEIGHBORHOOD'
            },
            C: {
                PermanentId: 'C',
                ParentId: 'B',
                Ancestry: 'C',
                Type: 'NEIGHBORHOOD'
            },
            D: {
                PermanentId: 'D',
                ParentId: 'C',
                Ancestry: 'C:D',
                Type: 'ROOM'
            }
        },
        {
            type: NEIGHBORHOOD_UPDATE,
            data: [{
                Neighborhood: {
                    PermanentId: 'B',
                    ParentId: 'A'
                }
            }]
        })).toEqual({
            A: {
                PermanentId: 'A',
                Ancestry: 'A',
                Type: 'NEIGHBORHOOD'
            },
            B: {
                PermanentId: 'B',
                ParentId: 'A',
                Ancestry: 'A:B',
                Type: 'NEIGHBORHOOD'
            },
            C: {
                PermanentId: 'C',
                ParentId: 'B',
                Ancestry: 'A:B:C',
                Type: 'NEIGHBORHOOD'
            },
            D: {
                PermanentId: 'D',
                ParentId: 'C',
                Ancestry: 'A:B:C:D',
                Type: 'ROOM'
            }
        })
    })

})
