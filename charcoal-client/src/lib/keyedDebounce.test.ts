import Debounce from './keyedDebounce'

describe('keyedDebounce', () => {
    const debounce = new Debounce()
    beforeEach(() => {
        vi.useFakeTimers()
        debounce.clear()
        vi.clearAllMocks()
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.clearAllTimers()
        vi.useRealTimers()
    })

    it('should set a timeout when a debounce is created', () => {
        const callback = vi.fn()
        debounce.set('test', callback, 1000)
        expect(callback).not.toHaveBeenCalled()
        vi.advanceTimersByTime(2000)
        expect(callback).toHaveBeenCalled()
    })

    it('should reset a timeout', () => {
        const callbackOne = vi.fn()
        const callbackTwo = vi.fn()
        debounce.set('test', callbackOne, 1000)
        vi.advanceTimersByTime(500)
        debounce.set('testTwo', callbackTwo, 1000)
        debounce.set('test', callbackOne, 2000)
        expect(callbackOne).not.toHaveBeenCalled()
        expect(callbackTwo).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1500)
        expect(callbackOne).not.toHaveBeenCalled()
        expect(callbackTwo).toHaveBeenCalled()
        vi.advanceTimersByTime(1000)
        expect(callbackOne).toHaveBeenCalled()
    })

    it('should reset on execute', () => {
        const testCallback = vi.fn()
        debounce.set('test', testCallback, 1000)
        expect(Object.keys(debounce._timeouts)).toEqual(['test'])
        vi.advanceTimersByTime(2000)
        expect(debounce._timeouts).toEqual({})
    })

})