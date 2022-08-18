import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@aws-sdk/client-s3')
jest.mock('../serialize/s3Assets')
import { getAssets } from '../serialize/s3Assets'
jest.mock('../serialize/importedAssets.js')
import { importedAssetIds } from '../serialize/importedAssets.js'
jest.mock('../serialize/translateFile.js')
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
jest.mock('../serialize/dbRegister.js')
import { dbRegister } from '../serialize/dbRegister.js'

import { healAsset } from './index.js'

describe('healAsset', () => {
    const schemaMock = jest.fn()
    const normalizeMock = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should correctly register an asset file', async () => {
        getAssets.mockResolvedValue({
            schema: schemaMock,
            normalize: normalizeMock,
            contents: jest.fn().mockReturnValue('Test'),
            valid: true,
            assetId: 'Test'
        })
        normalizeMock.mockReturnValue({
            'Import-0': {
                tag: 'Import',
            },
            TestAsset: {
                tag: 'Asset',
                key: 'TestAsset'
            }
        })
        getTranslateFile.mockResolvedValue({
            scopeMap: {
                test: 'ROOM#123'
            }
        })
        importedAssetIds.mockResolvedValue({
            importTree: ['BASE'],
            scopeMap: {
                VORTEX: 'ROOM#VORTEX'
            },
            namespaceMap: {
                VORTEX: {
                    key: 'BASE#VORTEX',
                    assetId: 'ROOM#VORTEX'
                }
            }
        })
        putTranslateFile.mockResolvedValue({})
        await healAsset(
            { s3Client: { send: jest.fn() } },
            'Personal/healTest.wml'
        )
        const matchS3 = { send: expect.any(Function) }
        expect(getAssets).toHaveBeenCalledWith(matchS3, "Personal/healTest.wml")
        expect(getTranslateFile).toHaveBeenCalledWith(matchS3, { name: 'Personal/healTest.translate.json' })
        expect(putTranslateFile).toHaveBeenCalledWith(matchS3, {
            assetKey: 'TestAsset',
            importTree: ['BASE'],
            name: 'Personal/healTest',
            scopeMap: {}
        })
        expect(dbRegister).toHaveBeenCalledWith({
            assets: {
                'Import-0': { tag: 'Import' },
                TestAsset: {
                    tag: 'Asset',
                    key: 'TestAsset'
                }
            },
            fileName: 'Personal/healTest.wml',
            importTree: ['BASE'],
            scopeMap: {},
            namespaceMap: {
                VORTEX: {
                    key: 'BASE#VORTEX',
                    assetId: 'ROOM#VORTEX'
                }
            },
            translateFile: 'Personal/healTest.translate.json'
        })
    })

})
