import {
    ACTIVATE_DIRECT_MESSAGE_DIALOG,
    CLOSE_DIRECT_MESSAGE_DIALOG,
    activateDirectMessageDialog,
    closeDirectMessageDialog
} from './directMessageDialog'

describe('DirectMessageDialog actions', () => {
    it('should package an empty activate request', () => {
        expect(activateDirectMessageDialog()).toEqual({
            type: ACTIVATE_DIRECT_MESSAGE_DIALOG,
            ToCharacterId: ''
        })
    })

    it('should package a populated activate request', () => {
        expect(activateDirectMessageDialog('123')).toEqual({
            type: ACTIVATE_DIRECT_MESSAGE_DIALOG,
            ToCharacterId: '123'
        })
    })

    it('should package a close request', () => {
        expect(closeDirectMessageDialog()).toEqual({
            type: CLOSE_DIRECT_MESSAGE_DIALOG
        })
    })
})
