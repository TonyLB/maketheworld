jest.mock('../clients')
import { snsClient } from "../clients"
jest.mock('@tonylb/mtw-asset-workspace/dist/readOnly', () => {
    return jest.fn().mockImplementation((address: any) => {
        return {
            status: {
                json: 'Clean'
            },
            address,
            get fileNameBase() {
                if (address.zone === 'Personal') {
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
            namespaceIdToDB: [
                { internalKey: 'VORTEX', universalKey: 'ROOM#VORTEX' }
            ]
        }
    })
})

jest.mock('../internalCache')
import internalCache from "../internalCache"

import returnValueMessage from './index'

const snsClientMock = snsClient as jest.Mocked<typeof snsClient>
const internalCacheMock = jest.mocked(internalCache)

describe('ReturnValueMessage', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        
        // Mock the internalCache.Connection.get method to return different values based on the key
        internalCacheMock.Connection.get.mockImplementation((key: string) => {
            if (key === 'connectionId') {
                return Promise.resolve("TestConnection")
            } else if (key === 'RequestId') {
                return Promise.resolve("TestRequestId")
            }
            return Promise.resolve(undefined)
        })
    })

    it('should call snsClient with Targets format for registered connectionId', async () => {
        await returnValueMessage({
            payloads: [{
                type: 'ReturnValue',
                body: {
                    result: 'ActionSuccessful'
                }
            }]
        })
        
        // Check the message content
        expect((snsClientMock.send.mock.calls[0][0].input as any).Message).toEqual('{"result":"ActionSuccessful"}')
        
        // Check the Targets format in MessageAttributes
        const messageAttributes = (snsClientMock.send.mock.calls[0][0].input as any).MessageAttributes
        expect(messageAttributes.Targets.DataType).toEqual('String.Array')
        expect(messageAttributes.Targets.StringValue).toEqual('["CONNECTION#TestConnection"]')
        
        // Check other required attributes
        expect(messageAttributes.RequestId.DataType).toEqual('String')
        expect(messageAttributes.RequestId.StringValue).toEqual('TestRequestId')
        expect(messageAttributes.Type.DataType).toEqual('String')
        expect(messageAttributes.Type.StringValue).toEqual('Success')
    })
})