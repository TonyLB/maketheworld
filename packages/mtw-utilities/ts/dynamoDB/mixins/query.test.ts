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

    it('passes ConsistentRead on base-table query only', async () => {
        dbMock.send.mockResolvedValue({ Items: [] })
        await dbHandler.query({
            Key: { PrimaryKey: 'Meta::Session' },
            KeyConditionExpression: 'begins_with(DataCategory, :prefix)',
            ExpressionAttributeValues: { ':prefix': 'SESSION#' },
            ConsistentRead: true
        })
        expect(dbMock.send.mock.calls[0][0].input).toMatchObject({
            ConsistentRead: true
        })
    })

    it('does not pass ConsistentRead when querying a GSI', async () => {
        dbMock.send.mockResolvedValue({ Items: [] })
        await dbHandler.query({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: 'Meta::Session' },
            ConsistentRead: true
        })
        expect(dbMock.send.mock.calls[0][0].input.ConsistentRead).toBeUndefined()
    })

    it('returns paginated envelope with limit and next token', async () => {
        dbMock.send.mockResolvedValueOnce({
            Items: [marshall({
                EphemeraId: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            })],
            LastEvaluatedKey: marshall({
                EphemeraId: 'TestTwo',
                DataCategory: 'DC2'
            })
        })
        const output = await dbHandler.query<{ PrimaryKey: string; DataCategory: string; TestValue: number }>({
            Key: { PrimaryKey: 'TestOne' },
            pagination: { limit: 5 }
        })
        expect(dbMock.send).toHaveBeenCalledTimes(1)
        expect(dbMock.send.mock.calls[0][0].input.Limit).toBe(5)
        expect(Array.isArray((output as any).items)).toBe(true)
        expect((output as any).nextToken).toBeDefined()
        expect(typeof (output as any).nextPage).toBe('function')
        expect((output as any).items).toEqual([{
            PrimaryKey: 'TestOne',
            DataCategory: 'DC1',
            TestValue: 5
        }])
    })

    it('nextPage uses decoded token as ExclusiveStartKey', async () => {
        dbMock.send
            .mockResolvedValueOnce({
                Items: [marshall({
                    EphemeraId: 'TestOne',
                    DataCategory: 'DC1',
                    TestValue: 1
                })],
                LastEvaluatedKey: marshall({
                    EphemeraId: 'TestTwo',
                    DataCategory: 'DC2'
                })
            })
            .mockResolvedValueOnce({
                Items: [marshall({
                    EphemeraId: 'TestThree',
                    DataCategory: 'DC3',
                    TestValue: 2
                })]
            })
        const first = await dbHandler.query<{ PrimaryKey: string; DataCategory: string; TestValue: number }>({
            Key: { PrimaryKey: 'TestOne' },
            pagination: { limit: 3 }
        })
        const second = await (first as any).nextPage()
        expect(dbMock.send).toHaveBeenCalledTimes(2)
        expect(dbMock.send.mock.calls[1][0].input.ExclusiveStartKey).toEqual(marshall({
            EphemeraId: 'TestTwo',
            DataCategory: 'DC2'
        }))
        expect(second.items).toEqual([{
            PrimaryKey: 'TestThree',
            DataCategory: 'DC3',
            TestValue: 2
        }])
    })

    it('clamps paginated limit to max guardrail', async () => {
        dbMock.send.mockResolvedValue({ Items: [] })
        await dbHandler.query({
            Key: { PrimaryKey: 'TestOne' },
            pagination: { limit: 99999 }
        })
        expect(dbMock.send.mock.calls[0][0].input.Limit).toBe(250)
    })

    it('throws for invalid pagination token', async () => {
        await expect(dbHandler.query({
            Key: { PrimaryKey: 'TestOne' },
            pagination: { nextToken: '$not-valid-token$' }
        })).rejects.toThrow('Invalid pagination token')
        expect(dbMock.send).not.toHaveBeenCalled()
    })

})