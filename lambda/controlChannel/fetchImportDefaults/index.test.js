import { jest, describe, it, expect } from '@jest/globals'

import { assetDB } from '/opt/utilities/dynamoDB/index.js'
import { sortImportTree } from '/opt/utilities/executeCode/sortImportTree.js'

import fetchImportDefaults, { getTranslateMapsFromAssetInfoReducer } from './index.js'

describe('getTranslateMapsFromAssetInfoReducer', () => {
    it('should create mapping tables correctly', () => {
        const importAssets = {
            LayerA: {
                welcomeRoom: 'layerAWelcomeRoom',
                hallway: 'hallway'
            },
            LayerB: {
                walkway: 'outsideWalkway'
            }
        }
        const assetInfo = [{
            assetId: 'LayerA',
            assetInfo: {
                layerAWelcomeRoom: {
                    AssetId: 'ROOM#123',
                    defaultAppearances: [{
                        contents: [],
                        render: [': test addition']
                    }]            
                },
                hallway: {
                    AssetId: 'ROOM#345',
                    defaultAppearances: []
                }
            }
        },
        {
            assetId: 'LayerB',
            assetInfo: {
                outsideWalkway: {
                    AssetId: 'ROOM#567',
                    defaultAppearances: [{
                        contents: [],
                        name: "Widow's walk"
                    }]
                }
            }
        }]
        const initialValue = {
            itemIdByLocalId: {},
            localIdsByItemId: {},
            finalDefaultAppearanceByLocalId: {}
        }
        expect(assetInfo.reduce(getTranslateMapsFromAssetInfoReducer(importAssets), initialValue)).toEqual({
            itemIdByLocalId: {
                welcomeRoom: 'ROOM#123',
                hallway: 'ROOM#345',
                walkway: 'ROOM#567'
            },
            localIdsByItemId: {
                ['ROOM#123']: ['welcomeRoom'],
                ['ROOM#345']: ['hallway'],
                ['ROOM#567']: ['walkway']
            },
            finalDefaultAppearanceByLocalId: {
                welcomeRoom: [{
                    contents: [],
                    render: [': test addition']
                }],
                hallway: [],
                walkway: [{
                    contents: [],
                    name: "Widow's walk"
                }]
            }
        })
    })
})

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
                        importTree: { BASE: {} }
                    }
                case 'ASSET#LayerB':
                    return {
                        AssetId: 'ASSET#LayerA',
                        importTree: { test: { BASE: {} } }
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
        }])
        const output = await fetchImportDefaults({
            LayerA: {
                welcomeRoom: 'layerAWelcomeRoom',
                hallway: 'hallway'
            },
            LayerB: {
                walkway: 'outsideWalkway'
            }
        })
        expect(assetDB.getItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#LayerA',
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['importTree']
        })
        expect(assetDB.getItem).toHaveBeenCalledWith({
            AssetId: 'ASSET#LayerB',
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['importTree']
        })
        expect(sortImportTree).toHaveBeenCalledWith({
            LayerA: { BASE: {} },
            LayerB: { test: { BASE: {} }}
        })
        const queryArgs = (scopedId, assetId) => ({
            IndexName: 'ScopedIdIndex',
            scopedId,
            KeyConditionExpression: 'DataCategory = :dc',
            ExpressionAttributeValues: {
                ':dc': `ASSET#${assetId}`
            },
            ProjectionFields: ['AssetId', 'defaultAppearances']
        })
        expect(assetDB.query).toHaveBeenCalledWith(queryArgs('layerAWelcomeRoom', 'LayerA'))
        expect(assetDB.query).toHaveBeenCalledWith(queryArgs('hallway', 'LayerA'))
        expect(assetDB.query).toHaveBeenCalledWith(queryArgs('outsideWalkway', 'LayerB'))
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
                DataCategory: `ASSET#BASE`
            },
            {
                AssetId: 'ROOM#567',
                DataCategory: `ASSET#test`
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
