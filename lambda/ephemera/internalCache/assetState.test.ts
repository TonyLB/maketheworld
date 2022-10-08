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

    it('should send fetch correctly', async () => {
        internalCache.AssetState.set('VARIABLE#testOne', 1)
        ephemeraMock.batchGetItem.mockResolvedValue([{
            EphemeraId: 'VARIABLE#testTwo',
            value: 2
        },
        {
            EphemeraId: 'COMPUTED#testThree',
            value: 3
        }])
        const output = await internalCache.AssetState.get({
            a: 'VARIABLE#testOne',
            b: 'VARIABLE#testTwo',
            c: 'COMPUTED#testThree'
        })
        expect(output).toEqual({
            a: 1,
            b: 2,
            c: 3
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledWith({
            Items: [
                { EphemeraId: 'VARIABLE#testTwo', DataCategory: 'Meta::Variable' },
                { EphemeraId: 'COMPUTED#testThree', DataCategory: 'Meta::Computed' }
            ],
            ProjectionFields: ['EphemeraId', '#value'],
            ExpressionAttributeNames: {
                '#value': 'value'
            }
        })
    })

    it('should invalidate both promise and set', async () => {
        ephemeraMock.batchGetItem
            .mockResolvedValueOnce([{ EphemeraId: 'VARIABLE#testOne', value: 'first wrong answer' }])
            .mockResolvedValueOnce([{ EphemeraId: 'VARIABLE#testOne', value: 'correct answer' }])
        await internalCache.AssetState.get({ testOne: 'VARIABLE#testOne' })
        internalCache.AssetState.set('VARIABLE#testOne', 'second wrong answer')
        internalCache.AssetState.invalidate('VARIABLE#testOne')
        const output = await internalCache.AssetState.get({ testOne: 'VARIABLE#testOne' })
        expect(output).toEqual({
            testOne: 'correct answer'
        })

    })

    it('should not fetch when value has been manually set', async () => {
        ephemeraMock.batchGetItem
            .mockResolvedValueOnce([{ EphemeraId: 'VARIABLE#testOne', value: 'first wrong answer' }])
        internalCache.AssetState.set('VARIABLE#testOne', 'correct answer')
        const output = await internalCache.AssetState.get({ testOne: 'VARIABLE#testOne' })
        expect(output).toEqual({
            testOne: 'correct answer'
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(0)
    })
})

describe('EvaluateCode', () => {
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
        const output = await internalCache.EvaluateCode.get({ mapping: { a: 'VARIABLE#testOne', b: 'VARIABLE#testTwo' }, source: 'a+b'})
        expect(output).toBe(3)
        expect(internalCache.AssetState.get).toHaveBeenCalledTimes(1)
        expect(internalCache.AssetState.get).toHaveBeenCalledWith({
            a: 'VARIABLE#testOne',
            b: 'VARIABLE#testTwo'
        })
    })

    it('should only fetch once on two identical calls', async () => {
        const testMapping: AssetStateMapping = { 
            a: 'VARIABLE#testOne',
            b: 'VARIABLE#testTwo'
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
            a: 'VARIABLE#testOne',
            b: 'VARIABLE#testTwo'
        }
        const testMappingTwo: AssetStateMapping = { 
            a: 'VARIABLE#testThree',
            b: 'VARIABLE#testFour'
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
            a: 'VARIABLE#testOne',
            b: 'VARIABLE#testTwo'
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

describe('AssetMap', () => {
    let ancestryGetMock = jest.fn()
    let ancestryGetPartialMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.AssetMap._Ancestry, 'get').mockImplementation(ancestryGetMock)
        jest.spyOn(internalCache.AssetMap._Ancestry, 'getPartial').mockImplementation(ancestryGetPartialMock)
    })

    it('should not fetch for ancestry information already possessed', async () => {
        ancestryGetPartialMock.mockReturnValue([
            {
                EphemeraId: 'COMPUTED#testOne',
                completeness: 'Complete',
                connections: [
                    { EphemeraId: 'VARIABLE#argOne', key: 'a', assets: ['base'] },
                    { EphemeraId: 'VARIABLE#argTwo', key: 'b', assets: ['base'] }
                ]
            },
            {
                EphemeraId: 'VARIABLE#argOne',
                connections: []
            },
            {
                EphemeraId: 'VARIABLE#argTwo',
                connections: []
            }
        ])
        const output = await internalCache.AssetMap.get('COMPUTED#testOne')
        expect(internalCache.AssetMap._Ancestry.get).toHaveBeenCalledTimes(0)
        expect(output).toEqual({
            a: 'VARIABLE#argOne',
            b: 'VARIABLE#argTwo'
        })
    })

    it('should fetch when it has only partial Ancestry information', async () => {
        ancestryGetMock.mockResolvedValue([
            {
                EphemeraId: 'COMPUTED#testOne',
                completeness: 'Complete',
                connections: [
                    { EphemeraId: 'VARIABLE#argOne', key: 'a', assets: ['base'] },
                    { EphemeraId: 'VARIABLE#argTwo', key: 'b', assets: ['base'] }
                ]
            },
            {
                EphemeraId: 'VARIABLE#argOne',
                connections: []
            },
            {
                EphemeraId: 'VARIABLE#argTwo',
                connections: []
            }
        ])
        ancestryGetPartialMock.mockReturnValue([
            {
                EphemeraId: 'COMPUTED#testOne',
                completeness: 'Partial',
                connections: [
                    { EphemeraId: 'VARIABLE#argOne', key: 'a', assets: ['base'] }
                ]
            },
            {
                EphemeraId: 'VARIABLE#argOne',
                connections: []
            },
        ])
        const output = await internalCache.AssetMap.get('COMPUTED#testOne')
        expect(internalCache.AssetMap._Ancestry.get).toHaveBeenCalledTimes(1)
        expect(output).toEqual({
            a: 'VARIABLE#argOne',
            b: 'VARIABLE#argTwo'
        })
    })

    it('should query per-asset information on an asset argument', async () => {
        ephemeraMock.query.mockResolvedValueOnce([
            { EphemeraId: 'COMPUTED#testOne', key: 'one' },
            { EphemeraId: 'COMPUTED#testTwo', key: 'two' }
        ]).mockResolvedValueOnce([
            { EphemeraId: 'VARIABLE#testThree', key: 'three' }
        ])

        const output = await internalCache.AssetMap.get('ASSET#Base')
        expect(ephemeraMock.query).toHaveBeenCalledTimes(2)
        expect(ephemeraMock.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'ASSET#Base',
            KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
            ExpressionAttributeNames: {
                '#key': 'key'
            },
            ExpressionAttributeValues: {
                ':ephemeraPrefix': 'COMPUTED'
            },
            ProjectionFields: ['#key', 'EphemeraId']
        })
        expect(ephemeraMock.query).toHaveBeenCalledWith({
            IndexName: 'DataCategoryIndex',
            DataCategory: 'ASSET#Base',
            KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
            ExpressionAttributeNames: {
                '#key': 'key'
            },
            ExpressionAttributeValues: {
                ':ephemeraPrefix': 'VARIABLE'
            },
            ProjectionFields: ['#key', 'EphemeraId']
        })
        expect(output).toEqual({ one: 'COMPUTED#testOne', two: 'COMPUTED#testTwo', three: 'VARIABLE#testThree' })
    })

})