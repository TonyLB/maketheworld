import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import withTransactions from './transact'
import { marshall } from '@aws-sdk/util-dynamodb'
import withUpdate from './update'

const dbMock = {
    send: jest.fn()
}

describe('withTransactions', () => {
    const dbHandler = new (withTransactions(withUpdate(withGetOperations(DBHandlerBase<'PrimaryKey', 'EphemeraId', string>))))({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    const getItemsMock = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        jest.spyOn(dbHandler, 'getItems').mockImplementation(getItemsMock)
    })

    it('should assign transaction items correctly', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestUpdate', DataCategory: 'Update' }])
        await dbHandler.transactWrite([
            { Put: { PrimaryKey: 'TestPut', DataCategory: 'Put', TestValue: 0 } as any },
            { Delete: { PrimaryKey: 'TestDelete', DataCategory: 'Delete' }},
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                updateKeys: ['TestValue'],
                updateReducer: (draft) => {
                    draft.TestValue = 5
                }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Put: { TableName: 'Ephemera', Item: marshall({ EphemeraId: 'TestPut', DataCategory: 'Put', TestValue: 0 }) } },
            { Delete: { TableName: 'Ephemera', Key: marshall({ EphemeraId: 'TestDelete', DataCategory: 'Delete' }) } },
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5 }),
                ConditionExpression: 'attribute_not_exists(TestValue)'
            }}
        ]})
    })

})