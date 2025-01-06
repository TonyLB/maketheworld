import Debounce from './keyedDebounce'

describe('keyedDebounce', () => {
    const debounce = new Debounce()
    beforeEach(() => {
        jest.useFakeTimers()
        debounce.clear()
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it('should set a timeout when a debounce is created', () => {
        const callback = jest.fn()
        debounce.set('test', callback, 1000)
        expect(callback).not.toHaveBeenCalled()
        jest.advanceTimersByTime(2000)
        expect(callback).toHaveBeenCalled()
    })

    it('should reset a timeout', () => {
        const callbackOne = jest.fn()
        const callbackTwo = jest.fn()
        debounce.set('test', callbackOne, 1000)
        jest.advanceTimersByTime(500)
        debounce.set('testTwo', callbackTwo, 1000)
        debounce.set('test', callbackOne, 2000)
        expect(callbackOne).not.toHaveBeenCalled()
        expect(callbackTwo).not.toHaveBeenCalled()
        jest.advanceTimersByTime(1500)
        expect(callbackOne).not.toHaveBeenCalled()
        expect(callbackTwo).toHaveBeenCalled()
        jest.advanceTimersByTime(1000)
        expect(callbackOne).toHaveBeenCalled()
    })

    it('should reset on execute', () => {
        const testCallback = jest.fn()
        debounce.set('test', testCallback, 1000)
        expect(Object.keys(debounce._timeouts)).toEqual(['test'])
        jest.advanceTimersByTime(2000)
        expect(debounce._timeouts).toEqual({})
    })

})