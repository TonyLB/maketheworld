import {
    ACTIVATE_EDIT_MAP_DIALOG,
    CLOSE_EDIT_MAP_DIALOG,
} from '../../actions/UI/mapDialog'
import reducer from './editMapDialog'

const testMap = {
    PermanentId: 'Test',
    Rooms: {}
}

describe('EditMapDialog reducer', () => {
    it('should generate an empty state', () => {
        expect(reducer()).toEqual({
            open: false,
            map: null
        })
    })

    it('should correctly activate', () => {
        expect(reducer(false, {
            type: ACTIVATE_EDIT_MAP_DIALOG,
            map: testMap
        })).toEqual({
            open: true,
            map: testMap
        })
    })

    it('should correctly close', () => {
        expect(reducer({ open: true, map: testMap }, { type: CLOSE_EDIT_MAP_DIALOG })).toEqual({
            open: false,
            map: testMap
        })
    })

})
