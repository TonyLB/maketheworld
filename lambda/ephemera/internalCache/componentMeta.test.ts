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
        ephemeraMock.batchGetItem.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            appearances: [{
                name: '',
                render: [{
                    tag: 'String',
                    value: 'Testing'
                }],
                exits: [],
                conditions: []
            }]
        },
        {
            DataCategory: 'ASSET#Layer',
            appearances: [{
                name: '',
                render: [{
                    tag: 'String',
                    value: 'TestingTwo'
                }],
                exits: [],
                conditions: []
            }]
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [{
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'Testing'
                    }],
                    exits: [],
                    conditions: []
                }]
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                appearances: [{
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'TestingTwo'
                    }],
                    exits: [],
                    conditions: []
                }]
            }
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledWith({
            Items: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            ProjectionFields: ['DataCategory', 'appearances']
        })
    })

    it('should send already cached items', async () => {
        internalCache.ComponentMeta.set('ROOM#TestOne', 'Layer', {
            EphemeraId: 'ROOM#TestOne',
            assetId: 'Layer',
            appearances: [{
                name: '',
                render: [{
                    tag: "String",
                    value: 'TestingTwo'
                }],
                exits: [],
                conditions: []
            }]
        })
        ephemeraMock.batchGetItem.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            appearances: [{
                name: '',
                render: [{
                    tag: 'String',
                    value: 'Testing'
                }],
                exits: [],
                conditions: []
            }]
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [{
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'Testing'
                    }],
                    exits: [],
                    conditions: []
                }]
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                appearances: [{
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'TestingTwo'
                    }],
                    exits: [],
                    conditions: []
                }]
            }
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledWith({
            Items: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' }
            ],
            ProjectionFields: ['DataCategory', 'appearances']
        })
    })

    it('should default fetches that do not return', async () => {
        ephemeraMock.batchGetItem.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            appearances: [{
                name: '',
                render: [{
                    tag: 'String',
                    value: 'Testing'
                }],
                exits: [],
                conditions: []
            }]
        }])
        const output = await internalCache.ComponentMeta.getAcrossAssets('ROOM#TestOne', ['Base', 'Layer'])
        expect(output).toEqual({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [{
                    name: '',
                    render: [{
                        tag: 'String',
                        value: 'Testing'
                    }],
                    exits: [],
                    conditions: []
                }]
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                appearances: []
            }
        })
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.batchGetItem).toHaveBeenCalledWith({
            Items: [
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Base' },
                { EphemeraId: 'ROOM#TestOne', DataCategory: 'ASSET#Layer' }
            ],
            ProjectionFields: ['DataCategory', 'appearances']
        })
    })

})
