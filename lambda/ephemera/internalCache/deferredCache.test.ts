import { Deferred, DeferredCache } from './deferredCache'

describe('DeferredCache', () => {
    const testCache = new DeferredCache<string>()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        testCache.clear()
    })

    afterEach(async () => {
        await testCache.flush()
    })

    it('should send async only where no previous attempt is running', async () => {
        testCache._cache['testOne'] = new Deferred()
        testCache._cache['testOne'].resolve('1')
        const testFactory = jest.fn().mockResolvedValue({
            testTwo: '2',
            testThree: '3'
        })
        testCache.add({
            promiseFactory: testFactory,
            requiredKeys: ['testOne', 'testTwo', 'testThree'],
            transform: (output: Record<string, string>) => (output)
        })
        const output = await Promise.all([
            testCache.get('testOne'),
            testCache.get('testTwo'),
            testCache.get('testThree')
        ])
        expect(output).toEqual(['1', '2', '3'])
        expect(testFactory).toHaveBeenCalledTimes(1)
        expect(testFactory).toHaveBeenCalledWith(['testTwo', 'testThree'])
    })

    it('should accept the first write to the deferred value', async () => {
        let resolveOne: (arg: Record<string, string>) => void = (arg) => {}
        const testFactoryOne = () => (new Promise<Record<string, string>>((resolve) => { resolveOne = resolve }))
        const testFactoryTwo = jest.fn().mockResolvedValue({
            testOne: 'right answer',
            testTwo: 'test'
        })
        testCache.add({
            promiseFactory: testFactoryOne,
            requiredKeys: ['testOne'],
            transform: (output: Record<string, string>) => (output)
        })
        testCache.add({
            promiseFactory: testFactoryTwo,
            requiredKeys: ['testTwo'],
            transform: (output: Record<string, string>) => (output)
        })
        resolveOne({ testOne: 'wrong answer' })
        const output = await Promise.all([
            testCache.get('testOne'),
            testCache.get('testTwo')
        ])
        expect(output).toEqual(['right answer', 'test'])
    })

    it('should make new deferred entries for unexpected outputs', async () => {
        const testFactoryOne = jest.fn().mockResolvedValue({
            testOne: 'test',
            testTwo: 'right answer'
        })
        const testFactoryTwo = jest.fn().mockResolvedValue({
            testTwo: 'wrong answer'
        })
        testCache.add({
            promiseFactory: testFactoryOne,
            requiredKeys: ['testOne'],
            transform: (output: Record<string, string>) => (output)
        })
        testCache.add({
            promiseFactory: testFactoryTwo,
            requiredKeys: ['testTwo'],
            transform: (output: Record<string, string>) => (output)
        })
        const output = await testCache.get('testTwo')
        expect(output).toEqual('right answer')
    })

})
