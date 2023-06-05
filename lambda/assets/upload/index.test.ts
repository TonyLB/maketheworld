import { jest, describe, it, expect } from '@jest/globals'

// jest.mock('sharp', () => ({}))
jest.mock('../serialize/dbRegister')
import { dbRegister } from '../serialize/dbRegister'
jest.mock('../selfHealing/player')

jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('../utilities/stream')
import { streamToString } from '../utilities/stream'
jest.mock('../utilities/assets')
import { assetWorkspaceFromAssetId } from '../utilities/assets'
jest.mock('../clients', () => ({ ebClient: { send: jest.fn() } }))

const mockSetWML = jest.fn()
const mockLoadWMLFrom = jest.fn()
const mockAssetWorkspace = (address) => ({
    status: {
        json: 'Dirty'
    },
    address,
    fileNameBase: 'Personal/Test/TestFile',
    loadJSON: jest.fn(),
    loadWML: jest.fn(),
    loadWMLFrom: mockLoadWMLFrom,
    setWML: mockSetWML,
    pushJSON: jest.fn(),
    pushWML: jest.fn(),
    normal: {
        'Import-0': {
            tag: 'Import',
            mapping: {}
        },
        TestAsset: {
            tag: 'Asset',
            key: 'TestAsset',
            fileName: 'Test'
        }
    },
    namespaceIdToDB: {
        test: 'ROOM#123'
    },
    setWorkspaceLookup: jest.fn()
})

import { parseWMLMessage } from '.'
import { S3Client } from '@aws-sdk/client-s3'

const messageBusMock = jest.mocked(messageBus, true)
const internalCacheMock = jest.mocked(internalCache, true)
const streamToStringMock = streamToString as jest.Mock
const assetWorkspaceFromAssetIdMock = assetWorkspaceFromAssetId as jest.Mock

describe('parseWMLMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        const sendMock = jest.fn<(args: any) => Promise<any>>().mockResolvedValue({ Body: 'Test' })
        internalCacheMock.Connection.get.mockResolvedValueOnce('Test').mockResolvedValueOnce({ send: sendMock } as unknown as S3Client)
        assetWorkspaceFromAssetIdMock.mockResolvedValue(mockAssetWorkspace({
            zone: 'Personal',
            player: 'Test',
            fileName: 'TestFile',
        }))
    })

    it('should correctly route incoming information', async () => {
        streamToStringMock.mockReturnValue(`<Asset key=(Test)></Asset>`)
        await parseWMLMessage({
            payloads: [{
                type: 'ParseWML',
                AssetId: 'ASSET#Test',
                uploadName: 'upload/TestABC.wml'
            }],
            messageBus
        })
        expect(dbRegister).toHaveBeenCalledWith({
            status: {
                json: 'Dirty'
            },
            address: {
                zone: 'Personal',
                player: 'Test',
                fileName: 'TestFile',
            },
            fileNameBase: 'Personal/Test/TestFile',
            loadJSON: expect.any(Function),
            loadWML: expect.any(Function),
            loadWMLFrom: expect.any(Function),
            setWML: expect.any(Function),
            pushJSON: expect.any(Function),
            pushWML: expect.any(Function),
            normal: {
                'Import-0': {
                    tag: 'Import',
                    mapping: {}
                },
                TestAsset: {
                    tag: 'Asset',
                    key: 'TestAsset',
                    fileName: 'Test'
                }
            },
            namespaceIdToDB: {
                test: 'ROOM#123'
            },
            setWorkspaceLookup: expect.any(Function)
        })
        expect(mockLoadWMLFrom).toHaveBeenCalledWith(`upload/TestABC.wml`, true)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'ParseWML',
                images: []
            }
        })

    })

})
