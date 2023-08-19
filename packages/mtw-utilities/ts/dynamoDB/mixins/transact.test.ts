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

    afterEach(() => {
        dbMock.send.mockClear()
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
            }},
            {
                PrimitiveUpdate: {
                    Key: { PrimaryKey: 'TestPrimitiveUpdate', DataCategory: 'PrimitiveUpdate' },
                    UpdateExpression: 'SET value = :newValue',
                    ConditionExpression: 'value = :oldValue',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':oldValue': 5, ':newValue': 6 }
                }
            },
            {
                ConditionCheck: {
                    Key: { PrimaryKey: 'TestCheck', DataCategory: 'Check' },
                    ConditionExpression: 'value = :value',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':value': 5 }
                }
            }
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
            }},
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestPrimitiveUpdate', DataCategory: 'PrimitiveUpdate' }),
                UpdateExpression: 'SET #value = :newValue',
                ConditionExpression: '#value = :oldValue',
                ExpressionAttributeNames: { '#value': 'value' },
                ExpressionAttributeValues: marshall({ ':oldValue': 5, ':newValue': 6 })
            }},
            {
                ConditionCheck: {
                    TableName: 'Ephemera',
                    Key: marshall({ EphemeraId: 'TestCheck', DataCategory: 'Check' }),
                    ConditionExpression: '#value = :value',
                    ExpressionAttributeNames: { '#value': 'value' },
                    ExpressionAttributeValues: marshall({ ':value': 5 })
                }
            }
        ]})
    })

    it('should assign ExpressionAttributeName values correctly', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestUpdate', DataCategory: 'Update' }])
        await dbHandler.transactWrite([
            { Put: { PrimaryKey: 'TestPut', DataCategory: 'Put', Name: 'PutTest' } as any },
            { Delete: { PrimaryKey: 'TestDelete', DataCategory: 'Delete' }},
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                updateKeys: ['Name'],
                updateReducer: (draft) => {
                    draft.Name = 'UpdateTest'
                }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            //
            // Ignore reserved names in Put requests
            //
            { Put: { TableName: 'Ephemera', Item: marshall({ EphemeraId: 'TestPut', DataCategory: 'Put', Name: 'PutTest' }) } },
            { Delete: { TableName: 'Ephemera', Key: marshall({ EphemeraId: 'TestDelete', DataCategory: 'Delete' }) } },
            //
            // Build out ExpressionAttributeNames in Updates
            //
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET #name = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 'UpdateTest' }),
                ExpressionAttributeNames: { '#name': 'Name' },
                ConditionExpression: 'attribute_not_exists(#name)'
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

    it('should process delete transactions provided by deleteCascade', async () => {
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
                priorFetch: { listField: ['a', 'b'] },
                deleteCascade: ({ PrimaryKey }) => ([
                    { PrimaryKey, DataCategory: 'Graph::Forward' },
                    { PrimaryKey, DataCategory: 'Graph::Back' }
                ])
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
            }},
            { Delete: { TableName: 'Ephemera', Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Graph::Forward' }) } },
            { Delete: { TableName: 'Ephemera', Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Graph::Back' }) } }
        ]})
    })

    it('should call successCallbacks if available', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestUpdate', DataCategory: 'Update' }])
        const successCallback = jest.fn()
        await dbHandler.transactWrite([
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                updateKeys: ['TestValue'],
                updateReducer: (draft) => {
                    draft.TestValue = 5
                },
                successCallback
            }},
            {
                ConditionCheck: {
                    Key: { PrimaryKey: 'TestCheck', DataCategory: 'Check' },
                    ConditionExpression: 'value = :value',
                    ProjectionFields: ['value'],
                    ExpressionAttributeValues: { ':value': 5 }
                }
            }
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5 }),
                ConditionExpression: 'attribute_not_exists(TestValue)'
            }},
            {
                ConditionCheck: {
                    TableName: 'Ephemera',
                    Key: marshall({ EphemeraId: 'TestCheck', DataCategory: 'Check' }),
                    ConditionExpression: '#value = :value',
                    ExpressionAttributeNames: { '#value': 'value' },
                    ExpressionAttributeValues: marshall({ ':value': 5 })
                }
            }
        ]})
        expect(successCallback).toHaveBeenCalledWith({
            PrimaryKey: 'TestUpdate',
            DataCategory: 'Update',
            TestValue: 5
        },
        {
            PrimaryKey: 'TestUpdate',
            DataCategory: 'Update'
        })
    })

    it('should not call successCallbacks on exception', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestUpdate', DataCategory: 'Update' }])
        const successCallback = jest.fn()
        const dbMockWithException = {
            send: jest.fn().mockRejectedValue(new Error('ConditionalCheckFailedException'))
        }
        
        const dbHandlerLocal = new mixinClass({
            client: dbMockWithException as any,
            tableName: 'Ephemera',
            incomingKeyLabel: 'PrimaryKey',
            internalKeyLabel: 'EphemeraId',
            options: { getBatchSize: 3 }
        })    
        await expect(async () => {
                await dbHandlerLocal.transactWrite([
                    { Update: {
                        Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                        updateKeys: ['TestValue'],
                        updateReducer: (draft) => {
                            draft.TestValue = 5
                        },
                        successCallback
                    }},
                    {
                        ConditionCheck: {
                            Key: { PrimaryKey: 'TestCheck', DataCategory: 'Check' },
                            ConditionExpression: 'value = :value',
                            ProjectionFields: ['value'],
                            ExpressionAttributeValues: { ':value': 5 }
                        }
                    }
                ])
            }).rejects.toThrow('ConditionalCheckFailedException')
        expect(successCallback).toHaveBeenCalledTimes(0)
    })

    it('should correctly use checkKey argument when provided', async () => {
        await dbHandler.transactWrite([
            { Update: {
                Key: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' },
                updateKeys: ['TestValue', 'updatedAt'],
                updateReducer: (draft) => {
                    draft.TestValue = 5
                },
                checkKeys: ['updatedAt'],
                priorFetch: { PrimaryKey: 'TestUpdate', DataCategory: 'Update' }
            }},
            { Update: {
                Key: { PrimaryKey: 'TestUpdateTwo', DataCategory: 'Update' },
                updateKeys: ['TestValue', 'updatedAt'],
                updateReducer: (draft) => {
                    draft.TestValue = 5
                },
                checkKeys: ['updatedAt'],
                priorFetch: { PrimaryKey: 'TestUpdateTwo', DataCategory: 'Update', TestValue: 3, updatedAt: 1000 }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdate', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5 }),
                ConditionExpression: 'attribute_not_exists(updatedAt)'
            }},
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestUpdateTwo', DataCategory: 'Update' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5, ':Old1': 1000 }),
                ConditionExpression: 'updatedAt = :Old1'
            }}
        ]})
    })

})