import {
    ACTIVATE_DIRECT_MESSAGE_DIALOG,
    CLOSE_DIRECT_MESSAGE_DIALOG,
} from '../../actions/UI/directMessageDialog'
import reducer from './directMessageDialog'

describe('DirectMessageDialog reducer', () => {
    it('should generate an empty state', () => {
        expect(reducer()).toEqual('')
    })

    it('should do nothing on close for an empty dialog', () => {
        expect(reducer('', { type: CLOSE_DIRECT_MESSAGE_DIALOG })).toEqual('')
    })

    it('should do nothing on a no-op', () => {
        expect(reducer('Test', { type: 'NO-OP' })).toEqual('Test')
    })

    it('should empty on close', () => {
        expect(reducer('Test', { type: CLOSE_DIRECT_MESSAGE_DIALOG })).toEqual('')
    })

    it('should populate on activeDirectMessage', () => {
        expect(reducer('', { type: ACTIVATE_DIRECT_MESSAGE_DIALOG, ToCharacterId: 'Test' })).toEqual('Test')
    })

})
