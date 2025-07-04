jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import internalCache from "."
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

const mapToJSON = (data: Record<AssetUUID, StandardComponent>): Record<string, StandardComponentData> => {
    return Object.fromEntries(
        Object.entries(data).map(([assetId, component]) => {
            return [assetId.split('#')[1], component.toJSON()]
        })
    )
}

describe('ComponentMeta', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should send multiple fetches correctly', async () => {
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Testing' }, children: [] }] },
            exits: []
        },
        {
            DataCategory: 'ASSET#Layer',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }] },
            exits: []
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'ASSET#Base',
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Testing' }, children: [] }] },
                exits: []
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'ASSET#Layer',
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }] },
                exits: []
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ]
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentMeta.set('ROOM#TestOne', 'ASSET#Layer', new StandardRoom({
            universalKey: 'ROOM#TestOne',
            key: 'testTwo',
            tag: 'Room',
            examples: [{ key: 'base', tag: 'Example' }],
            exits: [],
        }))
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            tag: 'Room',
            exits: [],
            key: 'test',
            stateMapping: {},
            keyMapping: {}
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                tag: 'Room',
                examples: [{ key: 'test', tag: 'Example' }],
                exits: [],
                key: 'test'
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                tag: 'Room',
                examples: [{ key: 'base', tag: 'Example' }],
                exits: [],
                key: 'testTwo'
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' }
            ]
        })
    })

    it('should default fetches that do not return', async () => {
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            exits: [],
            key: 'test'
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['ASSET#Base', 'ASSET#Layer'])
        expect(mapToJSON(output)).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                examples: [{ key: 'test', tag: 'Example' }],
                exits: [],
                key: 'test'
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                key: '',
                tag: 'Room',
                exits: [],
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ]
        })
    })

})
