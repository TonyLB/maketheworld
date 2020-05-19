import {
    ACTIVATE_MAP_DIALOG,
    CLOSE_MAP_DIALOG,
    activateMapDialog,
    closeMapDialog
} from './mapDialog'

describe('MapDialog actions', () => {
    it('should package an activate request', () => {
        expect(activateMapDialog()).toEqual({
            type: ACTIVATE_MAP_DIALOG
        })
    })

    it('should package a close request', () => {
        expect(closeMapDialog()).toEqual({
            type: CLOSE_MAP_DIALOG
        })
    })
})
