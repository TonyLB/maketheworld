import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { DBHandlerBase } from '../baseClasses'
import withGetOperations from './get'
import withUpdate from './update'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withUpdate', () => {
    const mixedClass = withUpdate<'PrimaryKey'>()(
        withGetOperations<'PrimaryKey'>()(DBHandlerBase<'PrimaryKey'>)
    )
    const dbHandler = new mixedClass({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        dbMock.send.mockClear()
        dbMock.send.mockRestore()
    })

    describe('setOperation', () => {
        it('should create a set-add update primitive', async () => {
            dbMock.send.mockResolvedValue({})

            await dbHandler.setOperation({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                attributeName: 'testValue',
                addItems: ['Test1', 'Test2']
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                UpdateExpression: 'ADD testValue :addItems',
                ExpressionAttributeValues: {
                    ':addItems': { SS: ['Test1', 'Test2' ]}
                }
            })
        })

        it('should create a set-delete update primitive', async () => {
            dbMock.send.mockResolvedValue({})

            await dbHandler.setOperation({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                attributeName: 'testValue',
                deleteItems: ['Test1', 'Test2']
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                UpdateExpression: 'DELETE testValue :deleteItems',
                ExpressionAttributeValues: {
                    ':deleteItems': { SS: ['Test1', 'Test2' ]}
                }
            })
        })

        it('should create a combined update primitive', async () => {
            dbMock.send.mockResolvedValue({})

            await dbHandler.setOperation({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                attributeName: 'testValue',
                addItems: ['Test1'],
                deleteItems: ['Test2']
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                UpdateExpression: 'ADD testValue :addItems DELETE testValue :deleteItems',
                ExpressionAttributeValues: {
                    ':addItems': { SS: ['Test1']},
                    ':deleteItems': { SS: ['Test2']}
                }
            })
        })

        it('should support setUpdate argument', async () => {
            dbMock.send.mockResolvedValue({})

            await dbHandler.setOperation({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                attributeName: 'testValue',
                addItems: ['Test1'],
                deleteItems: ['Test2'],
                setUpdate: {
                    UpdateExpression: 'SET setValue = :value',
                    ExpressionAttributeValues: marshall({ ':value': 5 })
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                UpdateExpression: 'SET setValue = :value ADD testValue :addItems DELETE testValue :deleteItems',
                ExpressionAttributeValues: {
                    ':value': { N: '5' },
                    ':addItems': { SS: ['Test1'] },
                    ':deleteItems': { SS: ['Test2'] }
                }
            })
        })
    })

    describe('optimisticUpdate', () => {

        it('should ignore when update produces no change', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ testOne: 'Testing', testTwo: { testing: 'Map' }, testThree: [{ nested: 'List' }] }) })
                .mockResolvedValueOnce({})

            const output = await dbHandler.optimisticUpdate({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                updateKeys: ['testOne', 'testTwo', 'testThree'],
                updateReducer: (draft) => {
                    draft.testTwo = { ...draft.testTwo }
                    draft.testThree = [...draft.testThree]
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'testOne, testTwo, testThree, EphemeraId, DataCategory'
            })
            expect(output).toEqual({
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
                testOne: "Testing",
                testTwo: { testing: 'Map' },
                testThree: [{ nested: 'List' }]
            })
        })

        it('should remap incoming primary key', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }) })
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })})

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
                ProjectionExpression: 'testOne, testTwo, testThree, testFour, EphemeraId, DataCategory'
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
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
                testOne: "Different Test",
                testThree: "New test",
                testFour: "Unchanged"
            })
        })

        it('should accept priorFetch argument', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })})

            const output = await dbHandler.optimisticUpdate<{ testOne: string; testTwo?: string; testThree?: string; testFour: string }>({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                updateKeys: ['testOne', 'testTwo', 'testThree', 'testFour'],
                updateReducer: (draft) => {
                    draft.testOne = 'Different Test',
                    draft.testTwo = undefined
                    draft.testThree = 'New test'
                },
                priorFetch: { testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
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
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
                testOne: "Different Test",
                testThree: "New test",
                testFour: "Unchanged"
            })
        })

        it('should accept checkKeys argument', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }) })
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })})

            const output = await dbHandler.optimisticUpdate<{ testOne: string; testTwo?: string; testThree?: string; testFour: string }>({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                updateKeys: ['testOne', 'testTwo', 'testThree', 'testFour'],
                updateReducer: (draft) => {
                    draft.testOne = 'Different Test',
                    draft.testTwo = undefined
                    draft.testThree = 'New test'
                },
                checkKeys: ['testFour']
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'testOne, testTwo, testThree, testFour, EphemeraId, DataCategory'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "testFour = :Old3",
                ExpressionAttributeValues: marshall({
                  ":New0": "Different Test",
                  ":New2": "New test",
                  ":Old3": "Unchanged"
                }),
                Key: marshall({
                    EphemeraId: "TestOne",
                    DataCategory: "DC1",
                }),
                TableName: "Ephemera",
                UpdateExpression: "SET testOne = :New0, testThree = :New2 REMOVE testTwo",
            })
            expect(output).toEqual({
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
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
                ProjectionExpression: '#name, #zone, #key, #value, EphemeraId, DataCategory',
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
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
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
                ProjectionExpression: 'testOne, testTwo, EphemeraId, DataCategory'
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

        it('should update when empty item in priorFetch', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Test', testTwo: 'Another test' })})
            const output = await dbHandler.optimisticUpdate<{ testOne: string; testTwo: string }>({
                Key: {
                    PrimaryKey: 'TEST',
                    DataCategory: 'Meta::Test'
                },
                updateKeys: ['testOne', 'testTwo'],
                updateReducer: (draft) => {
                    draft.testOne = 'Test'
                    draft.testTwo = 'Another test'
                },
                priorFetch: {}
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
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
                ProjectionExpression: 'optionalField, EphemeraId, DataCategory'
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

        it('should return non-string values', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', listField: ['a', 'b'] })})
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', listField: ['a', 'b', 'c'] })})
            const output = await dbHandler.optimisticUpdate<{ PrimaryKey: string; DataCategory: string; listField: string[] }>({
                Key: {
                    PrimaryKey: 'TEST',
                    DataCategory: 'Meta::Test'
                },
                updateKeys: ['listField'],
                updateReducer: (draft) => {
                    draft.listField = [...draft.listField, 'c']
                }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'listField, EphemeraId, DataCategory'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "listField = :Old0",
                ExpressionAttributeValues: marshall({
                    ":Old0": ['a', 'b'],
                    ":New0": ['a', 'b', 'c']
                }),
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Meta::Test",
                }),
                TableName: "Ephemera",
                UpdateExpression: "SET listField = :New0",
            })
            expect(output).toEqual({ PrimaryKey: 'TEST', DataCategory: 'Meta::Test', listField: ['a', 'b', 'c'] })
    
        })

        it('should remove records tagged by deleteCondition', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', listField: ['a', 'b'] })})
                .mockResolvedValueOnce({})
            const output = await dbHandler.optimisticUpdate<{ PrimaryKey: string; DataCategory: string; listField: string[] }>({
                Key: {
                    PrimaryKey: 'TEST',
                    DataCategory: 'Meta::Test'
                },
                updateKeys: ['listField'],
                updateReducer: (draft) => {
                    draft.listField = draft.listField.filter((value) => (['c', 'd'].includes(value)))
                },
                deleteCondition: ({ listField }) => (listField.length === 0)
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'listField, EphemeraId, DataCategory'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "listField = :Old0",
                ExpressionAttributeValues: marshall({
                    ":Old0": ['a', 'b']
                }),
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Meta::Test",
                }),
                TableName: "Ephemera"
            })
            expect(output).toEqual({})

        })

        it('should remove records provided by deleteCascade', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', listField: ['a', 'b'] })})
                .mockResolvedValue({})
            const output = await dbHandler.optimisticUpdate<{ PrimaryKey: string; DataCategory: string; listField: string[] }>({
                Key: {
                    PrimaryKey: 'TEST',
                    DataCategory: 'Meta::Test'
                },
                updateKeys: ['listField'],
                updateReducer: (draft) => {
                    draft.listField = draft.listField.filter((value) => (['c', 'd'].includes(value)))
                },
                deleteCondition: ({ listField }) => (listField.length === 0),
                deleteCascade: ({ PrimaryKey }) => ([
                    { PrimaryKey, DataCategory: 'Graph::Forward' },
                    { PrimaryKey, DataCategory: 'Graph::Back' }
                ])
            })
            expect(dbMock.send).toHaveBeenCalledTimes(4)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'listField, EphemeraId, DataCategory'
            })
            expect(dbMock.send.mock.calls[1][0].input).toEqual({
                ConditionExpression: "listField = :Old0",
                ExpressionAttributeValues: marshall({
                    ":Old0": ['a', 'b']
                }),
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Meta::Test",
                }),
                TableName: "Ephemera"
            })
            expect(dbMock.send.mock.calls[2][0].input).toEqual({
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Graph::Forward",
                }),
                TableName: "Ephemera"
            })
            expect(dbMock.send.mock.calls[3][0].input).toEqual({
                Key: marshall({
                    EphemeraId: "TEST",
                    DataCategory: "Graph::Back",
                }),
                TableName: "Ephemera"
            })
            expect(output).toEqual({})

        })

        it('should call successCallback if provided', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }) })
                .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })})

            const successCallback = jest.fn()
            const output = await dbHandler.optimisticUpdate({
                Key: { PrimaryKey: 'TEST', DataCategory: 'Meta::Test'},
                updateKeys: ['testOne', 'testTwo', 'testThree', 'testFour'],
                updateReducer: (draft) => {
                    draft.testOne = 'Different Test',
                    draft.testTwo = undefined
                    draft.testThree = 'New test'
                },
                successCallback
            })
            expect(dbMock.send).toHaveBeenCalledTimes(2)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'testOne, testTwo, testThree, testFour, EphemeraId, DataCategory'
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
                    EphemeraId: "TEST",
                    DataCategory: "Meta::Test",
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
            expect(successCallback).toHaveBeenCalledWith({
                PrimaryKey: "TEST",
                DataCategory: "Meta::Test",
                testOne: "Different Test",
                testThree: "New test",
                testFour: "Unchanged"
            },
            {
                PrimaryKey: "TEST",
                DataCategory: "Meta::Test",
                testOne: 'Testing',
                testTwo: 'Also Testing',
                testFour: 'Unchanged'
            })
        })

        it('should call successCallback on delete or ignore if succeedAll is set', async () => {
            dbMock.send
                .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1', testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }) })

            const successCallback = jest.fn()
            const output = await dbHandler.optimisticUpdate({
                Key: { PrimaryKey: 'TestOne', DataCategory: 'DC1'},
                updateKeys: ['testOne', 'testTwo', 'testThree', 'testFour'],
                updateReducer: (draft) => {},
                successCallback,
                succeedAll: true
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera',
                ProjectionExpression: 'testOne, testTwo, testThree, testFour, EphemeraId, DataCategory'
            })
            expect(output).toEqual({
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
                testOne: "Testing",
                testTwo: "Also Testing",
                testFour: "Unchanged"
            })
            expect(successCallback).toHaveBeenCalledWith({
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
                testOne: "Testing",
                testTwo: "Also Testing",
                testFour: "Unchanged"
            },
            {
                PrimaryKey: "TestOne",
                DataCategory: "DC1",
                testOne: 'Testing',
                testTwo: 'Also Testing',
                testFour: 'Unchanged'
            })
        })
    })
})