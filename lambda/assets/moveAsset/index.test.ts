import { jest, describe, it, expect } from '@jest/globals'

jest.mock('@aws-sdk/client-s3')
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
jest.mock('../serialize/dbRegister.js')
import { dbRegister } from '../serialize/dbRegister.js'
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('@tonylb/mtw-asset-workspace', () => {
    return jest.fn().mockImplementation(({ zone }: any) => {
        return {
            status: {
                json: 'Clean'
            },
            get fileNameBase() {
                if (zone === 'Personal') {
                    return 'Personal/Test/Test'
                }
                else {
                    return 'Library/Test'
                }
            },
            loadJSON: jest.fn(),
            normal: {
                'Import-0': {
                    tag: 'Import',
                },
                Test: {
                    tag: 'Asset'
                }
            },
            namespaceIdToDB: {
                VORTEX: 'VORTEX'
            }
        }
    })
})
import AssetWorkspace from '@tonylb/mtw-asset-workspace'

import { moveAssetMessage } from '.'

const AssetWorkspaceMock = AssetWorkspace as jest.Mocked<typeof AssetWorkspace>
const messageBusMock = jest.mocked(messageBus)
const internalCacheMock = jest.mocked(internalCache, true)

describe('moveAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should correctly move asset files and update DB', async () => {
        internalCacheMock.Connection.get.mockResolvedValue({ send: jest.fn() } as any)
        await moveAssetMessage({
            payloads: [{
                type: 'MoveAsset',
                from: {
                    zone: 'Personal',
                    player: 'Test',
                    fileName: 'Test'
                },
                to: {
                    zone: 'Library',
                    fileName: 'Test'
                }
            }],
            messageBus
        })
        expect(AssetWorkspaceMock).toHaveBeenCalledWith({
            zone: 'Personal',
            player: 'Test',
            fileName: 'Test'
        })
        expect(AssetWorkspaceMock).toHaveBeenCalledWith({
            zone: 'Library',
            fileName: 'Test'
        })
        expect(CopyObjectCommand).toHaveBeenCalledWith({
            CopySource: 'undefined/Personal/Test/Test.json',
            Key: 'Library/Test.json'
        })
        expect(CopyObjectCommand).toHaveBeenCalledWith({
            CopySource: 'undefined/Personal/Test/Test.wml',
            Key: 'Library/Test.wml'
        })
        expect(dbRegister).toHaveBeenCalledWith({
            assets: {
                'Import-0': { tag: 'Import' },
                Test: { tag: 'Asset' }
            },
            fileName: 'Library/Test.wml',
            importTree: [],
            scopeMap: {
                VORTEX: 'VORTEX',
            },
            namespaceMap: {},
            translateFile: 'Library/Test.json'
        })
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
            Key: 'Personal/Test/Test.wml'
        })
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
            Key: 'Personal/Test/Test.json'
        })
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: { messageType: 'Success' }
        })
    })

})
