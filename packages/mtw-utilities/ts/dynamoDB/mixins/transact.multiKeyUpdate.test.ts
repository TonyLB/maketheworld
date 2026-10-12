import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import withTransactions from './transact'
import { marshall } from '@aws-sdk/util-dynamodb'
import withUpdate from './update'

const dbMock = {
    send: jest.fn()
}

describe('withTransactions: MultiKeyUpdate', () => {
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

    const keyOne = { PrimaryKey: 'TestOne', DataCategory: 'MultiKey' }
    const keyTwo = { PrimaryKey: 'TestTwo', DataCategory: 'MultiKey' }
    const keyOneString = (dbHandler as any)._marshalledKeyString(keyOne)
    const keyTwoString = (dbHandler as any)._marshalledKeyString(keyTwo)

    const getItemsMock = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        jest.spyOn(dbHandler, 'getItems').mockImplementation(getItemsMock)
    })

    afterEach(() => {
        dbMock.send.mockClear()
    })

    it('produces an Update item when the reducer changes a fetched key', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
        await dbHandler.transactWrite([
            { MultiKeyUpdate: {
                Keys: [keyOne],
                updateKeys: ['TestValue'],
                reducer: (draft) => {
                    draft[keyOneString].TestValue = 5
                }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5, ':Old0': 2 }),
                ConditionExpression: 'TestValue = :Old0'
            }}
        ]})
    })

    it('produces a ConditionCheck item (not an Update) when the reducer leaves a fetched key unchanged', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 5 }])
        await dbHandler.transactWrite([
            { MultiKeyUpdate: {
                Keys: [keyOne],
                updateKeys: ['TestValue'],
                reducer: () => {}
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { ConditionCheck: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                ConditionExpression: 'TestValue = :Old0',
                ExpressionAttributeValues: marshall({ ':Old0': 5 })
            }}
        ]})
    })

    it('splits multiple keys into Update / ConditionCheck items correctly, in Keys order', async () => {
        getItemsMock.mockResolvedValueOnce([
            { PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 },
            { PrimaryKey: 'TestTwo', DataCategory: 'MultiKey', TestValue: 9 }
        ])
        await dbHandler.transactWrite([
            { MultiKeyUpdate: {
                Keys: [keyOne, keyTwo],
                updateKeys: ['TestValue'],
                reducer: (draft) => {
                    draft[keyOneString].TestValue = 5
                    // keyTwo left unchanged
                }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5, ':Old0': 2 }),
                ConditionExpression: 'TestValue = :Old0'
            }},
            { ConditionCheck: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestTwo', DataCategory: 'MultiKey' }),
                ConditionExpression: 'TestValue = :Old0',
                ExpressionAttributeValues: marshall({ ':Old0': 9 })
            }}
        ]})
    })

    it('produces independent Update items when the reducer changes more than one key', async () => {
        getItemsMock.mockResolvedValueOnce([
            { PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 },
            { PrimaryKey: 'TestTwo', DataCategory: 'MultiKey', TestValue: 9 }
        ])
        await dbHandler.transactWrite([
            { MultiKeyUpdate: {
                Keys: [keyOne, keyTwo],
                updateKeys: ['TestValue'],
                reducer: (draft) => {
                    draft[keyOneString].TestValue = 5
                    draft[keyTwoString].TestValue = 20
                }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5, ':Old0': 2 }),
                ConditionExpression: 'TestValue = :Old0'
            }},
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestTwo', DataCategory: 'MultiKey' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 20, ':Old0': 9 }),
                ConditionExpression: 'TestValue = :Old0'
            }}
        ]})
    })

    it('produces an Update using the new-record (attribute_not_exists) path for a key with no existing item', async () => {
        getItemsMock.mockResolvedValueOnce([])
        await dbHandler.transactWrite([
            { MultiKeyUpdate: {
                Keys: [keyOne],
                updateKeys: ['TestValue'],
                reducer: (draft) => {
                    draft[keyOneString] = { TestValue: 5 } as any
                }
            }}
        ])
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
            { Update: {
                TableName: 'Ephemera',
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                UpdateExpression: 'SET TestValue = :New0',
                ExpressionAttributeValues: marshall({ ':New0': 5 }),
                ConditionExpression: 'attribute_not_exists(DataCategory)'
            }}
        ]})
    })

    it('rejects the whole transaction (no swallowing) when the send call fails', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
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
        jest.spyOn(dbHandlerLocal, 'getItems').mockImplementation(getItemsMock)
        await expect(async () => {
            await dbHandlerLocal.transactWrite([
                { MultiKeyUpdate: {
                    Keys: [keyOne],
                    updateKeys: ['TestValue'],
                    reducer: (draft) => {
                        draft[keyOneString].TestValue = 5
                    }
                }}
            ])
        }).rejects.toThrow('ConditionalCheckFailedException')
    })

    describe('removing a fetched key', () => {
        const rowOne = { PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }
        const rowTwo = { PrimaryKey: 'TestTwo', DataCategory: 'MultiKey', TestValue: 7 }
        const marshalledKey = (key: { PrimaryKey: string; DataCategory: string }) => marshall({ EphemeraId: key.PrimaryKey, DataCategory: key.DataCategory })

        it('yields one Delete carrying the condition a ConditionCheck on that key would carry', async () => {
            getItemsMock.mockResolvedValue([rowOne])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: { Keys: [keyOne], updateKeys: ['TestValue'], reducer: () => {} } }
            ])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: { Keys: [keyOne], updateKeys: ['TestValue'], reducer: (draft) => { delete draft[keyOneString] } } }
            ])
            const [{ ConditionCheck }] = dbMock.send.mock.calls[0][0].input.TransactItems
            const items = dbMock.send.mock.calls[1][0].input.TransactItems
            expect(items).toEqual([{ Delete: ConditionCheck }])
            expect(items[0].Delete).toEqual({
                TableName: 'Ephemera',
                Key: marshalledKey(keyOne),
                ConditionExpression: 'TestValue = :Old0',
                ExpressionAttributeValues: marshall({ ':Old0': 2 })
            })
        })

        it('yields Update, ConditionCheck and Delete in Keys order for changed, unchanged and removed keys', async () => {
            const keyThree = { PrimaryKey: 'TestThree', DataCategory: 'MultiKey' }
            const keyThreeString = (dbHandler as any)._marshalledKeyString(keyThree)
            getItemsMock.mockResolvedValueOnce([rowOne, rowTwo, { ...keyThree, TestValue: 9 }])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: {
                    Keys: [keyOne, keyTwo, keyThree],
                    updateKeys: ['TestValue'],
                    reducer: (draft) => {
                        draft[keyOneString].TestValue = 5
                        delete draft[keyThreeString]
                    }
                } }
            ])
            const items = dbMock.send.mock.calls[0][0].input.TransactItems
            expect(items.map((item: any) => Object.keys(item)[0])).toEqual(['Update', 'ConditionCheck', 'Delete'])
            expect(items[1].ConditionCheck.Key).toEqual(marshalledKey(keyTwo))
            expect(items[2].Delete.Key).toEqual(marshalledKey(keyThree))
        })

        it('conditions on attribute_not_exists for a checked field the fetched row did not have', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', Other: 1 }])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: { Keys: [keyOne], updateKeys: ['TestValue', 'Other'], reducer: (draft) => { delete draft[keyOneString] } } }
            ])
            const { Delete } = dbMock.send.mock.calls[0][0].input.TransactItems[0]
            expect(Delete.ConditionExpression).toEqual('attribute_not_exists(TestValue) AND Other = :Old1')
        })

        it('requires the row to exist when there are no checked fields to compare', async () => {
            getItemsMock.mockResolvedValueOnce([rowOne])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: { Keys: [keyOne], updateKeys: [], reducer: (draft) => { delete draft[keyOneString] } } }
            ])
            const { Delete } = dbMock.send.mock.calls[0][0].input.TransactItems[0]
            expect(Delete.ConditionExpression).toEqual('attribute_exists(DataCategory)')
        })

        it('shows the cascade a next record without the removed key, and a prior that still has it', async () => {
            getItemsMock.mockResolvedValueOnce([rowOne])
            const cascade = jest.fn().mockReturnValue([
                { Put: { PrimaryKey: 'CascadePut', DataCategory: 'Cascade', TestValue: 1 } as any }
            ])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: { Keys: [keyOne], updateKeys: ['TestValue'], reducer: (draft) => { delete draft[keyOneString] }, cascade } }
            ])
            expect(cascade).toHaveBeenCalledWith({ [keyOneString]: rowOne }, {})
            const items = dbMock.send.mock.calls[0][0].input.TransactItems
            expect(items.map((item: any) => Object.keys(item)[0])).toEqual(['Delete', 'Put'])
        })

        it('rejects the whole transaction when the delete\'s condition fails', async () => {
            getItemsMock.mockResolvedValueOnce([rowOne])
            dbMock.send.mockRejectedValueOnce(new Error('TransactionCanceledException'))
            await expect(dbHandler.transactWrite([
                { MultiKeyUpdate: { Keys: [keyOne], updateKeys: ['TestValue'], reducer: (draft) => { delete draft[keyOneString] } } }
            ])).rejects.toThrow('TransactionCanceledException')
        })
    })

    describe('cascade', () => {
        it('fires the cascade with the reducer\'s actual (prior, next) output', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
            const cascade = jest.fn().mockReturnValue([])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: {
                    Keys: [keyOne],
                    updateKeys: ['TestValue'],
                    reducer: (draft) => {
                        draft[keyOneString].TestValue = 5
                    },
                    cascade
                }}
            ])
            expect(cascade).toHaveBeenCalledWith(
                { [keyOneString]: { PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 } },
                { [keyOneString]: { PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 5 } }
            )
        })

        it('merges cascade-returned items into the same TransactItems array as the per-key items', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: {
                    Keys: [keyOne],
                    updateKeys: ['TestValue'],
                    reducer: (draft) => {
                        draft[keyOneString].TestValue = 5
                    },
                    cascade: () => ([
                        { Put: { PrimaryKey: 'CascadePut', DataCategory: 'Cascade', TestValue: 1 } as any },
                        { ConditionCheck: {
                            Key: { PrimaryKey: 'CascadeCheck', DataCategory: 'Cascade' },
                            ConditionExpression: 'value = :value',
                            ProjectionFields: ['value'],
                            ExpressionAttributeValues: { ':value': 1 }
                        }}
                    ])
                }}
            ])
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
                { Update: {
                    TableName: 'Ephemera',
                    Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                    UpdateExpression: 'SET TestValue = :New0',
                    ExpressionAttributeValues: marshall({ ':New0': 5, ':Old0': 2 }),
                    ConditionExpression: 'TestValue = :Old0'
                }},
                { Put: { TableName: 'Ephemera', Item: marshall({ EphemeraId: 'CascadePut', DataCategory: 'Cascade', TestValue: 1 }) } },
                { ConditionCheck: {
                    TableName: 'Ephemera',
                    Key: marshall({ EphemeraId: 'CascadeCheck', DataCategory: 'Cascade' }),
                    ConditionExpression: '#value = :value',
                    ExpressionAttributeNames: { '#value': 'value' },
                    ExpressionAttributeValues: marshall({ ':value': 1 })
                }}
            ]})
        })

        it('still invokes the cascade when the reducer is a no-op', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 5 }])
            const cascade = jest.fn().mockReturnValue([
                { Put: { PrimaryKey: 'CascadePut', DataCategory: 'Cascade', TestValue: 1 } as any }
            ])
            await dbHandler.transactWrite([
                { MultiKeyUpdate: {
                    Keys: [keyOne],
                    updateKeys: ['TestValue'],
                    reducer: () => {},
                    cascade
                }}
            ])
            expect(cascade).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({ TransactItems: [
                { ConditionCheck: {
                    TableName: 'Ephemera',
                    Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'MultiKey' }),
                    ConditionExpression: 'TestValue = :Old0',
                    ExpressionAttributeValues: marshall({ ':Old0': 5 })
                }},
                { Put: { TableName: 'Ephemera', Item: marshall({ EphemeraId: 'CascadePut', DataCategory: 'Cascade', TestValue: 1 }) } }
            ]})
        })

        it('rejects the whole transaction (no swallowing) when the send call fails, including cascade items', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
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
            jest.spyOn(dbHandlerLocal, 'getItems').mockImplementation(getItemsMock)
            await expect(async () => {
                await dbHandlerLocal.transactWrite([
                    { MultiKeyUpdate: {
                        Keys: [keyOne],
                        updateKeys: ['TestValue'],
                        reducer: (draft) => {
                            draft[keyOneString].TestValue = 5
                        },
                        cascade: () => ([{ Put: { PrimaryKey: 'CascadePut', DataCategory: 'Cascade', TestValue: 1 } as any }])
                    }}
                ])
            }).rejects.toThrow('ConditionalCheckFailedException')
        })

        it('throws if a cascade-returned Update item does not supply priorFetch', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
            await expect(async () => {
                await dbHandler.transactWrite([
                    { MultiKeyUpdate: {
                        Keys: [keyOne],
                        updateKeys: ['TestValue'],
                        reducer: (draft) => {
                            draft[keyOneString].TestValue = 5
                        },
                        cascade: () => ([
                            { Update: {
                                Key: { PrimaryKey: 'CascadeUpdate', DataCategory: 'Cascade' },
                                updateKeys: ['TestValue'],
                                updateReducer: (draft: any) => { draft.TestValue = 1 }
                            }}
                        ])
                    }}
                ])
            }).rejects.toThrow('MultiKeyUpdate cascade\'s Update items must supply priorFetch')
        })

        it('throws if the cascade returns a nested MultiKeyUpdate item', async () => {
            getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
            await expect(async () => {
                await dbHandler.transactWrite([
                    { MultiKeyUpdate: {
                        Keys: [keyOne],
                        updateKeys: ['TestValue'],
                        reducer: (draft) => {
                            draft[keyOneString].TestValue = 5
                        },
                        cascade: () => ([
                            { MultiKeyUpdate: {
                                Keys: [keyTwo],
                                updateKeys: ['TestValue'],
                                reducer: () => {}
                            }}
                        ])
                    }}
                ])
            }).rejects.toThrow('MultiKeyUpdate cascade may not return a nested MultiKeyUpdate item')
        })
    })
})
