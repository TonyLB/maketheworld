import { jest, describe, it, expect } from '@jest/globals'

// jest.mock('sharp', () => ({}))
jest.mock('../serialize/dbRegister')
import { dbRegister } from '../serialize/dbRegister'

jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('../internalCache')
import internalCache from '../internalCache'
jest.mock('../utilities/stream')
import { streamToString } from '../utilities/stream'

const mockSetWML = jest.fn()
const mockLoadWMLFrom = jest.fn()
jest.mock('@tonylb/mtw-asset-workspace/dist/', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
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
                },
                TestAsset: {
                    tag: 'Asset',
                    key: 'TestAsset',
                    fileName: 'Test'
                }
            },
            namespaceIdToDB: {
                test: 'ROOM#123'
            }
        }
    })
})

import { parseWMLMessage } from '.'
import { S3Client } from '@aws-sdk/client-s3'

const messageBusMock = jest.mocked(messageBus, true)
const internalCacheMock = jest.mocked(internalCache, true)
const streamToStringMock = streamToString as jest.Mock

describe('parseWMLMessage', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        const sendMock = jest.fn<(args: any) => Promise<any>>().mockResolvedValue({ Body: 'Test' })
        internalCacheMock.Connection.get.mockResolvedValueOnce('Test').mockResolvedValueOnce({ send: sendMock } as unknown as S3Client)
    })

    it('should correctly route incoming information', async () => {
        streamToStringMock.mockReturnValue(`<Asset key=(Test)></Asset>`)
        await parseWMLMessage({
            payloads: [{
                type: 'ParseWML',
                zone: 'Personal',
                player: 'Test',
                fileName: 'TestFile',
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
                },
                TestAsset: {
                    tag: 'Asset',
                    key: 'TestAsset',
                    fileName: 'Test'
                }
            },
            namespaceIdToDB: {
                test: 'ROOM#123'
            }
        })
        expect(mockLoadWMLFrom).toHaveBeenCalledWith(`upload/TestABC.wml`)
        expect(messageBusMock.send).toHaveBeenCalledWith({
            type: 'ReturnValue',
            body: {
                messageType: 'Success'
            }
        })

    })

})
