jest.mock('../dynamoDB')
import { ephemeraDB } from '../dynamoDB'
jest.mock('./updateRooms')
import { updateRooms } from './updateRooms'
jest.mock('./dependencyCascade')
import dependencyCascade from './dependencyCascade'
jest.mock('./updateAssets')
import updateAssets from './updateAssets'
import { testAssetsFactory, resultStateFactory, testMockImplementation } from './testAssets'

import { executeInAsset } from './index'

const mockedEphemeraDB = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const mockedDependencyCascade = dependencyCascade as jest.Mock
const mockedUpdateAssets = updateAssets as jest.Mock
const mockedUpdateRooms = updateRooms as jest.Mock

describe('executeInAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should post no changes on an empty change list', async () => {
        const testAssets: Record<string, any> = testAssetsFactory()
        mockedEphemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        mockedEphemeraDB.query.mockResolvedValue([])
        mockedDependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        mockedUpdateAssets.mockResolvedValue({ BASE: testAssets.BASE })
        const output = await executeInAsset('BASE')('return foo')
        expect(output.returnValue).toBe(true)
        expect(mockedDependencyCascade).toHaveBeenCalledWith(
            { BASE: testAssets.BASE },
            { BASE: [] },
            []
        )
        expect(mockedUpdateAssets).toHaveBeenCalledTimes(1)
        expect(mockedUpdateAssets).toHaveBeenCalledWith({
            newStates: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        expect(mockedUpdateRooms).toHaveBeenCalledWith({
            assetsChangedByRoom: {},
            assetsChangedByMap: {},
            existingStatesByAsset: { BASE: testAssets.BASE }
        })
    })

    it('should post an end-to-end cascade', async () => {
        const testAssets: Record<string, any> = testAssetsFactory()
        const cascadedAssets = testAssetsFactory({
            foo: false,
            antiFoo: true,
            layerAFoo: false,
            layerBFoo: false,
            fooBar: false,
            exclude: ['MixLayerB']
        })
        mockedEphemeraDB.query.mockResolvedValue([])
        mockedEphemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        mockedDependencyCascade.mockResolvedValue({
            states: cascadedAssets,
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
        mockedUpdateAssets.mockResolvedValue(cascadedAssets)
        await executeInAsset('BASE')('foo = false')
        expect(mockedDependencyCascade).toHaveBeenCalledWith(
            { BASE: (testAssetsFactory({ foo: false }) as Record<string, any>).BASE },
            { BASE: ['foo'] },
            []
        )
        expect(mockedUpdateAssets).toHaveBeenCalledTimes(1)
        expect(mockedUpdateAssets).toHaveBeenCalledWith({
            newStates: cascadedAssets,
            recalculated: {
                BASE: ['foo', 'antiFoo'],
                LayerA: ['foo', 'fooBar'],
                LayerB: ['foo'],
                MixLayerA: ['fooBar']
            }
        })
        expect(mockedUpdateRooms).toHaveBeenCalledWith({
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
        mockedEphemeraDB.query.mockResolvedValue([])
        mockedEphemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        mockedDependencyCascade.mockResolvedValue({
            states: updatedAssets,
            recalculated: {
                BASE: ['foo']
            }
        })
        mockedUpdateAssets.mockResolvedValue(updatedAssets)
        await executeInAsset('BASE')('foo = true')
        expect(mockedDependencyCascade).toHaveBeenCalledWith(
            { BASE: updatedAssets.BASE },
            { BASE: ['foo'] },
            []
        )
        expect(mockedUpdateAssets).toHaveBeenCalledTimes(1)
        expect(mockedUpdateAssets).toHaveBeenCalledWith({
            newStates: updatedAssets,
            recalculated: {
                BASE: ['foo'],
            }
        })
        expect(mockedUpdateRooms).toHaveBeenCalledWith({
            assetsChangedByRoom: {},
            assetsChangedByMap: {
                TestMap: ['BASE']
            },
            existingStatesByAsset: updatedAssets
        })
    })

    it('should add a message to queue on here.worldMessage call', async () => {
        const testAssets: Record<string, any> = testAssetsFactory()
        mockedEphemeraDB.query.mockResolvedValue([])
        mockedEphemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        mockedDependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        mockedUpdateAssets.mockResolvedValue(testAssets)
        const { executeMessageQueue } = await executeInAsset('BASE', { RoomId: '123456' })('here.message("Test Message")')
        expect(executeMessageQueue).toEqual([{
            DisplayProtocol: 'WorldMessage',
            Message: [{ tag: 'String', value: 'Test Message' }],
            Targets: ['ROOM#123456']
        }])

    })

    it('should add a message to queue on room-ID.worldMessage call', async () => {
        const testAssets: Record<string, any> = testAssetsFactory()
        mockedEphemeraDB.query.mockResolvedValue([{
            EphemeraId: 'ROOM#456789',
            key: 'test'
        }])
        mockedEphemeraDB.getItem.mockImplementation(testMockImplementation(testAssets, { type: 'getItem' }))
        mockedDependencyCascade.mockResolvedValue({
            states: { BASE: testAssets.BASE },
            recalculated: { BASE: [] }
        })
        mockedUpdateAssets.mockResolvedValue(testAssets)
        const { executeMessageQueue } = await executeInAsset('BASE', { RoomId: '123456' })('test.message("Test Message")')
        expect(executeMessageQueue).toEqual([{
            DisplayProtocol: 'WorldMessage',
            Message: [{ tag: 'String', value: 'Test Message' }],
            Targets: ['ROOM#456789']
        }])

    })

})