
var mockDBClientSend = jest.fn()
var mockDBClient = jest.fn(() => ({
    send: mockDBClientSend
}))
var mockGetItemCommand = jest.fn()
var mockUpdateItemCommand = jest.fn()
var mockPutItemCommand = jest.fn()
var mockDeleteItemCommand = jest.fn()
var mockQueryCommand = jest.fn()
var mockTransactWriteItemsCommand = jest.fn()

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: mockDBClient,
    GetItemCommand: mockGetItemCommand,
    UpdateItemCommand: mockUpdateItemCommand,
    PutItemCommand: mockPutItemCommand,
    DeleteItemCommand: mockDeleteItemCommand,
    QueryCommand: mockQueryCommand,
    BatchWriteItemCommand: jest.fn(),
    BatchGetItemCommand: jest.fn(),
    TransactWriteItemsCommand: mockTransactWriteItemsCommand
}))

import { marshall } from '@aws-sdk/util-dynamodb'
import { abstractOptimisticUpdate, addPerAsset } from '.'
import { splitType } from '../types'

describe('optimisticUpdate', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should do nothing on no change of state', async () => {
        mockDBClientSend.mockResolvedValue({ Item: marshall({ test: 'Testing' }) })
        const returnValue = await abstractOptimisticUpdate('ephemeraTest')({
            key: {
                EphemeraId: 'TEST',
                DataCategory: 'Meta::Test'
            },
            updateKeys: ['test'],
            updateReducer: () => {}
        })
        expect(returnValue).toEqual({ test: 'Testing' })
        expect(mockUpdateItemCommand).not.toHaveBeenCalled()
    })

    it('should update and remove fields on change', async () => {
        mockDBClientSend
            .mockResolvedValueOnce({ Item: marshall({ testOne: 'Testing', testTwo: 'Also Testing', testFour: 'Unchanged' }) })
            .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })})
        const returnValue = await abstractOptimisticUpdate('ephemeraTest')({
            key: {
                EphemeraId: 'TEST',
                DataCategory: 'Meta::Test'
            },
            updateKeys: ['testOne', 'testTwo', 'testThree', 'testFour'],
            updateReducer: (draft) => {
                draft.testOne = 'Different Test',
                draft.testTwo = undefined
                draft.testThree = 'New test'
            }
        })
        expect(returnValue).toEqual({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Different Test', testThree: 'New test', testFour: 'Unchanged' })
        expect(mockUpdateItemCommand).toHaveBeenCalledTimes(1)
        expect(mockUpdateItemCommand.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should update when no item fetched', async () => {
        mockDBClientSend
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Test', testTwo: 'Another test' })})
        const returnValue = await abstractOptimisticUpdate('ephemeraTest')({
            key: {
                EphemeraId: 'TEST',
                DataCategory: 'Meta::Test'
            },
            updateKeys: ['testOne', 'testTwo'],
            updateReducer: (draft) => {
                draft.testOne = 'Test'
                draft.testTwo = 'Another test'
            }
        })
        expect(returnValue).toEqual({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', testOne: 'Test', testTwo: 'Another test' })
        expect(mockUpdateItemCommand).toHaveBeenCalledTimes(1)
        expect(mockUpdateItemCommand.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should update when field not defined', async () => {
        mockDBClientSend
            .mockResolvedValueOnce({ Item: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test' })})
            .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', optionalField: 'Test' })})
        const returnValue = await abstractOptimisticUpdate('ephemeraTest')({
            key: {
                EphemeraId: 'TEST',
                DataCategory: 'Meta::Test'
            },
            updateKeys: ['optionalField'],
            updateReducer: (draft) => {
                draft.optionalField = 'Test'
            }
        })
        expect(returnValue).toEqual({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', optionalField: 'Test' })
        expect(mockUpdateItemCommand).toHaveBeenCalledTimes(1)
        expect(mockUpdateItemCommand.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should properly map ExpressionAttributeNames', async () => {
        mockDBClientSend
            .mockResolvedValueOnce({ Item: marshall({ Name: 'Testing', Test: 'Also Testing', testFour: 'Unchanged' }) })
            .mockResolvedValueOnce({ Attributes: marshall({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', Name: 'Different Test', Zone: 'New test', testFour: 'Unchanged' })})
        const returnValue = await abstractOptimisticUpdate('ephemeraTest')({
            key: {
                EphemeraId: 'TEST',
                DataCategory: 'Meta::Test'
            },
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#zone': 'Zone',
                '#test': 'Test'
            },
            updateKeys: ['#name', '#test', '#zone', 'testFour'],
            updateReducer: (draft) => {
                draft.Name = 'Different Test',
                draft.Test = undefined
                draft.Zone = 'New test'
            }
        })
        expect(returnValue).toEqual({ EphemeraId: 'TEST', DataCategory: 'Meta::Test', Name: 'Different Test', Zone: 'New test', testFour: 'Unchanged' })
        expect(mockUpdateItemCommand).toHaveBeenCalledTimes(1)
        expect(mockUpdateItemCommand.mock.calls[0][0]).toMatchSnapshot()
    })

})

type TestAddPerAssetArgs = {
    EphemeraId: string;
    DataCategory: string;
    value: string;
}

describe('addPerAsset', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
    })

    it('should create a new Meta record', async () => {
        mockDBClientSend
            .mockResolvedValueOnce({})

        await addPerAsset({
            updateKeys: ['cached'],
            reduceMetaData: ({ item }: { item: TestAddPerAssetArgs }) => (draft) => {
                const key = splitType(item.EphemeraId)[1]
                if (!draft.cached) {
                    draft.cached = []
                }
                if (!(key in draft.cached)) {
                    draft.cached.push(key)
                }
            }
        })({
            EphemeraId: 'FEATURE#TEST',
            DataCategory: 'ASSET#TEST',
            value: 'Test'
        })
        expect(mockTransactWriteItemsCommand).toHaveBeenCalledTimes(1)
        expect(mockTransactWriteItemsCommand.mock.calls[0][0]).toMatchSnapshot()
    })

    it('should update an existing Meta record', async () => {
        mockDBClientSend
            .mockResolvedValueOnce({ Item: marshall({ cached: ['OLD'] }) })
        await addPerAsset({
            updateKeys: ['cached'],
            reduceMetaData: ({ item }: { item: TestAddPerAssetArgs }) => (draft) => {
                const key = splitType(item.EphemeraId)[1]
                if (!draft.cached) {
                    draft.cached = []
                }
                if (!(key in draft.cached)) {
                    draft.cached.push(key)
                }
            }
        })({
            EphemeraId: 'FEATURE#TEST',
            DataCategory: 'ASSET#TEST',
            value: 'Test'
        })
        expect(mockTransactWriteItemsCommand).toHaveBeenCalledTimes(1)
        expect(mockTransactWriteItemsCommand.mock.calls[0][0]).toMatchSnapshot()
    })

})