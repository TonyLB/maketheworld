import maps from './maps.js'
import { MAPS_UPDATE } from '../actions/maps'

const testState = {
    Test: {
        MapId: 'Test',
        Name: 'Test Map',
        Rooms: {}
    }
}

describe('maps reducer', () => {
    it('should return empty map by default', () => {
        expect(maps()).toEqual({})
    })

    it('should return unchanged map on empty array', () => {
        expect(maps(testState, {
            type: MAPS_UPDATE,
            data: []
        })).toEqual(testState)
    })

    it('should return unchanged map on other action type', () => {
        expect(maps(testState, {
            type: 'NO-OP',
            data: []
        })).toEqual(testState)
    })

    it('should update map on new passed data', () => {
        expect(maps(testState, {
            type: MAPS_UPDATE,
            data: [{
                MapId: 'Test',
                Name: 'New Test Name',
                Rooms: [{
                    PermanentId: 'VORTEX',
                    X: 100,
                    Y: 100
                }]
            }]
        })).toEqual({
            Test: {
                MapId: 'Test',
                Name: 'New Test Name',
                Rooms: {
                    VORTEX: {
                        PermanentId: 'VORTEX',
                        X: 100,
                        Y: 100
                    }
                }
            }
        })
    })

    it('should update map on added data', () => {
        expect(maps(testState, {
            type: MAPS_UPDATE,
            data: [{
                MapId: 'TestTwo',
                Name: 'New Test Name',
                Rooms: [{
                    PermanentId: 'VORTEX',
                    X: 100,
                    Y: 100
                }]
            }]
        })).toEqual({
            Test: {
                MapId: 'Test',
                Name: 'Test Map',
                Rooms: {}
            },
            TestTwo: {
                MapId: 'TestTwo',
                Name: 'New Test Name',
                Rooms: {
                    VORTEX: {
                        PermanentId: 'VORTEX',
                        X: 100,
                        Y: 100
                    }
                }
            }
        })
    })

})
