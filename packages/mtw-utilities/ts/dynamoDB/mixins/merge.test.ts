import { DBHandlerBase } from '../baseClasses'
import withMerge from './merge'
import { marshall } from '@aws-sdk/util-dynamodb'
import withQuery from './query'
import withBatchWrite from './batchWrite'

const dbMock = {
    send: jest.fn()
}

describe('withMerge', () => {
    const dbHandler = new (withMerge(withQuery(withBatchWrite(DBHandlerBase<'PrimaryKey', 'EphemeraId', string>))))({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    const queryMock = jest.fn()
    const batchWriteMock = jest.fn()
    const mergeFunction = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        jest.spyOn(dbHandler, 'query').mockImplementation(queryMock)
        jest.spyOn(dbHandler, 'batchWriteDispatcher').mockImplementation(batchWriteMock)
    })

    describe('merge', () => {
        it('should delete unmatched current keys', async () => {
            queryMock.mockResolvedValue([{
                PrimaryKey: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            }])
            await dbHandler.merge({
                query: { Key: { PrimaryKey: 'TestOne' } },
                items: [],
                mergeFunction
            })
            expect(queryMock).toHaveBeenCalledTimes(1)
            expect(queryMock).toHaveBeenCalledWith({ Key: { PrimaryKey: 'TestOne' } })
            expect(batchWriteMock).toHaveBeenCalledTimes(1)
            expect(batchWriteMock).toHaveBeenCalledWith([{ DeleteRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC1' }}])
        })

        it('should update unmatched incoming keys', async () => {
            queryMock.mockResolvedValue([{
                PrimaryKey: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            }])
            mergeFunction.mockReturnValue('ignore')
            await dbHandler.merge({
                query: { Key: { PrimaryKey: 'TestOne' } },
                items: [
                        { PrimaryKey: 'TestOne', DataCategory: 'DC2', TestValue: 0 },
                        { PrimaryKey: 'TestOne', DataCategory: 'DC1', TestValue: 5 }
                    ] as any,
                mergeFunction
            })
            expect(queryMock).toHaveBeenCalledTimes(1)
            expect(queryMock).toHaveBeenCalledWith({ Key: { PrimaryKey: 'TestOne' } })
            expect(batchWriteMock).toHaveBeenCalledTimes(1)
            expect(batchWriteMock).toHaveBeenCalledWith([{ PutRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC2', TestValue: 0 }}])
        })

        it('should update matched incoming keys', async () => {
            queryMock.mockResolvedValue([{
                PrimaryKey: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            }])
            mergeFunction.mockImplementation(({ incoming }) => (incoming))
            await dbHandler.merge({
                query: { Key: { PrimaryKey: 'TestOne' } },
                items: [
                        { PrimaryKey: 'TestOne', DataCategory: 'DC1', TestValue: 0 }
                    ] as any,
                mergeFunction
            })
            expect(queryMock).toHaveBeenCalledTimes(1)
            expect(queryMock).toHaveBeenCalledWith({ Key: { PrimaryKey: 'TestOne' } })
            expect(batchWriteMock).toHaveBeenCalledTimes(1)
            expect(batchWriteMock).toHaveBeenCalledWith([{ PutRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC1', TestValue: 0 }}])
        })

    })

})