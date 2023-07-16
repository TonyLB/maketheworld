import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import withTransactions from './transact'
import { marshall } from '@aws-sdk/util-dynamodb'
import withUpdate from './update'

const dbMock = {
    send: jest.fn()
}

describe('withTransactions', () => {
    const mixinClass = withTransactions<'PrimaryKey'>()(
            withUpdate<'PrimaryKey'>()(
                withGetOperations<'PrimaryKey'>()(DBHandlerBase<'PrimaryKey'>)
            )
        )
    const dbHandler = new mixinClass({
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

    it('should process transaction updates with priorFetch', async () => {
        await dbHandler.transactWrite([
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                updateKeys: ['TestValue'],
                updateReducer: (draft) => {
                    draft.TestValue = 5
                },
                priorFetch: { TestValue: 2 }
            }}
        ])
        expect(getItemsMock).toHaveBeenCalledTimes(0)
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5, ':Old0': 2 }),
                ConditionExpression: 'TestValue = :Old0'
            }}
        ]})
    })

    it('should process transaction updates with empty priorFetch', async () => {
        await dbHandler.transactWrite([
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                updateKeys: ['TestValue'],
                updateReducer: (draft) => {
                    draft.TestValue = 5
                },
                priorFetch: {}
            }}
        ])
        expect(getItemsMock).toHaveBeenCalledTimes(0)
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5 }),
                ConditionExpression: 'attribute_not_exists(DataCategory)'
            }}
        ]})
    })

    it('should process delete transaction on update with deleteCondition', async () => {
        await dbHandler.transactWrite([
            { Update: {
                Key: {
                    PrimaryKey: 'TestUpdate',
                    DataCategory: 'Update'
                },
                updateKeys: ['listField'],
                updateReducer: (draft) => {
                    draft.listField = draft.listField.filter((value) => (['c', 'd'].includes(value)))
                },
                deleteCondition: ({ listField }) => (listField.length === 0),
                priorFetch: { listField: ['a', 'b'] }
            }}
        ])
        expect(getItemsMock).toHaveBeenCalledTimes(0)
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Delete: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                ExpressionAttributeValues: marshall({ ':Old0': ['a', 'b'] }),
                ConditionExpression: 'listField = :Old0'
            }}
        ]})
    })

})