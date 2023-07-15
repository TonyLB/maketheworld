jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { nonLegacyEphemeraDB as ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

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
            appearances: [{
                name: [],
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
                name: [],
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
                    name: [],
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
                    name: [],
                    render: [{
                        tag: 'String',
                        value: 'TestingTwo'
                    }],
                    exits: [],
                    conditions: []
                }]
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

    it('should send already cached items', async () => {
        internalCache.ComponentMeta.set('ROOM#TestOne', 'Layer', {
            EphemeraId: 'ROOM#TestOne',
            assetId: 'Layer',
            key: 'testTwo',
            appearances: [{
                name: [],
                render: [{
                    tag: "String",
                    value: 'TestingTwo'
                }],
                exits: [],
                conditions: []
            }]
        })
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            appearances: [{
                name: [],
                render: [{
                    tag: 'String',
                    value: 'Testing'
                }],
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
                appearances: [{
                    name: [],
                    render: [{
                        tag: 'String',
                        value: 'Testing'
                    }],
                    exits: [],
                    conditions: []
                }],
                key: 'test'
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                appearances: [{
                    name: [],
                    render: [{
                        tag: 'String',
                        value: 'TestingTwo'
                    }],
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
            ProjectionFields: ['DataCategory', 'appearances', 'key']
        })
    })

    it('should default fetches that do not return', async () => {
        ephemeraMock.getItems.mockResolvedValue([{
            DataCategory: 'ASSET#Base',
            appearances: [{
                name: [],
                render: [{
                    tag: 'String',
                    value: 'Testing'
                }],
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
                appearances: [{
                    name: [],
                    render: [{
                        tag: 'String',
                        value: 'Testing'
                    }],
                    exits: [],
                    conditions: []
                }],
                key: 'test'
            },
            Layer: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Layer',
                appearances: [],
                key: ''
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
