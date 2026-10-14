import { DBHandlerBase } from '../baseClasses'
import withPrimitives from './primitives'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withPrimitives', () => {
    const dbHandler = new (withPrimitives()(DBHandlerBase))({
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

    describe('putItem', () => {

        it('should remap incoming primary key', async () => {

            await dbHandler.putItem({ PrimaryKey: 'TestOne', DataCategory: 'DC1'})
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Item: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1'}),
                TableName: 'Ephemera'
            })

        })

    })

    describe('conditionalPutItem', () => {
        const condition = {
            ConditionExpression: 'attribute_not_exists(builtAtVersion) OR builtAtVersion < :n',
            ExpressionAttributeValues: { ':n': 3 }
        }

        it('should remap the key, marshall the values and report a write', async () => {
            dbMock.send.mockResolvedValueOnce({})
            await expect(dbHandler.conditionalPutItem({ PrimaryKey: 'TestOne', DataCategory: 'DC1' }, condition)).resolves.toBe(true)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Item: marshall({ EphemeraId: 'TestOne', DataCategory: 'DC1' }),
                TableName: 'Ephemera',
                ConditionExpression: condition.ConditionExpression,
                ExpressionAttributeValues: marshall({ ':n': 3 })
            })
        })

        it('should return false when the condition fails, whether the SDK sets name or code', async () => {
            dbMock.send.mockRejectedValueOnce(Object.assign(new Error('refused'), { name: 'ConditionalCheckFailedException' }))
            await expect(dbHandler.conditionalPutItem({ PrimaryKey: 'TestOne', DataCategory: 'DC1' }, condition)).resolves.toBe(false)
            dbMock.send.mockRejectedValueOnce(Object.assign(new Error('refused'), { code: 'ConditionalCheckFailedException' }))
            await expect(dbHandler.conditionalPutItem({ PrimaryKey: 'TestOne', DataCategory: 'DC1' }, condition)).resolves.toBe(false)
        })

        it('should throw any other failure', async () => {
            dbMock.send.mockRejectedValueOnce(Object.assign(new Error('slow down'), { name: 'ProvisionedThroughputExceededException' }))
            await expect(dbHandler.conditionalPutItem({ PrimaryKey: 'TestOne', DataCategory: 'DC1' }, condition)).rejects.toThrow('slow down')
        })
    })

    describe('deleteItem', () => {

        it('should remap incoming primary key', async () => {

            await dbHandler.deleteItem({ PrimaryKey: 'TestTwo', DataCategory: 'DC2'})
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'}),
                TableName: 'Ephemera'
            })

        })

    })

    describe('primitiveUpdate', () => {

        it('should remap incoming primary key', async () => {

            await dbHandler.primitiveUpdate({
                Key: { PrimaryKey: 'TestTwo', DataCategory: 'DC2'},
                UpdateExpression: 'SET #value = :newValue',
                ConditionExpression: '#value = :oldValue',
                ExpressionAttributeValues: marshall({ ':oldValue': 0, ':newValue': 5 }),
                ExpressionAttributeNames: { '#value': 'value' }
            })
            expect(dbMock.send).toHaveBeenCalledTimes(1)
            expect(dbMock.send.mock.calls[0][0].input).toEqual({
                Key: marshall({ EphemeraId: 'TestTwo', DataCategory: 'DC2'}),
                TableName: 'Ephemera',
                UpdateExpression: 'SET #value = :newValue',
                ConditionExpression: '#value = :oldValue',
                ExpressionAttributeValues: marshall({ ':oldValue': 0, ':newValue': 5 }),
                ExpressionAttributeNames: { '#value': 'value' }
            })

        })

    })

})