import { jest, describe, it, expect } from '@jest/globals'

import { assetDB } from '/opt/utilities/dynamoDB/index.js'
import { sortImportTree } from '/opt/utilities/executeCode/sortImportTree.js'

import fetchImportDefaults from './index.js'

describe('fetchImportDefaults', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should fetch importTree from assets and rooms from all ancestor imports', async () => {
        assetDB.getItem.mockImplementation(({ AssetId }) => {
            switch(AssetId) {
                case 'ASSET#LayerA':
                    return {
                        AssetId: 'ASSET#LayerA',
                        importTree: { BASE: {} },
                        namespaceMap: {
                            layerAWelcomeRoom: { key: 'BASE#welcome', assetId: 'ROOM#123' },
                            hallway: { key: 'BASE#passage', assetId: 'ROOM#345' }
                        }
                    }
                case 'ASSET#LayerB':
                    return {
                        AssetId: 'ASSET#LayerA',
                        importTree: { test: { BASE: {} } },
                        namespaceMap: {
                            outsideWalkway: { key: 'test#outsideWalkway', assetId: 'ROOM#567' }
                        }
                    }
                case 'ASSET#Final':
                    return {
                        AssetId: 'ASSET#LayerA',
                        importTree: {
                            LayerA: { BASE: {} },
                            LayerB: { test: { BASE: {} } }
                        },
                        namespaceMap: {
                            welcomeRoom: { key: 'BASE#welcome', assetId: 'ROOM#123' },
                            hallway: { key: 'BASE#passage', assetId: 'ROOM#345' },
                            walkway: { key: 'test#outsideWalkway', assetId: 'ROOM#567' }
                        }
                    }                    
            }
        })
        sortImportTree.mockImplementation((tree) => {
            if (tree.LayerA) {
                return ['BASE', 'test', 'LayerA', 'LayerB']
            }
            if (tree.BASE) {
                return ['BASE']
            }
            if (tree.test) {
                return ['BASE', 'test']
            }
        })

        assetDB.batchGetItem.mockResolvedValue([{
            AssetId: 'ROOM#123',
            DataCategory: 'ASSET#BASE',
            defaultAppearances: [{
                contents: [],
                render: ['Test description']
            }]
        },
        {
            AssetId: 'ROOM#345',
            DataCategory: 'ASSET#BASE',
            defaultAppearances: [{
                contents: [],
                name: 'passage',
                render: ['Test']
            }]
        },
        {
            AssetId: 'ROOM#567',
            DataCategory: 'ASSET#test',
            defaultAppearances: [{
                contents: [],
                name: "Widow's walk"
            }]
        },
        {
            AssetId: 'ROOM#123',
            DataCategory: 'ASSET#LayerA',
            defaultAppearances: [{
                contents: [],
                render: [': test addition']
            }]
        },
        {
            AssetId: 'ROOM#345',
            DataCategory: 'ASSET#LayerA',
            defaultAppearances: []
        },
        {
            AssetId: 'ROOM#567',
            DataCategory: 'ASSET#LayerB',
            defaultAppearances: []            
        }])
        const output = await fetchImportDefaults({
            importsByAssetId: {
                LayerA: {
                    welcomeRoom: 'layerAWelcomeRoom',
                    hallway: 'hallway'
                },
                LayerB: {
                    walkway: 'outsideWalkway'
                }
            },
            assetId: 'Final'
        })
        expect(assetDB.getItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#LayerA',
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['importTree', 'namespaceMap', 'defaultNames', 'defaultExits']
        })
        expect(assetDB.getItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#LayerB',
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['importTree', 'namespaceMap', 'defaultNames', 'defaultExits']
        })
        expect(sortImportTree).toHaveBeenCalledWith({
            LayerA: { BASE: {} },
            LayerB: { test: { BASE: {} }}
        })
        expect(assetDB.batchGetItem).toHaveBeenCalledWith({
            Items: [{
                AssetId: 'ROOM#123',
                DataCategory: `ASSET#BASE`
            },
            {
                AssetId: 'ROOM#345',
                DataCategory: `ASSET#BASE`
            },
            {
                AssetId: 'ROOM#567',
                DataCategory: `ASSET#test`
            },
            {
                AssetId: 'ROOM#123',
                DataCategory: `ASSET#LayerA`
            },
            {
                AssetId: 'ROOM#345',
                DataCategory: `ASSET#LayerA`
            },
            {
                AssetId: 'ROOM#567',
                DataCategory: `ASSET#LayerB`
            }],
            ProjectionFields: ['AssetId', 'DataCategory', 'defaultAppearances']
        })
        expect(output).toEqual({
            welcomeRoom: {
                render: ['Test description', ': test addition']
            },
            hallway: {
                name: 'passage',
                render: ['Test']
            },
            walkway: {
                name: "Widow's walk"
            }
        })
    })

    //
    // TODO: Create unit test for Map inheritance, which should be treated differently
    // from component inheritance (see index.js file comments)
    //

    it('should create successive inherited layers for imported maps', async () => {
        assetDB.getItem.mockImplementation(({ AssetId }) => {
            console.log(`Fetching: ${AssetId}`)
            switch(AssetId) {
                case 'ASSET#BASE':
                    return {
                        AssetId: 'ASSET#BASE',
                        importTree: {},
                        namespaceMap: {
                            welcome: { key: 'BASE#welcome', assetId: 'ROOM#123' },
                            passage: { key: 'BASE#passage', assetId: 'ROOM#345' },
                            house: { key: 'BASE#house', assetId: 'MAP#XYZ' }
                        },
                        defaultNames: {
                            welcome: { name: 'First', tag: 'Room' },
                            passage: { name: 'A', tag: 'Room' }
                        },
                        defaultExits: [{
                            name: 'passage',
                            from: 'welcome',
                            to: 'passage'
                        }]
                    }
                case 'ASSET#LayerA':
                    return {
                        AssetId: 'ASSET#LayerA',
                        importTree: { BASE: {} },
                        namespaceMap: {
                            layerAWelcomeRoom: { key: 'BASE#welcome', assetId: 'ROOM#123' },
                            hallway: { key: 'BASE#passage', assetId: 'ROOM#345' },
                            house: { key: 'BASE#house', assetId: 'MAP#XYZ' }
                        },
                        defaultNames: {
                            layerAWelcomeRoom: { name: 'Second', tag: 'Room' },
                            hallway: { name: 'B', tag: 'Room' }
                        },
                        defaultExits: [{
                            name: 'welcome',
                            from: 'hallway',
                            to: 'layerAWelcomeRoom'
                        }]
                    }
                case 'ASSET#Final':
                    return {
                        AssetId: 'ASSET#Final',
                        importTree: {
                            LayerA: { BASE: {} }
                        },
                        namespaceMap: {
                            welcomeRoom: { key: 'BASE#welcome', assetId: 'ROOM#123' },
                            house: { key: 'BASE#house', assetId: 'MAP#XYZ' }
                        },
                        defaultNames: {},
                        defaultExits: []
                    }                    
            }
        })
        sortImportTree.mockImplementation((tree) => {
            if (tree.LayerA) {
                return ['BASE', 'LayerA']
            }
            if (tree.BASE) {
                return ['BASE']
            }
        })

        assetDB.batchGetItem.mockResolvedValue([{
            AssetId: 'ROOM#123',
            DataCategory: 'ASSET#BASE',
            defaultAppearances: [{
                contents: [],
                name: 'First',
                render: ['Test description']
            }]
        },
        {
            AssetId: 'ROOM#123',
            DataCategory: 'ASSET#LayerA',
            defaultAppearances: [{
                contents: [],
                name: 'Second',
                render: [': test addition']
            }]
        },
        {
            AssetId: 'MAP#XYZ',
            DataCategory: 'ASSET#BASE',
            defaultAppearances: [{
                rooms: {
                    welcome: {
                        x: 0,
                        y: 0
                    }
                }
            }]
        },
        {
            AssetId: 'MAP#XYZ',
            DataCategory: 'ASSET#LayerA',
            defaultAppearances: [{
                rooms: {
                    layerAWelcomeRoom: {
                        x: 100,
                        y: 0
                    },
                    hallway: {
                        x: -100,
                        y: 0
                    }
                }
            }]
        }])
        const output = await fetchImportDefaults({
            importsByAssetId: {
                LayerA: {
                    welcomeRoom: 'layerAWelcomeRoom',
                    house: 'house'
                }
            },
            assetId: 'Final'
        })
        expect(output).toEqual({
            welcomeRoom: {
                name: 'FirstSecond',
                render: ['Test description', ': test addition']
            },
            house: {
                layers: [{
                    rooms: {
                        welcomeRoom: {
                            name: 'First',
                            x: 0,
                            y: 0
                        }
                    },
                    exits: []
                },
                {
                    rooms: {
                        welcomeRoom: {
                            name: 'FirstSecond',
                            x: 100,
                            y: 0
                        },
                        'BASE#passage': {
                            name: 'AB',
                            x: -100,
                            y: 0
                        }
                    },
                    exits: [{
                        name: 'passage',
                        to: 'BASE#passage',
                        from: 'welcomeRoom'
                    },
                    {
                        name: 'welcome',
                        to: 'welcomeRoom',
                        from: 'BASE#passage'
                    }]
                }]
            }
        })
    })
})
