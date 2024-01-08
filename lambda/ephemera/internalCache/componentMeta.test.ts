jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

import internalCache from "."

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('ComponentMeta', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should send multiple fetches correctly', async () => {
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            name: [],
            render: [{ data: { tag: 'String', value: 'Testing' }, children: [] }],
            exits: [],
        },
        {
            DataCategory: 'ASSET#Layer',
            name: [],
            render: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }],
            exits: [],
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                name: [],
                render: [{ data: { tag: 'String', value: 'Testing' }, children: [] }],
                exits: [],
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                name: [],
                render: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }],
                exits: []
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            ProjectionFields: ['DataCategory', 'key', 'name', 'render', 'exits']
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentMeta.set('ROOM#TestOne', 'Layer', {
            EphemeraId: 'ROOM#TestOne',
            assetId: 'Layer',
            key: 'testTwo',
            name: [],
            render: [{ data: { tag: "String", value: 'TestingTwo' }, children: [] }],
            exits: []
        })
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            appearances: [{
                name: [],
                render: [{ data: { tag: 'String', value: 'Testing' }, children: [] }],
                exits: [],
                conditions: []
            }],
            key: 'test'
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                name: [],
                render: [{ data: { tag: 'String', value: 'Testing' }, children: [] }],
                exits: [],
                key: 'test'
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                appearances: [{
                    name: [],
                    render: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }],
                    exits: [],
                    conditions: []
                }],
                key: 'testTwo'
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' }
            ],
            ProjectionFields: ['DataCategory', 'key', 'name', 'render', 'exits']
        })
    })

    it('should default fetches that do not return', async () => {
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            name: [],
            render: [{ data: { tag: 'String', value: 'Testing' }, children: [] }],
            exits: [],
            key: 'test'
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                name: [],
                render: [{ data: { tag: 'String', value: 'Testing' }, children: [] }],
                exits: [],
                key: 'test'
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                key: '',
                name: [],
                render: [],
                exits: []
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            ProjectionFields: ['DataCategory', 'appearances', 'key']
        })
    })

})
