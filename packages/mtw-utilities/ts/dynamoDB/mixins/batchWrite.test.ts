import { DBHandlerBase } from '../baseClasses'
import withBatchWrite from './batchWrite'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withBatchOperations', () => {
    const dbHandler = new (withBatchWrite<'PrimaryKey', string>()(DBHandlerBase))({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { writeBatchSize: 3 }
    })

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should remap incoming primary key', async () => {
        await dbHandler.batchWriteDispatcher([
            { PutRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC1'} },
            { DeleteRequest: { PrimaryKey: 'TestTwo', DataCategory: 'DC2'} }
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            RequestItems: {
                Ephemera: [
                    { PutRequest: { Item: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}) } },
                    { DeleteRequest: { Key: marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'}) } },
                ]
            }
        })
    })

    it('should batch by batchsize', async () => {
        await dbHandler.batchWriteDispatcher([
            { PutRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC1'} },
            { DeleteRequest: { PrimaryKey: 'TestTwo', DataCategory: 'DC2'} },
            { PutRequest: { PrimaryKey: 'TestThree', DataCategory: 'DC3'} },
            { PutRequest: { PrimaryKey: 'TestFour', DataCategory: 'DC4'} }
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(2)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            RequestItems: {
                Ephemera: [
                    { PutRequest: { Item: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}) } },
                    { DeleteRequest: { Key: marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'}) } },
                    { PutRequest: { Item: marshall({ EphemeraId: 'TestThree', DataCategory: 'DC3'}) } }
                ]
            }
        })
        expect(dbMock.send.mock.calls[1][0].input).toEqual({
            RequestItems: {
                Ephemera: [ { PutRequest: { Item: marshall({ EphemeraId: 'TestFour', DataCategory: 'DC4'}) } } ]
            }
        })
    })

})