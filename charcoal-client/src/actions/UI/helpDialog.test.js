import {
    ACTIVATE_HELP_DIALOG,
    CLOSE_HELP_DIALOG,
    activateHelpDialog,
    closeHelpDialog
} from './helpDialog'

describe('HelpDialog actions', () => {
    it('should package an activate request', () => {
        expect(activateHelpDialog()).toEqual({
            type: ACTIVATE_HELP_DIALOG
        })
    })

    it('should package a close request', () => {
        expect(closeHelpDialog()).toEqual({
            type: CLOSE_HELP_DIALOG
        })
    })
})
