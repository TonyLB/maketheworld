import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../serialize/s3Assets.js')
import { getAssets } from '../serialize/s3Assets.js'
jest.mock('../serialize/importedAssets.js')
import { importedAssetIds } from '../serialize/importedAssets.js'
jest.mock('../wml/index.js')
import { assetRegistryEntries } from "../wml/index.js"
jest.mock('./uploadResponse.js')
import uploadResponse from './uploadResponse.js'
jest.mock('../serialize/translateFile.js')
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
jest.mock('../serialize/dbRegister.js')
import { dbRegister } from '../serialize/dbRegister.js'

import { handleUpload } from './index.js'

describe('handleUpload', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should correctly route incoming information', async () => {
        const schemaMock = jest.fn()
        const normalizeMock = jest.fn()
        getAssets.mockResolvedValue({
            schema: schemaMock,
            normalize: normalizeMock
        })
        normalizeMock.mockReturnValue({
            'Import-0': {
                tag: 'Import',
            }
        })
        assetRegistryEntries.mockReturnValue([{
            tag: 'Asset',
            key: 'TestAsset',
            fileName: 'Test'
        },
        {
            tag: 'Room',
            key: 'VORTEX'
        },
        {
            tag: 'Room',
            key: 'test'
        }])
        getTranslateFile.mockResolvedValue({
            scopeMap: {
                test: '123'
            }
        })
        importedAssetIds.mockResolvedValue({
            importTree: ['BASE'],
            scopeMap: {
                VORTEX: 'VORTEX'
            }
        })
        putTranslateFile.mockResolvedValue({})
        await handleUpload({ s3Client: { send: jest.fn() } })({ bucket: 'test', key: 'TestPlayer/Test.wml' })
        const matchS3 = { send: expect.any(Function) }
        expect(getAssets).toHaveBeenCalledWith(matchS3, "TestPlayer/Test.wml")
        expect(getTranslateFile).toHaveBeenCalledWith(
            matchS3,
            {
                name: 'Personal/Test.translate.json'
            }
        )
        expect(putTranslateFile).toHaveBeenCalledWith(
            matchS3,
            {
                assetKey: 'TestAsset',
                name: 'Personal/Test.translate.json',
                importTree: ['BASE'],
                scopeMap: {
                    test: '123',
                    VORTEX: 'VORTEX'
                }
            }
        )
        expect(dbRegister).toHaveBeenCalledWith({
            assets: {
                'Import-0': { tag: 'Import' }
            },
            fileName: 'Personal/Test.wml',
            importTree: ['BASE'],
            scopeMap: {
                VORTEX: 'VORTEX',
                test: '123',
            },
            translateFile: 'Personal/Test.translate.json'
        })
        expect(uploadResponse).toHaveBeenCalledWith({
            messageType: 'Success',
            operation: 'Upload',
            uploadId: 'Test.wml'
        })

    })

})
