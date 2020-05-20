import {
    getMaps,
    getCurrentMap
} from './maps'

const testState = {
    maps: {
        Test: {
            PermanentId: 'Test',
            Rooms: {
                VORTEX: {
                    PermanentId: "VORTEX",
                    X: 1,
                    Y: 2
                }
            }
        }
    }
}

describe('maps selectors', () => {

    it('should extract maps', () => {
        expect(getMaps(testState)).toEqual(testState.maps)
    })

    it('should proxy correctly', () => {
        expect(getMaps(testState).NotPresent).toEqual({
            PermanentId: "NotPresent",
            Rooms: {}
        })
    })

    it('should correctly identify current context map', () => {
        expect(getCurrentMap({
            ...testState,
            connection: {
                characterId: 'ME'
            },
            charactersInPlay: {
                ME: {
                    RoomId: 'TestRoom'
                }
            },
            permanentHeaders: {
                Neighborhood: {
                    PermanentId: 'Neighborhood',
                    ContextMapId: 'Test'
                },
                TestRoom: {
                    PermanentId: 'TestRoom',
                    Ancestry: 'Neighborhood:TestRoom'
                }
            }
        })).toEqual(testState.maps.Test)
    })

    it('should correctly default to root when no other current context map', () => {
        expect(getCurrentMap({
            ...testState,
            connection: {
                characterId: 'ME'
            },
            charactersInPlay: {
                ME: {
                    RoomId: 'TestRoom'
                }
            },
            permanentHeaders: {
                Neighborhood: {
                    PermanentId: 'Neighborhood'
                },
                TestRoom: {
                    PermanentId: 'TestRoom',
                    Ancestry: 'Neighborhood:TestRoom'
                }
            }
        })).toEqual({ PermanentId: 'ROOT', Rooms: {} })
    })
})
