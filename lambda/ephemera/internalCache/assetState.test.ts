jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('InternalCache', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
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
            testOne: { tag: 'Variable', EphemeraId: 'testOne' },
            testTwo: { tag: 'Variable', EphemeraId: 'testTwo' },
            testThree: { tag: 'Computed', EphemeraId: 'testThree' }
        })
        expect(output).toEqual({
            testOne: 1,
            testTwo: 2,
            testThree: 3
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