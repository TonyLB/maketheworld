jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

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
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Testing' }, children: [] }] },
            exits: [],
            stateMapping: {},
            keyMapping: {}
        },
        {
            DataCategory: 'ASSET#Layer',
            description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }] },
            exits: [],
            stateMapping: {},
            keyMapping: {}
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'Testing' }, children: [] }] },
                exits: [],
                stateMapping: {},
                keyMapping: {}
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                description: { data: { tag: 'Description' }, children: [{ data: { tag: 'String', value: 'TestingTwo' }, children: [] }] },
                exits: [],
                stateMapping: {},
                keyMapping: {}
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            ProjectionFields: ['DataCategory', 'key', 'shortName', 'name', 'summary', 'description', 'exits', 'stateMapping', 'keyMapping']
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentMeta.set('ROOM#TestOne', 'Layer', {
            EphemeraId: 'ROOM#TestOne',
            assetId: 'Layer',
            key: 'testTwo',
            tag: 'Room',
            examples: [{ key: 'base', tag: 'Example' }],
            exits: [],
            stateMapping: {},
            keyMapping: {}
        })
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            tag: 'Room',
            exits: [],
            key: 'test',
            stateMapping: {},
            keyMapping: {}
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                tag: 'Room',
                examples: [{ key: 'test', tag: 'Example' }],
                exits: [],
                key: 'test',
                stateMapping: {},
                keyMapping: {}
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                tag: 'Room',
                examples: [{ key: 'base', tag: 'Example' }],
                exits: [],
                key: 'testTwo',
                stateMapping: {},
                keyMapping: {}
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' }
            ],
            ProjectionFields: ['DataCategory', 'key', 'shortName', 'name', 'summary', 'description', 'exits', 'stateMapping', 'keyMapping']
        })
    })

    it('should default fetches that do not return', async () => {
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            examples: [{ key: 'test', tag: 'Example' }],
            exits: [],
            key: 'test',
            stateMapping: {},
            keyMapping: {}
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                examples: [{ key: 'test', tag: 'Example' }],
                exits: [],
                key: 'test',
                stateMapping: {},
                keyMapping: {}
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                key: '',
                tag: 'Room',
                exits: [],
                stateMapping: {},
                keyMapping: {}
            }
        })
        expect(ephemeraMock.getItems).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItems).toHaveBeenCalledWith({
            Keys: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            ProjectionFields: ['DataCategory', 'key', 'shortName', 'name', 'summary', 'description', 'exits', 'stateMapping', 'keyMapping']
        })
    })

})
