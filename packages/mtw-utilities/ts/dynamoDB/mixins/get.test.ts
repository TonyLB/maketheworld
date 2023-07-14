import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withGetOperations', () => {
    const dbHandler = new (withGetOperations<'PrimaryKey', string, typeof DBHandlerBase>(DBHandlerBase))({
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

    describe('getItem', () => {
        it('should remap incoming primary key', async () => {
            dbMock.send.mockResolvedValue({ Item: marshall({
                EphemeraId: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            }) })
            const output = await dbHandler.getItem({ Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'} })
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
            const output = await dbHandler.getItem({ Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'}, ProjectionFields: ['test', 'Name', 'Zone', 'value', 'key'] })
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

    describe('getItems', () => {
        it('should remap incoming primary key', async () => {
            dbMock.send.mockResolvedValue({ Responses: { Ephemera: [
                marshall({
                    EphemeraId: 'TestOne',
                    DataCategory: 'DC1',
                    TestValue: 5
                }),
                marshall({
                    EphemeraId: 'TestTwo',
                    DataCategory: 'DC2',
                    TestValue: 5
                }),
            ]}})
            const output = await dbHandler.getItems<{ PrimaryKey: string; DataCategory: string; TestValue: number }>({
                Keys: [{ PrimaryKey: 'TestOne', DataCategory: 'DC1'}, { PrimaryKey: 'TestTwo', DataCategory: 'DC2'}],
                ProjectionFields: ['PrimaryKey', 'DataCategory', 'TestValue']
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                RequestItems: {
                    Ephemera: {
                        Keys: [
                            marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                            marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'})
                        ],
                        ProjectionExpression: 'EphemeraId, DataCategory, TestValue'
                    }
                },
            })
            expect(output).toEqual([
                {
                    PrimaryKey: 'TestOne',
                    DataCategory: 'DC1',
                    TestValue: 5
                },
                {
                    PrimaryKey: 'TestTwo',
                    DataCategory: 'DC2',
                    TestValue: 5
                }
            ])
        })

        it('should replace reserved words with ExpressionAttributeName items', async () => {
            dbMock.send.mockResolvedValue({ Responses: { Ephemera: [
                marshall({
                    EphemeraId: 'TestOne',
                    DataCategory: 'DC1',
                    test: 3,
                    Name: 5,
                    Zone: 'personal',
                    value: 10,
                    key: 'blue'
                }),
                marshall({
                    EphemeraId: 'TestTwo',
                    DataCategory: 'DC2',
                    test: 3,
                    Name: 5,
                    Zone: 'personal',
                    value: 10,
                    key: 'blue'
                }),
            ]}})
            const output = await dbHandler.getItems({ Keys: [{ PrimaryKey: 'TestOne', DataCategory: 'DC1'}, { PrimaryKey: 'TestTwo', DataCategory: 'DC2'}], ProjectionFields: ['test', 'Name', 'Zone', 'value', 'key'] })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                RequestItems: {
                    Ephemera: {
                        Keys: [
                            marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                            marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'})
                        ],
                        ProjectionExpression: 'test, #name, #zone, #value, #key',
                        ExpressionAttributeNames: {
                            '#name': 'Name',
                            '#zone': 'Zone',
                            '#value': 'value',
                            '#key': 'key'
                        }
                    }
                },
            })
            expect(output).toEqual([
                {
                    PrimaryKey: 'TestOne',
                    DataCategory: 'DC1',
                    test: 3,
                    Name: 5,
                    Zone: 'personal',
                    value: 10,
                    key: 'blue'
                },
                {
                    PrimaryKey: 'TestTwo',
                    DataCategory: 'DC2',
                    test: 3,
                    Name: 5,
                    Zone: 'personal',
                    value: 10,
                    key: 'blue'
                }
            ])
        })

        it('should separate batches into specified size', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Responses: { Ephemera: [
                    marshall({ EphemeraId: 'TestOne' }),
                    marshall({ EphemeraId: 'TestTwo' }),
                    marshall({ EphemeraId: 'TestThree' }),
                ]}})
                .mockResolvedValueOnce({ Responses: { Ephemera: [
                    marshall({ EphemeraId: 'TestFour' })
                ]}})
            const output = await dbHandler.getItems<{ PrimaryKey: string; DataCategory: string; TestValue: number }>({
                Keys: [
                    { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                    { PrimaryKey: 'TestTwo', DataCategory: 'DC2'},
                    { PrimaryKey: 'TestThree', DataCategory: 'DC3'},
                    { PrimaryKey: 'TestFour', DataCategory: 'DC4'}
                ]
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                RequestItems: {
                    Ephemera: {
                        Keys: [
                            marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                            marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'}),
                            marshall({ EphemeraId: 'TestThree', DataCategory: 'DC3'})
                        ],
                        ProjectionExpression: 'EphemeraId'
                    }
                },
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                RequestItems: {
                    Ephemera: {
                        Keys: [
                            marshall({ EphemeraId: 'TestFour', DataCategory: 'DC4'})
                        ],
                        ProjectionExpression: 'EphemeraId'
                    }
                },
            })
            expect(output).toEqual([
                { PrimaryKey: 'TestOne' },
                { PrimaryKey: 'TestTwo' },
                { PrimaryKey: 'TestThree' },
                { PrimaryKey: 'TestFour' }
            ])
        })

    })
})