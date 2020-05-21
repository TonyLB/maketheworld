import { getMapDialogUI, getEditMapDialogUI } from './mapDialog'

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

    it('should return false for EditMap from an empty state', () => {
        expect(getEditMapDialogUI()).toBe(false)
    })

    it('should return false for EditMap from a closed state', () => {
        expect(getEditMapDialogUI({ UI: { editMapDialog: false }})).toBe(false)
    })

    it('should return true for EditMap from an opened state', () => {
        expect(getEditMapDialogUI({ UI: { editMapDialog: true }})).toBe(true)
    })

})
