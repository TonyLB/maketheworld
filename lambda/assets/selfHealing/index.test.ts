import { jest, describe, it, expect } from '@jest/globals'

jest.mock('../serialize/dbRegister')
import { dbRegister } from '../serialize/dbRegister'
jest.mock('@tonylb/mtw-asset-workspace/dist', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            fileNameBase: 'Personal/Test/healTest',
            loadJSON: jest.fn(),
            loadWML: jest.fn(),
            pushJSON: jest.fn(),
            normal: {
                'Import-0': {
                    tag: 'Import',
                    mapping: {}
                },
                TestAsset: {
                    tag: 'Asset',
                    key: 'TestAsset'
                }
            },
            namespaceIdToDB: {
                test: 'ROOM#123'
            },
            setWorkspaceLookup: jest.fn()
        }
    }),
    parseAssetWorkspaceAddress: jest.fn().mockReturnValue({
        zone: 'Personal',
        player: 'Test',
        fileName: 'healTest.wml'
    }),
}))
jest.mock('../clients', () => ({ sfnClient: { send: jest.fn() } }))

import { healAsset } from '.'

describe('healAsset', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should correctly register an asset file', async () => {
        await healAsset(
            'Personal/Test/healTest.wml'
        )
        expect(dbRegister).toHaveBeenCalledWith({
            status: {
                json: 'Clean'
            },
            address: {
                zone: 'Personal',
                player: 'Test',
                fileName: 'healTest.wml'
            },
            loadJSON: expect.any(Function),
            loadWML: expect.any(Function),
            pushJSON: expect.any(Function),
            fileNameBase: "Personal/Test/healTest",
            normal: {
                'Import-0': {
                    tag: 'Import',
                    mapping: {}
                },
                TestAsset: {
                    tag: 'Asset',
                    key: 'TestAsset'
                }
            },
            namespaceIdToDB: {
                test: 'ROOM#123'
            },
            setWorkspaceLookup: expect.any(Function)
        })
    })

})
