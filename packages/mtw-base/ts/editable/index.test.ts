import { editWrappedTypeguard, StandardEditableData } from './index'

describe('editWrappedTypeguard', () => {
    const typeguard = (x: any): x is number => typeof x === 'number'

    it('should return true for a valid type', () => {
        const data: StandardEditableData<number> = 42
        expect(editWrappedTypeguard(typeguard)(data)).toBe(true)
    })

    it('should return true for a valid Remove tag', () => {
        const data: StandardEditableData<number> = { tag: 'Remove', match: 42 }
        expect(editWrappedTypeguard(typeguard)(data)).toBe(true)
    })

    it('should return true for a valid Replace tag', () => {
        const data: StandardEditableData<number> = { tag: 'Replace', match: 42, payload: 43 }
        expect(editWrappedTypeguard(typeguard)(data)).toBe(true)
    })

    it('should return false for an invalid type', () => {
        const data: any = 'invalid'
        expect(editWrappedTypeguard(typeguard)(data)).toBe(false)
    })

    it('should return false for an invalid Remove tag', () => {
        const data: any = { tag: 'Remove', match: 'invalid' }
        expect(editWrappedTypeguard(typeguard)(data)).toBe(false)
    })

    it('should return false for an invalid Replace tag', () => {
        const data: any = { tag: 'Replace', match: 42, payload: 'invalid' }
        expect(editWrappedTypeguard(typeguard)(data)).toBe(false)
    })

    it('should return false for a null value', () => {
        const data: any = null
        expect(editWrappedTypeguard(typeguard)(data)).toBe(false)
    })

    it('should return false for an undefined value', () => {
        const data: any = undefined
        expect(editWrappedTypeguard(typeguard)(data)).toBe(false)
    })

    it('should return false for an object without a tag', () => {
        const data: any = { match: 42 }
        expect(editWrappedTypeguard(typeguard)(data)).toBe(false)
    })
})