import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withGetOperations', () => {
    const dbHandler = new (withGetOperations(DBHandlerBase))({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: {}
    })

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should remap incoming primary key', async () => {
        dbMock.send.mockResolvedValue({ Item: marshall({
            EphemeraId: 'TestOne',
            DataCategory: 'DC1',
            TestValue: 5
        }) })
        const output = await dbHandler.get({ Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'} })
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
            TableName: 'Ephemera',
            ProjectionExpression: 'EphemeraId'
        })
        expect(output).toEqual({
            PrimaryKey: 'TestOne',
            DataCategory: 'DC1',
            TestValue: 5
        })
    })

    it('should replace reserved words with ExpressionAttributeName items', async () => {
        dbMock.send.mockResolvedValue({ Item: marshall({
            EphemeraId: 'TestOne',
            DataCategory: 'DC1',
            test: 3,
            Name: 5,
            Zone: 'personal',
            value: 10,
            key: 'blue'
        }) })
        const output = await dbHandler.get({ Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'}, ProjectionFields: ['test', 'Name', 'Zone', 'value', 'key'] })
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
            TableName: 'Ephemera',
            ProjectionExpression: 'test, #name, #zone, #value, #key',
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#zone': 'Zone',
                '#value': 'value',
                '#key': 'key'
            }
        })
        expect(output).toEqual({
            PrimaryKey: 'TestOne',
            DataCategory: 'DC1',
            test: 3,
            Name: 5,
            Zone: 'personal',
            value: 10,
            key: 'blue'
        })
    })

})