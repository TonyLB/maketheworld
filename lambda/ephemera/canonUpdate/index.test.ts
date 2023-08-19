import { jest, expect } from '@jest/globals'
import { produce } from 'immer'

jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import {
    ephemeraDB
} from '@tonylb/mtw-utilities/dist/dynamoDB/index'

jest.mock('../internalCache')
import internalCache from '../internalCache'

import { canonUpdateMessage } from '.'
import { MessageBus } from '../messageBus/baseClasses'
import { Graph } from '@tonylb/mtw-utilities/dist/graphStorage/utils/graph'

const internalCacheMock = jest.mocked(internalCache, true)
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('cacheAsset', () => {
    const messageBusMock = { send: jest.fn() } as unknown as MessageBus
    const testEphemeraKey = {
        EphemeraId: 'Global',
        DataCategory: 'Assets'
    }
    const testEphemeraRecord = {
        ...testEphemeraKey,
        assets: ['Base', 'TownCenter']
    }
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        ephemeraDBMock.optimisticUpdate.mockImplementation(async ({ updateReducer, successCallback }) => {
            const returnValue = produce(testEphemeraRecord, updateReducer)
            successCallback?.(returnValue, testEphemeraRecord)
            return returnValue
        })
        internalCacheMock.Global.get.mockResolvedValue(['Base', 'TownCenter'])
        internalCacheMock.Graph.get.mockResolvedValue(new Graph(
            {
                'ASSET#Base': { key: 'ASSET#Base' },
                'ASSET#TownCenter': { key: 'ASSET#TownCenter' },
                'ASSET#Test': { key: 'ASSET#Test' }
            },
            [
                { to: 'ASSET#Base', from: 'ASSET#TownCenter', context: '' },
                { to: 'ASSET#Base', from: 'ASSET#Test', context: '' },
                { to: 'ASSET#TownCenter', from: 'ASSET#Test', context: '' }
            ],
            {},
            true
        ))
    })

    it('should add and rerender a new canon asset', async () => {
        await canonUpdateMessage({
            payloads: [{
                type: 'CanonAdd',
                assetId: 'ASSET#Test'
            }],
            messageBus: messageBusMock
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(produce(testEphemeraRecord, ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({
            ...testEphemeraKey,
            assets: ['Base', 'TownCenter', 'Test']
        })
        expect(internalCacheMock.Global.set).toHaveBeenCalledWith({ key: 'assets', value: ['Base', 'TownCenter', 'Test'] })
        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ASSET#Test'
        })
    })

    it('should not rerender when adding a duplicate canon asset', async () => {
        await canonUpdateMessage({
            payloads: [{
                type: 'CanonAdd',
                assetId: 'ASSET#TownCenter'
            }],
            messageBus: messageBusMock
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(produce(testEphemeraRecord, ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({
            ...testEphemeraKey,
            assets: ['Base', 'TownCenter']
        })
        expect(internalCacheMock.Global.set).toHaveBeenCalledWith({ key: 'assets', value: ['Base', 'TownCenter'] })
        expect(messageBusMock.send).toHaveBeenCalledTimes(0)
    })

    it('should remove and rerender a new non-canon asset', async () => {
        await canonUpdateMessage({
            payloads: [{
                type: 'CanonRemove',
                assetId: 'ASSET#TownCenter'
            }],
            messageBus: messageBusMock
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(produce(testEphemeraRecord, ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({
            ...testEphemeraKey,
            assets: ['Base']
        })
        expect(internalCacheMock.Global.set).toHaveBeenCalledWith({ key: 'assets', value: ['Base'] })
        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ASSET#TownCenter'
        })
    })

    it('should not rerender when removing an absent asset', async () => {
        await canonUpdateMessage({
            payloads: [{
                type: 'CanonRemove',
                assetId: 'ASSET#Test'
            }],
            messageBus: messageBusMock
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(produce(testEphemeraRecord, ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({
            ...testEphemeraKey,
            assets: ['Base', 'TownCenter']
        })
        expect(internalCacheMock.Global.set).toHaveBeenCalledWith({ key: 'assets', value: ['Base', 'TownCenter'] })
        expect(messageBusMock.send).toHaveBeenCalledTimes(0)
    })

    it('should update and rerender when setting assets directly', async () => {
        await canonUpdateMessage({
            payloads: [{
                type: 'CanonSet',
                assetIds: ['ASSET#Base', 'ASSET#Test']
            }],
            messageBus: messageBusMock
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(produce(testEphemeraRecord, ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({
            ...testEphemeraKey,
            assets: ['Base', 'Test']
        })
        expect(internalCacheMock.Global.set).toHaveBeenCalledWith({ key: 'assets', value: ['Base', 'Test'] })
        expect(messageBusMock.send).toHaveBeenCalledTimes(2)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ASSET#TownCenter'
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ASSET#Test'
        })
    })

    it('should reorder into descent order', async () => {
        internalCacheMock.Global.get.mockResolvedValueOnce(['TownCenter', 'Base'])

        await canonUpdateMessage({
            payloads: [{
                type: 'CanonSet',
                assetIds: ['ASSET#TownCenter', 'ASSET#Test', 'ASSET#Base']
            }],
            messageBus: messageBusMock
        })

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(produce(testEphemeraRecord, ephemeraDBMock.optimisticUpdate.mock.calls[0][0].updateReducer)).toEqual({
            ...testEphemeraKey,
            assets: ['Base', 'TownCenter', 'Test']
        })
        expect(internalCacheMock.Global.set).toHaveBeenCalledWith({ key: 'assets', value: ['Base', 'TownCenter', 'Test'] })
        expect(messageBusMock.send).toHaveBeenCalledTimes(1)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'Perception',
            ephemeraId: 'ASSET#Test'
        })
    })


})