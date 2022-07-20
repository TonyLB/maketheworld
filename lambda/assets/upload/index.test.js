import { jest, describe, it, expect } from '@jest/globals'

jest.mock('sharp', () => ({}))
jest.mock('../serialize/s3Assets.js')
import { getAssets } from '../serialize/s3Assets.js'
jest.mock('../serialize/importedAssets.js')
import { importedAssetIds } from '../serialize/importedAssets.js'
jest.mock('./uploadResponse')
import uploadResponse from './uploadResponse'
jest.mock('../serialize/translateFile.js')
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
jest.mock('../serialize/dbRegister.js')
import { dbRegister } from '../serialize/dbRegister.js'

jest.mock('../messageBus')
import messageBus from '../messageBus'

import { handleUpload } from './index.js'

const messageBusMock = jest.mocked(messageBus, true)

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
            normalize: normalizeMock,
            isMatched: jest.fn().mockReturnValue(true)
        })
        normalizeMock.mockReturnValue({
            'Import-0': {
                tag: 'Import',
            },
            TestAsset: {
                key: 'TestAsset',
                tag: 'Asset',
                fileName: 'Test'
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
                scopeMap: {}
            }
        )
        expect(dbRegister).toHaveBeenCalledWith({
            assets: {
                'Import-0': { tag: 'Import' },
                TestAsset: {
                    key: 'TestAsset',
                    tag: 'Asset',
                    fileName: 'Test'
                }
            },
            fileName: 'Personal/Test.wml',
            importTree: ['BASE'],
            scopeMap: {},
            namespaceMap: {
                VORTEX: {
                    key: 'BASE#VORTEX',
                    assetId: 'ROOM#VORTEX'
                }
            },
            translateFile: 'Personal/Test.translate.json'
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'UploadResponse',
            messageType: 'Success',
            uploadId: 'Test.wml'
        })

    })

})
