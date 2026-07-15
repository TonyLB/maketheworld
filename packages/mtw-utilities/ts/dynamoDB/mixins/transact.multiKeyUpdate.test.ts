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

    it('throws if the reducer removes a previously-fetched key (deletion is not yet supported --- OD-2)', async () => {
        getItemsMock.mockResolvedValueOnce([{ PrimaryKey: 'TestOne', DataCategory: 'MultiKey', TestValue: 2 }])
        await expect(async () => {
            await dbHandler.transactWrite([
                { MultiKeyUpdate: {
                    Keys: [keyOne],
                    updateKeys: ['TestValue'],
                    reducer: (draft) => {
                        delete draft[keyOneString]
                    }
                }}
            ])
        }).rejects.toThrow('MultiKeyUpdate reducer may not remove a previously-fetched key')
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
