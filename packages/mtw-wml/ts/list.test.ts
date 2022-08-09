import { zipList } from './list'

describe('zipList utility', () => {
    const testCallback = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should return no calls on empty list', () => {
        expect(zipList([], testCallback)).toEqual([])
        expect(testCallback).toHaveBeenCalledTimes(0)
    })

    it('should call all pairs on a list', () => {
        testCallback.mockReturnValue(1)
        expect(zipList(['A', 'B', 'C'], testCallback)).toEqual([1, 1, 1, 1])
        expect(testCallback).toHaveBeenCalledTimes(4)
        expect(testCallback).toHaveBeenCalledWith({ second: 'A' })
        expect(testCallback).toHaveBeenCalledWith({ first: 'A', second: 'B' })
        expect(testCallback).toHaveBeenCalledWith({ first: 'B', second: 'C' })
        expect(testCallback).toHaveBeenCalledWith({ first: 'C' })
    })
})