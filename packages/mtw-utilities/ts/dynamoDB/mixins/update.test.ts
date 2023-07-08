import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import withUpdate from './update'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withUpdate', () => {
    const dbHandler = new (withUpdate(withGetOperations(DBHandlerBase)))({
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

    describe('optimisticUpdate', () => {

        it('should remap incoming primary key', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }) })
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })})

            const output = await dbHandler.optimisticUpdate({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                updateKeys: ['testOne', 'testTwo', 'testThree', 'testFour'],
                updateReducer: (draft) => {
                    draft.testOne = 'Different Test',
                    draft.testTwo = undefined
                    draft.testThree = 'New test'
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'testOne, testTwo, testThree, testFour'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "testOne = :Old0 AND testTwo = :Old1 AND attribute_not_exists(testThree)",
                ExpressionAttributeValues: marshall({
                  ":New0": "Different Test",
                  ":New2": "New test",
                  ":Old0": "Testing",
                  ":Old1": "Also Testing"
                }),
                Key: marshall({
                    EphemeraId: "TestOne",
                    DataCategory: "DC1",
                }),
                TableName: "Ephemera",
                UpdateExpression: "SET testOne = :New0, testThree = :New2 REMOVE testTwo",
            })
            expect(output).toEqual({
                PrimaryKey: "TEST",
                DataCategory: "Meta::Test",
                testOne: "Different Test",
                testThree: "New test",
                testFour: "Unchanged"
            })
        })

        it('should replace reserved words with ExpressionAttributeName items', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ Name: 'Testing', zone: 'Also Testing', value: 'Unchanged' }) })
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', Name: 'Different Test', key: 'New test', value: 'Unchanged' })})

            const output = await dbHandler.optimisticUpdate({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                updateKeys: ['Name', 'zone', 'key', 'value'],
                updateReducer: (draft) => {
                    draft.Name = 'Different Test',
                    draft.zone = undefined
                    draft.key = 'New test'
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                ProjectionExpression: '#name, #zone, #key, #value',
                ExpressionAttributeNames: {
                    '#name': 'Name',
                    '#zone': 'zone',
                    '#key': 'key',
                    '#value': 'value'
                }
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "#name = :Old0 AND #zone = :Old1 AND attribute_not_exists(#key)",
                ExpressionAttributeValues: marshall({
                  ":New0": "Different Test",
                  ":New2": "New test",
                  ":Old0": "Testing",
                  ":Old1": "Also Testing"
                }),
                Key: marshall({
                    EphemeraId: "TestOne",
                    DataCategory: "DC1",
                }),
                TableName: "Ephemera",
                UpdateExpression: "SET #name = :New0, #key = :New2 REMOVE #zone",
                ExpressionAttributeNames: {
                    '#name': 'Name',
                    '#zone': 'zone',
                    '#key': 'key'
                }
            })
            expect(output).toEqual({
                PrimaryKey: "TEST",
                DataCategory: "Meta::Test",
                Name: "Different Test",
                key: "New test",
                value: "Unchanged"
            })
        })

        it('should update when no item fetched', async () => {
            dbMock.send
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Test', testTwo: 'Another test' })})
            const output = await dbHandler.optimisticUpdate({
                Key: {
                    PrimaryKey: 'TEST',
                    DataCategory: 'Meta::Test'
                },
                updateKeys: ['testOne', 'testTwo'],
                updateReducer: (draft) => {
                    draft.testOne = 'Test'
                    draft.testTwo = 'Another test'
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'testOne, testTwo'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "attribute_not_exists(DataCategory)",
                ExpressionAttributeValues: marshall({
                  ":New0": "Test",
                  ":New1": "Another test"
                }),
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Meta::Test",
                }),
                TableName: "Ephemera",
                UpdateExpression: "SET testOne = :New0, testTwo = :New1",
            })
            expect(output).toEqual({ PrimaryKey: 'TEST', DataCategory: 'Meta::Test', testOne: 'Test', testTwo: 'Another test' })
        })
    
        it('should update when field not defined', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test' })})
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', optionalField: 'Test' })})
            const output = await dbHandler.optimisticUpdate({
                Key: {
                    PrimaryKey: 'TEST',
                    DataCategory: 'Meta::Test'
                },
                updateKeys: ['optionalField'],
                updateReducer: (draft) => {
                    draft.optionalField = 'Test'
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'optionalField'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "attribute_not_exists(optionalField)",
                ExpressionAttributeValues: marshall({
                  ":New0": "Test"
                }),
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Meta::Test",
                }),
                TableName: "Ephemera",
                UpdateExpression: "SET optionalField = :New0",
            })
            expect(output).toEqual({ PrimaryKey: 'TEST', DataCategory: 'Meta::Test', optionalField: 'Test' })
        })

    })
})