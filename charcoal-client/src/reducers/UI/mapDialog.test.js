import {
    ACTIVATE_MAP_DIALOG,
    CLOSE_MAP_DIALOG,
} from '../../actions/UI/mapDialog'
import reducer from './mapDialog'

describe('MapDialog reducer', () => {
    it('should generate an empty state', () => {
        expect(reducer()).toBe(false)
    })

    it('should correctly activate', () => {
        expect(reducer(false, { type: ACTIVATE_MAP_DIALOG })).toBe(true)
    })

    it('should correctly close', () => {
        expect(reducer(true, { type: CLOSE_MAP_DIALOG })).toBe(false)
    })

})
