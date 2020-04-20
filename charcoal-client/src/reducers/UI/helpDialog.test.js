import {
    ACTIVATE_HELP_DIALOG,
    CLOSE_HELP_DIALOG,
} from '../../actions/UI/helpDialog'
import reducer from './helpDialog'

describe('HelpDialog reducer', () => {
    it('should generate an empty state', () => {
        expect(reducer()).toBe(false)
    })

    it('should correctly activate', () => {
        expect(reducer(false, { type: ACTIVATE_HELP_DIALOG })).toBe(true)
    })

    it('should correctly close', () => {
        expect(reducer(true, { type: CLOSE_HELP_DIALOG })).toBe(false)
    })

})
