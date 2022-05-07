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
        assetDB.query.mockImplementation(({ scopedId }) => {
            switch(scopedId) {
                case 'layerAWelcomeRoom':
                    return [{
                        AssetId: 'ROOM#123',
                        scopedId: 'layerAWelcomeRoom',
                        defaultAppearances: [{
                            contents: [],
                            render: [': test addition']
                        }]            
                    }]
                case 'hallway':
                    return [{
                        AssetId: 'ROOM#345',
                        scopedId: 'hallway',
                        defaultAppearances: []
                    }]
                case 'outsideWalkway':
                    return [{
                        AssetId: 'ROOM#567',
                        scopedId: 'outsideWalkway',
                        defaultAppearances: [{
                            contents: [],
                            name: "Widow's walk"
                        }]
                    }]
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
})
