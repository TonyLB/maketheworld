import { getMapDialogUI } from './mapDialog'

describe('MapDialog selector', () => {
    it('should return false from an empty state', () => {
        expect(getMapDialogUI()).toBe(false)
    })

    it('should return false from a closed state', () => {
        expect(getMapDialogUI({ UI: { mapDialog: false }})).toBe(false)
    })

    it('should return true from an opened state', () => {
        expect(getMapDialogUI({ UI: { mapDialog: true }})).toBe(true)
    })

})
