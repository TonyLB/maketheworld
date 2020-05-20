import {
    getMaps
} from './maps'

const testState = {
    maps: {
        Test: {
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

})
