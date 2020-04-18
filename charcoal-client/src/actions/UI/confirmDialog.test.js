import {
    ACTIVATE_CONFIRM_DIALOG,
    CLOSE_CONFIRM_DIALOG,
    activateConfirmDialog,
    closeConfirmDialog
} from './confirmDialog'

describe('ConfirmDialog actions', () => {
    it('should package an empty activate request', () => {
        expect(activateConfirmDialog()).toEqual({
            type: ACTIVATE_CONFIRM_DIALOG,
            title: 'Are you sure?',
            content: null,
            resolveButtonTitle: 'OK',
            resolve: expect.any(Function)
        })
    })

    it('should package a populated activate request', () => {
        expect(activateConfirmDialog({
            title: "Have you thought this through?",
            content: "It could have unforeseen consequences...",
            resolveButtonTitle: 'DO IT!'
        })).toEqual({
            type: ACTIVATE_CONFIRM_DIALOG,
            title: 'Have you thought this through?',
            content: "It could have unforeseen consequences...",
            resolveButtonTitle: 'DO IT!',
            resolve: expect.any(Function)
        })
    })

    it('should package a close request', () => {
        expect(closeConfirmDialog()).toEqual({
            type: CLOSE_CONFIRM_DIALOG
        })
    })
})
