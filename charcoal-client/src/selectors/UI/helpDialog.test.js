import { getHelpDialogUI } from './helpDialog'

describe('HelpDialog selector', () => {
    it('should return false from an empty state', () => {
        expect(getHelpDialogUI()).toBe(false)
    })

    it('should return false from a closed state', () => {
        expect(getHelpDialogUI({ UI: { helpDialog: false }})).toBe(false)
    })

    it('should return true from an opened state', () => {
        expect(getHelpDialogUI({ UI: { helpDialog: true }})).toBe(true)
    })

})
