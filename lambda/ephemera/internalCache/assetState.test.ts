jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."
import { AssetStateMapping } from './assetState'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('AssetState', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should send fetch only where no previous attempt is running', async () => {
        internalCache.AssetState._StatePromiseByEphemeraId['testOne'] = Promise.resolve(1)
        ephemeraMock.batchGetItem.mockResolvedValue([{
            EphemeraId: 'testTwo',
            value: 2
        },
        {
            EphemeraId: 'testThree',
            value: 3
        }])
        const output = await internalCache.AssetState.get({
            a: { tag: 'Variable', EphemeraId: 'testOne' },
            b: { tag: 'Variable', EphemeraId: 'testTwo' },
            c: { tag: 'Computed', EphemeraId: 'testThree' }
        })
        expect(output).toEqual({
            a: 1,
            b: 2,
            c: 3
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledWith({
            Items: [
                { EphemeraId: 'testTwo', DataCategory: 'Meta::Variable' },
                { EphemeraId: 'testThree', DataCategory: 'Meta::Computed' }
            ],
            ProjectionFields: ['EphemeraId', '#value'],
            ExpressionAttributeNames: {
                '#value': 'value'
            }
        })
    })

    it('should override an in-progress attempt when set is called', async () => {
        let mockResolve
        ephemeraMock.batchGetItem.mockImplementation(() => (new Promise((resolve) => {
            mockResolve = resolve
        })))
        const outputPromise = internalCache.AssetState.get({ testOne: { EphemeraId: 'testOne', tag: 'Variable' }})
        internalCache.AssetState.set('testOne', 'correct answer')
        mockResolve([{ EphemeraId: 'testOne', value: 'wrong answer' }])
        const output = await outputPromise
        expect(output).toEqual({
            testOne: 'correct answer'
        })

    })

    it('should override an error when set is called', async () => {
        let mockReject
        ephemeraMock.batchGetItem.mockImplementation(() => (new Promise((resolve, reject) => {
            mockReject = reject
        })))
        const outputPromise = internalCache.AssetState.get({ testOne: { EphemeraId: 'testOne', tag: 'Variable' }})
        internalCache.AssetState.set('testOne', 'correct answer')
        mockReject()
        const output = await outputPromise
        expect(output).toEqual({
            testOne: 'correct answer'
        })

    })

    it('should invalidate both promise and set', async () => {
        ephemeraMock.batchGetItem
            .mockResolvedValueOnce([{ EphemeraId: 'testOne', value: 'first wrong answer' }])
            .mockResolvedValueOnce([{ EphemeraId: 'testOne', value: 'correct answer' }])
        await internalCache.AssetState.get({ testOne: { EphemeraId: 'testOne', tag: 'Variable' }})
        internalCache.AssetState.set('testOne', 'second wrong answer')
        internalCache.AssetState.invalidate('testOne')
        const output = await internalCache.AssetState.get({ testOne: { EphemeraId: 'testOne', tag: 'Variable' }})
        expect(output).toEqual({
            testOne: 'correct answer'
        })

    })

    it('should not fetch when value has been manually set', async () => {
        ephemeraMock.batchGetItem
            .mockResolvedValueOnce([{ EphemeraId: 'testOne', value: 'first wrong answer' }])
        internalCache.AssetState.set('testOne', 'correct answer')
        const output = await internalCache.AssetState.get({ testOne: { EphemeraId: 'testOne', tag: 'Variable' }})
        expect(output).toEqual({
            testOne: 'correct answer'
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(0)
    })
})

describe('AssetState', () => {
    let assetCacheMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.AssetState, 'get').mockImplementation(assetCacheMock)
    })

    it('should evaluate without argument', async () => {
        const output = await internalCache.EvaluateCode.get({ mapping: {}, source: '1+2'})
        expect(output).toBe(3)
        expect(internalCache.EvaluateCode._AssetState.get).toHaveBeenCalledTimes(0)
    })

    it('should evaluate with arguments', async () => {
        assetCacheMock.mockResolvedValue({ a: 1, b: 2 })
        const output = await internalCache.EvaluateCode.get({ mapping: { a: { EphemeraId: 'testOne', tag: 'Variable' }, b: { EphemeraId: 'testTwo', tag: 'Computed' } }, source: 'a+b'})
        expect(output).toBe(3)
        expect(internalCache.AssetState.get).toHaveBeenCalledTimes(1)
        expect(internalCache.AssetState.get).toHaveBeenCalledWith({
            a: { EphemeraId: 'testOne', tag: 'Variable' },
            b: { EphemeraId: 'testTwo', tag: 'Computed' }
        })
    })

    it('should only fetch once on two identical calls', async () => {
        const testMapping: AssetStateMapping = { 
            a: { EphemeraId: 'testOne', tag: 'Variable' },
            b: { EphemeraId: 'testTwo', tag: 'Computed' }
        }
        assetCacheMock.mockResolvedValue({ a: 1, b: 2 })
        await internalCache.EvaluateCode.get({ mapping: testMapping, source: 'a+b'})
        const output = await internalCache.EvaluateCode.get({ mapping: testMapping, source: 'a+b'})
        expect(output).toBe(3)
        expect(internalCache.AssetState.get).toHaveBeenCalledTimes(1)
        expect(internalCache.AssetState.get).toHaveBeenCalledWith(testMapping)
    })

    it('should fetch twice on identical source with different mappings', async () => {
        const testMappingOne: AssetStateMapping = { 
            a: { EphemeraId: 'testOne', tag: 'Variable' },
            b: { EphemeraId: 'testTwo', tag: 'Computed' }
        }
        const testMappingTwo: AssetStateMapping = { 
            a: { EphemeraId: 'testThree', tag: 'Variable' },
            b: { EphemeraId: 'testFour', tag: 'Computed' }
        }
        assetCacheMock
            .mockResolvedValueOnce({ a: 1, b: 2 })
            .mockResolvedValueOnce({ a: 3, b: 4 })
        const outputOne = await internalCache.EvaluateCode.get({ mapping: testMappingOne, source: 'a+b'})
        const outputTwo = await internalCache.EvaluateCode.get({ mapping: testMappingTwo, source: 'a+b'})
        expect(outputOne).toBe(3)
        expect(outputTwo).toBe(7)
        expect(internalCache.AssetState.get).toHaveBeenCalledTimes(2)
        expect(internalCache.AssetState.get).toHaveBeenCalledWith(testMappingOne)
        expect(internalCache.AssetState.get).toHaveBeenCalledWith(testMappingTwo)
    })

    it('should fetch twice on two identical mappings with different source', async () => {
        const testMapping: AssetStateMapping = { 
            a: { EphemeraId: 'testOne', tag: 'Variable' },
            b: { EphemeraId: 'testTwo', tag: 'Computed' }
        }
        assetCacheMock.mockResolvedValue({ a: 1, b: 2 })
        const outputOne = await internalCache.EvaluateCode.get({ mapping: testMapping, source: 'a+b'})
        const outputTwo = await internalCache.EvaluateCode.get({ mapping: testMapping, source: 'b-a'})
        expect(outputOne).toBe(3)
        expect(outputTwo).toBe(1)
        expect(internalCache.AssetState.get).toHaveBeenCalledTimes(2)
        expect(internalCache.AssetState.get).toHaveBeenCalledWith(testMapping)
    })

})