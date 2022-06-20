import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../dynamoDB/index.js')
import { ephemeraDB } from '../dynamoDB/index.js'
jest.mock('./updateRooms.js')
import { updateRooms } from './updateRooms.js'
jest.mock('./dependencyCascade.js')
import dependencyCascade from './dependencyCascade.js'
jest.mock('./updateAssets.js')
import updateAssets from './updateAssets.js'
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
        ephemeraDB.query.mockResolvedValue([])
        dependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        updateAssets.mockResolvedValue({ BASE: testAssets.BASE })
        const output = await executeInAsset('BASE')('return foo')
        expect(output.returnValue).toBe(true)
        expect(dependencyCascade).toHaveBeenCalledWith(
            { BASE: testAssets.BASE },
            { BASE: [] },
            []
        )
        expect(updateAssets).toHaveBeenCalledTimes(1)
        expect(updateAssets).toHaveBeenCalledWith({
            newStates: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        expect(updateRooms).toHaveBeenCalledWith({
            assetsChangedByRoom: {},
            assetsChangedByMap: {},
            existingStatesByAsset: { BASE: testAssets.BASE }
        })
    })

    it('should post an end-to-end cascade', async () => {
        const testAssets = testAssetsFactory()
        const cascadedAssets = testAssetsFactory({
            foo: false,
            antiFoo: true,
            layerAFoo: false,
            layerBFoo: false,
            fooBar: false,
            exclude: ['MixLayerB']
        })
        ephemeraDB.query.mockResolvedValue([])
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: cascadedAssets,
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
        updateAssets.mockResolvedValue(cascadedAssets)
        await executeInAsset('BASE')('foo = false')
        expect(dependencyCascade).toHaveBeenCalledWith(
            { BASE: testAssetsFactory({ foo: false }).BASE },
            { BASE: ['foo'] },
            []
        )
        expect(updateAssets).toHaveBeenCalledTimes(1)
        expect(updateAssets).toHaveBeenCalledWith({
            newStates: cascadedAssets,
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
        expect(updateRooms).toHaveBeenCalledWith({
            assetsChangedByRoom: {
                MNO: ['LayerA']
            },
            assetsChangedByMap: {},
            existingStatesByAsset: cascadedAssets
        })
    })

    it('should detect a map update', async () => {
        const testAssets = {
            BASE: {
                State: {
                    foo: { value: false },
                },
                Dependencies: {
                    foo: {
                        map: ['TestMap']
                    }
                },
                importTree: {}
            }
        }
        const updatedAssets = {
            BASE: {
                State: {
                    foo: { value: true },
                },
                Dependencies: {
                    foo: {
                        map: ['TestMap']
                    }
                },
                importTree: {}
            }
        }
        ephemeraDB.query.mockResolvedValue([])
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: updatedAssets,
            recalculated: {
                BASE: ['foo']
            }
        })
        updateAssets.mockResolvedValue(updatedAssets)
        await executeInAsset('BASE')('foo = true')
        expect(dependencyCascade).toHaveBeenCalledWith(
            { BASE: updatedAssets.BASE },
            { BASE: ['foo'] },
            []
        )
        expect(updateAssets).toHaveBeenCalledTimes(1)
        expect(updateAssets).toHaveBeenCalledWith({
            newStates: updatedAssets,
            recalculated: {
                BASE: ['foo'],
            }
        })
        expect(updateRooms).toHaveBeenCalledWith({
            assetsChangedByRoom: {},
            assetsChangedByMap: {
                TestMap: ['BASE']
            },
            existingStatesByAsset: updatedAssets
        })
    })

    it('should add a message to queue on here.worldMessage call', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.query.mockResolvedValue([])
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        updateAssets.mockResolvedValue(testAssets)
        const { executeMessageQueue } = await executeInAsset('BASE', { RoomId: '123456' })('here.message("Test Message")')
        expect(executeMessageQueue).toEqual([{
            DisplayProtocol: 'WorldMessage',
            Message: [{ tag: 'String', value: 'Test Message' }],
            Targets: ['ROOM#123456']
        }])

    })

    it('should add a message to queue on room-ID.worldMessage call', async () => {
        const testAssets = testAssetsFactory()
        ephemeraDB.query.mockResolvedValue([{
            EphemeraId: 'ROOM#456789',
            key: 'test'
        }])
        ephemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        dependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        updateAssets.mockResolvedValue(testAssets)
        const { executeMessageQueue } = await executeInAsset('BASE', { RoomId: '123456' })('test.message("Test Message")')
        expect(executeMessageQueue).toEqual([{
            DisplayProtocol: 'WorldMessage',
            Message: [{ tag: 'String', value: 'Test Message' }],
            Targets: ['ROOM#456789']
        }])

    })

})