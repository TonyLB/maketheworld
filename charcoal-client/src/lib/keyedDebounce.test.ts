jest.useFakeTimers()
jest.spyOn(global, 'setTimeout')
jest.spyOn(global, 'clearTimeout')

import debounce from './keyedDebounce'

describe('keyedDebounce', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        debounce.clear()
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

})