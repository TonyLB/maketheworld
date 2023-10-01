jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."
import { AssetStateMapping } from './assetState'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('StateCache', () => {
    let graphNodesMock
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should send fetch correctly', async () => {
        internalCache.StateCache.set('VARIABLE#testOne', 1)
        ephemeraMock.getItems.mockResolvedValue([{
            EphemeraId: 'VARIABLE#testTwo',
            value: 2
        },
        {
            EphemeraId: 'COMPUTED#testThree',
            value: 3,
            src: 'a + b',
            dependencies: ['a', 'b']
        }])
        const output = await internalCache.StateCache.get([
            'VARIABLE#testOne',
            'VARIABLE#testTwo',
            'COMPUTED#testThree'
        ])
        expect(output).toEqual({
            'VARIABLE#testOne': { value: 1 },
            'VARIABLE#testTwo': { value: 2 },
            'COMPUTED#testThree': { value: 3, src: 'a + b', dependencies: ['a', 'b'] }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'VARIABLE#testTwo', DataCategory: 'Meta::Variable' },
                { EphemeraId: 'COMPUTED#testThree', DataCategory: 'Meta::Computed' }
            ],
            ProjectionFields: ['EphemeraId', 'value', 'src', 'dependencies']
        })
    })

    it('should invalidate both promise and set', async () => {
        ephemeraMock.getItems
            .mockResolvedValueOnce([{ EphemeraId: 'VARIABLE#testOne', value: 'first wrong answer' }])
            .mockResolvedValueOnce([{ EphemeraId: 'VARIABLE#testOne', value: 'correct answer' }])
        await internalCache.StateCache.get(['VARIABLE#testOne'])
        internalCache.StateCache.set('VARIABLE#testOne', 'second wrong answer')
        internalCache.StateCache.invalidate('VARIABLE#testOne')
        const output = await internalCache.StateCache.get(['VARIABLE#testOne'])
        expect(output).toEqual({
            'VARIABLE#testOne': { value: 'correct answer' }
        })

    })

    it('should not fetch when value has been manually set', async () => {
        ephemeraMock.getItems
            .mockResolvedValueOnce([{ EphemeraId: 'VARIABLE#testOne', value: 'first wrong answer' }])
        internalCache.StateCache.set('VARIABLE#testOne', 'correct answer')
        const output = await internalCache.StateCache.get(['VARIABLE#testOne'])
        expect(output).toEqual({
            'VARIABLE#testOne': { value: 'correct answer' }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(0)
    })
})

describe('AssetState', () => {
    let stateCacheMock
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        stateCacheMock = jest.spyOn(internalCache.StateCache, "get")
    })

    it('should send fetch correctly', async () => {
        stateCacheMock.mockResolvedValue({
            'VARIABLE#testOne': { value: 1 },
            'VARIABLE#testTwo': { value: 2 },
            'COMPUTED#testThree': { value: 3 }
        })
        internalCache.AssetState.set('VARIABLE#testOne', 1)
        // ephemeraMock.getItems.mockResolvedValue([{
        //     EphemeraId: 'VARIABLE#testTwo',
        //     value: 2
        // },
        // {
        //     EphemeraId: 'COMPUTED#testThree',
        //     value: 3
        // }])
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
        expect(stateCacheMock).toHaveBeenCalledTimes(1)
        expect(stateCacheMock).toHaveBeenCalledWith(['VARIABLE#testOne', 'VARIABLE#testTwo', 'COMPUTED#testThree'])
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

    it('should invalidate correctly by ephemeraId', async () => {
        const testMapping: AssetStateMapping = { 
            a: 'VARIABLE#testOne',
            b: 'VARIABLE#testTwo'
        }
        assetCacheMock
            .mockResolvedValueOnce({ a: 1, b: 2 })
            .mockResolvedValueOnce({ a: 1, b: 4 })
        const outputOne = await internalCache.EvaluateCode.get({ mapping: testMapping, source: 'a+b'})
        expect(outputOne).toBe(3)
        expect(assetCacheMock).toHaveBeenCalledTimes(1)
        expect(assetCacheMock).toHaveBeenCalledWith(testMapping)
        internalCache.AssetState.invalidate('VARIABLE#testTwo')
        const outputTwo = await internalCache.EvaluateCode.get({ mapping: testMapping, source: 'a+b'})
        expect(outputTwo).toBe(5)
        expect(assetCacheMock).toHaveBeenCalledTimes(2)
    })

})

describe('AssetMap', () => {
    let graphNodesMock = jest.fn()
    let graphEdgesMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        graphNodesMock.mockClear()
        graphEdgesMock.mockClear()
        jest.spyOn(internalCache.AssetMap._GraphNodes, 'get').mockImplementation(graphNodesMock)
        jest.spyOn(internalCache.AssetMap._GraphEdges, 'get').mockImplementation(graphEdgesMock)
    })

    it('should fetch graph ancestry information as needed on a computed argument', async () => {
        graphNodesMock.mockResolvedValue([{
            back: {
                edges: [
                    { target: 'VARIABLE#argOne', context: 'TestAsset' },
                    { target: 'VARIABLE#argTwo', context: 'TestAsset' }
                ]
            }
        }])
        graphEdgesMock.mockResolvedValue([
            { to: 'COMPUTED#testOne', from: 'VARIABLE#argOne', context: 'TestAsset', data: { scopedId: 'a' } },
            { to: 'COMPUTED#testOne', from: 'VARIABLE#argTwo', context: 'TestAsset', data: { scopedId: 'b' } }
        ])
        const output = await internalCache.AssetMap.get('COMPUTED#testOne')
        expect(output).toEqual({
            a: 'VARIABLE#argOne',
            b: 'VARIABLE#argTwo'
        })
    })

    it('should query per-asset information on an asset argument', async () => {
        graphNodesMock.mockResolvedValue([{
            forward: {
                edges: [
                    { target: 'COMPUTED#testOne', context: 'Base' },
                    { target: 'COMPUTED#testTwo', context: 'Base' },
                    { target: 'VARIABLE#testThree', context: 'Base' },
                    { target: 'ROOM#testFour', context: 'Base' }
                ]
            }
        }])
        graphEdgesMock.mockResolvedValue([
            { from: 'ASSET#Base', to: 'COMPUTED#testOne', context: 'Base', data: { scopedId: 'one' } },
            { from: 'ASSET#Base', to: 'COMPUTED#testTwo', context: 'Base', data: { scopedId: 'two' } },
            { from: 'ASSET#Base', to: 'VARIABLE#testThree', context: 'Base', data: { scopedId: 'three' } },
            { from: 'ASSET#Base', to: 'ROOM#testFour', context: 'Base', data: { scopedId: 'four' } }    
        ])

        const output = await internalCache.AssetMap.get('ASSET#Base')
        expect(ephemeraMock.query).toHaveBeenCalledTimes(0)
        expect(graphNodesMock).toHaveBeenCalledTimes(1)
        expect(graphNodesMock).toHaveBeenCalledWith(['ASSET#Base'])
        expect(output).toEqual({ one: 'COMPUTED#testOne', two: 'COMPUTED#testTwo', three: 'VARIABLE#testThree' })
    })

})