import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@aws-sdk/client-s3')
import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
jest.mock('../serialize/s3Assets')
import { getAssets } from '../serialize/s3Assets'
jest.mock('../serialize/importedAssets.js')
import { importedAssetIds } from '../serialize/importedAssets.js'
jest.mock('@tonylb/mtw-wml/dist/')
jest.mock('../serialize/translateFile.js')
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
jest.mock('../serialize/dbRegister.js')
import { dbRegister } from '../serialize/dbRegister.js'
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('../internalCache')
import internalCache from '../internalCache'

import { moveAssetMessage } from '.'

const getAssetsMock = getAssets as jest.Mock
const getTranslateFileMock = getTranslateFile as jest.Mock
const importedAssetIdsMock = importedAssetIds as jest.Mock
const putTranslateFileMock = putTranslateFile as jest.Mock
const messageBusMock = jest.mocked(messageBus)
const internalCacheMock = jest.mocked(internalCache, true)

describe('moveAsset', () => {
    const schemaMock = jest.fn()
    const normalizeMock = jest.fn()
    const wmlPropMock = jest.fn()
    const wmlRemovePropMock = jest.fn()
    const searchMockReturn = {
        prop: wmlPropMock,
        removeProp: wmlRemovePropMock
    }
    wmlPropMock.mockReturnValue(searchMockReturn)
    wmlRemovePropMock.mockReturnValue(searchMockReturn)
    const searchMock = jest.fn().mockReturnValue(searchMockReturn)
    const wmlQueryMock = {
        search: searchMock
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should correctly move asset files and update DB', async () => {
        internalCacheMock.Connection.get.mockResolvedValue({ send: jest.fn() } as any)
        getAssetsMock.mockResolvedValue({
            schema: schemaMock,
            normalize: normalizeMock,
            contents: jest.fn().mockReturnValue('Test'),
            wmlQuery: wmlQueryMock
        })
        normalizeMock.mockReturnValue({
            'Import-0': {
                tag: 'Import',
            },
            Test: {
                tag: 'Asset'
            }
        })
        getTranslateFileMock.mockResolvedValue({
            scopeMap: {
                test: '123'
            }
        })
        importedAssetIdsMock.mockResolvedValue({
            importTree: ['BASE'],
            scopeMap: {
                VORTEX: 'VORTEX'
            },
            namespaceMap: { VORTEX: 'BASE#VORTEX' }
        })
        putTranslateFileMock.mockResolvedValue({})
        await moveAssetMessage({
            payloads: [{
                type: 'MoveAsset',
                fromPath: 'Personal/',
                fileName: 'Test',
                toPath: 'Library/'    
            }],
            messageBus
        })
        const matchS3 = { send: expect.any(Function) }
        expect(getAssetsMock).toHaveBeenCalledWith(matchS3, "Personal/Test.wml")
        expect(searchMock).toHaveBeenCalledWith('Asset, Character, Story')
        expect(wmlPropMock).toHaveBeenCalledWith('zone', 'Library')
        expect(wmlPropMock).toHaveBeenCalledWith('subFolder', '/Assets')
        expect(wmlRemovePropMock).toHaveBeenCalledWith('player')
        expect(getTranslateFileMock).toHaveBeenCalledWith(matchS3, { name: 'Personal/Test.translate.json' })
        expect(CopyObjectCommand).toHaveBeenCalledWith({
            CopySource: 'undefined/Personal/Test.translate.json',
            Key: 'Library/Assets/Test.translate.json'
        })
        expect(PutObjectCommand).toHaveBeenCalledWith({
            Key: 'Library/Assets/Test.wml',
            Body: 'Test'
        })
        expect(dbRegister).toHaveBeenCalledWith({
            assets: {
                'Import-0': { tag: 'Import' },
                Test: { tag: 'Asset' }
            },
            fileName: 'Library/Assets/Test.wml',
            importTree: ['BASE'],
            scopeMap: {
                VORTEX: 'VORTEX',
            },
            namespaceMap: { VORTEX: 'BASE#VORTEX' },
            translateFile: 'Library/Assets/Test.translate.json'
        })
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
            Key: 'Personal/Test.wml'
        })
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
            Key: 'Personal/Test.translate.json'
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: { messageType: 'Success' }
        })
    })

})
