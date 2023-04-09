import { isValidExpression } from "./JSEdit"

describe("JSEdit", () => {
    describe("isValidExpression", () => {
        it('should correctly flag a valid expression', () => {
            expect(isValidExpression("false")).toBe(true)
        })
        it('should flag an expression with unbounded brackets', () => {
            expect(isValidExpression('{{}')).toBe(false)
        })
        it('should correctly ignore brackets within quotes', () => {
            expect(isValidExpression('{"{"}')).toBe(true)
        })
    })
})
