import { BatchWriteItemCommand } from '@aws-sdk/client-dynamodb'
import { DBHandlerBase } from '../baseClasses'
import withQuery from './query'
import { marshall } from '@aws-sdk/util-dynamodb'

const dbMock = {
    send: jest.fn()
}

describe('withQuery', () => {
    const dbHandler = new (withQuery<'PrimaryKey'>()(DBHandlerBase))({
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

    it('should remap incoming primary key', async () => {
        dbMock.send.mockResolvedValue({ Items: [marshall({
            EphemeraId: 'TestOne',
            DataCategory: 'DC1',
            TestValue: 5
        })] })
        const output = await dbHandler.query({ Key: { PrimaryKey: 'TestOne' } })
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            TableName: 'Ephemera',
            KeyConditionExpression: `EphemeraId = :keyId`,
            ExpressionAttributeValues: marshall({ ':keyId': 'TestOne' }),
            ProjectionExpression: "DataCategory"
        })
        expect(output).toEqual([{
            PrimaryKey: 'TestOne',
            DataCategory: 'DC1',
            TestValue: 5
        }])
    })

    it('should remap reserved attributes', async () => {
        dbMock.send.mockResolvedValue({ Items: [marshall({
            EphemeraId: 'TestOne',
            DataCategory: 'DC1',
            Name: 'TestName',
            zone: 'TestZone'
        })] })
        const output = await dbHandler.query({ Key: { PrimaryKey: 'TestOne' }, ProjectionFields: ['PrimaryKey', 'Name', 'Key', 'zone'] })
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            TableName: 'Ephemera',
            KeyConditionExpression: `EphemeraId = :keyId`,
            ExpressionAttributeValues: marshall({ ':keyId': 'TestOne' }),
            ProjectionExpression: "EphemeraId, #name, #key, #zone",
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#key': 'Key',
                '#zone': 'zone'
            }
        })
        expect(output).toEqual([{
            PrimaryKey: 'TestOne',
            DataCategory: 'DC1',
            Name: 'TestName',
            zone: 'TestZone'
        }])
    })

    it('should not remap expression attribute values', async () => {
        dbMock.send.mockResolvedValue({ Items: [marshall({
            EphemeraId: 'TestOne',
            DataCategory: 'DC1',
            Name: 'TestName',
            zone: 'TestZone'
        })] })
        const output = await dbHandler.query({
            Key: { PrimaryKey: 'TestOne' },
            ProjectionFields: ['PrimaryKey', 'Name', 'Key', 'zone'],
            ExpressionAttributeValues: { ':zone': 'TestZone' },
            FilterExpression: 'zone = :zone'
        })
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input).toEqual({
            TableName: 'Ephemera',
            KeyConditionExpression: `EphemeraId = :keyId`,
            ExpressionAttributeValues: marshall({ ':keyId': 'TestOne', ':zone': 'TestZone' }),
            ProjectionExpression: "EphemeraId, #name, #key, #zone",
            ExpressionAttributeNames: {
                '#name': 'Name',
                '#key': 'Key',
                '#zone': 'zone'
            },
            FilterExpression: '#zone = :zone'
        })
        expect(output).toEqual([{
            PrimaryKey: 'TestOne',
            DataCategory: 'DC1',
            Name: 'TestName',
            zone: 'TestZone'
        }])
    })

})