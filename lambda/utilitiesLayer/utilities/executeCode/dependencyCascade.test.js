import { jest, describe, expect, it } from '@jest/globals'
jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
import { testAssetsFactory, resultStateFactory, testMockImplementation } from './testAssets.js'

import dependencyCascade from './dependencyCascade.js'

//
// For testing clarity, this is more of an integration test:  dependencyCascade
// and recalculateComputes are so closely intertwined that it doesn't make much
// sense to attempt to mock recalculateComputes everywhere it would need to
// be mocked.
//
describe('dependencyCascade', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should return unchanged state on empty recalculate seed', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        const output = await dependencyCascade(
            { BASE: testAssets.BASE },
            { BASE: [] }
        )
        expect(output).toEqual({
            states: { BASE: testAssets.BASE.State },
            recalculated: { BASE: [] }
        })
    })

    it('should update an end-to-end cascade', async () => {
        const testAssets = testAssetsFactory({ foo: false })
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        const output = await dependencyCascade(
            { BASE: testAssets.BASE },
            { BASE: ['foo'] }
        )
        expect(output).toEqual({
            states: resultStateFactory({
                foo: false,
                antiFoo: true,
                layerAFoo: false,
                layerBFoo: false,
                fooBar: false,
                exclude: ['MixLayerB']
            }),
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
    })

    it('should update a partial cascade', async () => {
        const testAssets = testAssetsFactory({ bar: false })
        ephemeraDB.batchGetItem.mockImplementation(testMockImplementation(testAssets))
        const output = await dependencyCascade(
            { LayerA: testAssets.LayerA },
            { LayerA: ['bar'] }
        )
        expect(output).toEqual({
            states: resultStateFactory({
                bar: false,
                antiBar: true,
                fooBar: false,
                exclude: ['BASE', 'LayerB', 'MixLayerB']
            }),
            recalculated: {
                LayerA: ['bar', 'antiBar', 'fooBar'],
                MixLayerA: ['fooBar']
            }
        })
    })

})