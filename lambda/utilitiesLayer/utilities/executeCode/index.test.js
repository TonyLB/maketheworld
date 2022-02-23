import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
jest.mock('./updateRooms.js')
import { updateRooms } from './updateRooms.js'
jest.mock('./dependencyCascade.js')
import dependencyCascade from './dependencyCascade.js'
import { testAssetsFactory, resultStateFactory, testMockImplementation } from './testAssets.js'

import { executeInAsset } from './index.js'

describe('executeInAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should post no changes on an empty change list', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        const output = await executeInAsset('BASE')('return foo')
        expect(output).toBe(true)
        expect(dependencyCascade).toHaveBeenCalledWith(
            { BASE: testAssets.BASE },
            { BASE: [] },
            []
        )
        expect(ephemeraDB.update).toHaveBeenCalledTimes(1)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: { value: true },
                    antiFoo: {
                        computed: true,
                        src: '!foo',
                        value: false
                    }
                }
            }
        })
        expect(updateRooms).toHaveBeenCalledWith([])
    })

    it('should post an end-to-end cascade', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: testAssetsFactory({
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
        const output = await executeInAsset('BASE')('foo = false')
        expect(dependencyCascade).toHaveBeenCalledWith(
            { BASE: testAssetsFactory({ foo: false }).BASE },
            { BASE: ['foo'] },
            []
        )
        expect(ephemeraDB.update).toHaveBeenCalledTimes(4)
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: { value: false },
                    antiFoo: {
                        computed: true,
                        src: '!foo',
                        value: true
                    }
                }
            }
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#LayerA',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: {
                        imported: true,
                        asset: 'BASE',
                        key: 'foo',
                        value: false
                    },
                    bar: { value: true },
                    antiBar: {
                        computed: true,
                        src: '!bar',
                        value: false
                    },
                    fooBar: {
                        computed: true,
                        src: 'foo && bar',
                        value: false
                    }
                }
            }
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#LayerB',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    foo: {
                        imported: true,
                        asset: 'BASE',
                        key: 'foo',
                        value: false
                    },
                    baz: { value: true },
                    antiBaz: {
                        computed: true,
                        src: '!baz',
                        value: false
                    },
                    fooBaz: {
                        computed: true,
                        src: 'foo || baz',
                        value: true
                    }
                }
            }
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#MixLayerA',
            DataCategory: 'Meta::Asset',
            UpdateExpression: 'SET #state = :state',
            ExpressionAttributeNames: {
                ['#state']: 'State'
            },
            ExpressionAttributeValues: {
                [':state']: {
                    fooBar: {
                        imported: true,
                        asset: 'LayerA',
                        key: 'fooBar',
                        value: false
                    }
                }
            }
        })
        expect(updateRooms).toHaveBeenCalledWith([])
    })
})