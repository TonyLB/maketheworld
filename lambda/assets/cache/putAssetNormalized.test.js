import { jest, expect } from '@jest/globals'

jest.mock('mtw-utilities/dynamoDB/index.js')
import { ephemeraDB } from 'mtw-utilities/dynamoDB/index.js'

import putAssetNormalized from './putAssetNormalized.js'

describe('putAssetNormalized', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })
    it('should put a passed normalForm', async () => {
        const topLevelAppearance = {
            contextStack: [{ key: 'test', tag: 'Asset', index: 0}],
            contents: [],
            errors: [],
            props: {}
        }
    
        const testNormalForm = {
            test: {
                key: 'test',
                tag: 'Asset',
                fileName: 'test',
                appearances: [{
                    contextStack: [],
                    errors: [],
                    props: {},
                    contents: [{
                        key: 'MNO',
                        tag: 'Room',
                        index: 0
                    },
                    {
                        key: 'TestMap',
                        tag: 'Map',
                        index: 0
                    }]
                }]
            },
            MNO: {
                key: 'MNO',
                EphemeraId: 'ROOM#PQR',
                tag: 'Room',
                name: 'Wherever',
                appearances: [{
                    ...topLevelAppearance,
                    render: [],
                    contents: [],
                },
                {
                    contextStack: [{ key: 'test', tag: 'Asset', index: 0 }, { key: 'TestMap', tag: 'Map', index: 0 }],
                    errors: [],
                    props: {},
                    contents: []
                }]
            },
            TestMap: {
                key: 'TestMap',
                tag: 'Map',
                EphemeraId: 'MAP#TEST',
                appearances: [{
                    ...topLevelAppearance,
                    contents: [{
                        key: 'MNO',
                        tag: 'Room',
                        index: 0
                    }],
                    rooms: {
                        MNO: { x: 300, y: 200 }
                    }
                }]
            }
        }
        await putAssetNormalized({
            assetId: 'BASE',
            normalForm: testNormalForm
        })
        expect(ephemeraDB.putItem).toHaveBeenCalledWith({
            EphemeraId: 'ASSET#BASE',
            DataCategory: 'Meta::AssetNormalized',
            normalForm: testNormalForm
        })
    })
})