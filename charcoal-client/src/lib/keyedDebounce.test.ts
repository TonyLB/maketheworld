import Debounce from './keyedDebounce'

describe('keyedDebounce', () => {
    jest.useFakeTimers()
    jest.spyOn(global, 'setTimeout')
    jest.spyOn(global, 'clearTimeout')
    const debounce = new Debounce()
    beforeEach(() => {
        debounce.clear()
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    afterEach(() => {
        jest.clearAllTimers()
    })

    it('should set a timeout when a debounce is created', () => {
        debounce.set('test', () => {}, 5000)
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000)
        expect(clearTimeout).toHaveBeenCalledTimes(0)
    })

    it('should reset a timeout', () => {
        debounce.set('test', () => {}, 1000)
        expect(setTimeout).toHaveBeenCalledTimes(1)
        expect(clearTimeout).toHaveBeenCalledTimes(0)
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
        debounce.set('testTwo', () => {}, 1500)
        expect(setTimeout).toHaveBeenCalledTimes(2)
        expect(clearTimeout).toHaveBeenCalledTimes(0)
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1500)
        debounce.set('test', () => {}, 2000)
        expect(setTimeout).toHaveBeenCalledTimes(3)
        expect(clearTimeout).toHaveBeenCalledTimes(1)
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000)
    })

    xit('should reset on execute', () => {
        const testCallback = jest.fn()
        debounce.set('test', testCallback, 1000)
        expect(debounce._timeouts).toEqual({ test: expect.any(Number) })
        jest.advanceTimersByTime(2000)
        expect(debounce._timeouts).toEqual({})
    })

})