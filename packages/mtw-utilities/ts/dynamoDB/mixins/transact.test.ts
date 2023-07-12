import { DBHandlerBase } from '../baseClasses'
import withTransactions from './transact'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withTransactions', () => {
    const dbHandler = new (withTransactions(DBHandlerBase<'PrimaryKey', 'EphemeraId', string>))({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should assign transaction items correctly', async () => {
        await dbHandler.transactWrite([
            { Put: { PrimaryKey: 'TestPut', DataCategory: 'Put', TestValue: 0 } as any },
            { Delete: { PrimaryKey: 'TestDelete', DataCategory: 'Delete' }},
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                UpdateExpression: 'SET TestValue = :newValue',
                ExpressionAttributeValues: { ':newValue': 5 },
                ConditionExpression: 'attribute_not_exists(TestValue)'
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Put: { TableName: 'Ephemera', Item: marshall({ EphemeraId: 'TestPut', DataCategory: 'Put', TestValue: 0 }) } },
            { Delete: { TableName: 'Ephemera', Key: marshall({ EphemeraId: 'TestDelete', DataCategory: 'Delete' }) } },
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :newValue',
                ExpressionAttributeValues: marshall({ ':newValue': 5 }),
                ConditionExpression: 'attribute_not_exists(TestValue)'
            }}
        ]})
    })

})