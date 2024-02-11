import { isNestedPrint } from "./printUtils"

describe('nestingLevel utilities', () => {
    it('should correctly identify a nested tag', () => {
        expect(isNestedPrint('<Description>\n    Test\n</Description>')).toBe(true)
        expect(isNestedPrint('<Description>Test</Description>')).toBe(false)
        expect(isNestedPrint('<Description\n>\n    Test\n</Description>')).toBe(false)
    })
})
