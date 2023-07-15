import { DBHandlerBase } from '../baseClasses'
import withMerge from './merge'
import { marshall } from '@aws-sdk/util-dynamodb'
import withQuery from './query'
import withBatchWrite from './batchWrite'
import withGetOperations from './get'
import withUpdate from './update'
import withTransaction from './transact'

const dbMock = {
    send: jest.fn()
}

describe('withMerge', () => {
    const mixinClass = withMerge<'PrimaryKey'>()(
        withTransaction<'PrimaryKey'>()(
            withUpdate<'PrimaryKey'>()(
                withGetOperations<'PrimaryKey'>()(
                    withQuery<'PrimaryKey'>()(
                        withBatchWrite<'PrimaryKey'>()(DBHandlerBase<'PrimaryKey'>)
                    )
                )
            )
        )
    )
    const dbHandler = new mixinClass({
        client: dbMock as any,
        tableName: 'Ephemera',
        incomingKeyLabel: 'PrimaryKey',
        internalKeyLabel: 'EphemeraId',
        options: { getBatchSize: 3 }
    })

    const queryMock = jest.fn()
    const batchWriteMock = jest.fn()
    const mergeFunction = jest.fn()
    const transactWriteMock = jest.fn()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.restoreAllMocks()
        jest.spyOn(dbHandler, 'query').mockImplementation(queryMock)
        jest.spyOn(dbHandler, 'batchWriteDispatcher').mockImplementation(batchWriteMock)
        jest.spyOn(dbHandler, 'transactWrite').mockImplementation(transactWriteMock)
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

    describe('mergeTransact', () => {

        it('should associate transactions with deletes', async () => {
            const transactFactory = jest.fn().mockResolvedValue([{ Delete: { PrimaryKey: 'TestOne', DataCategory: 'Meta::Test' } }])
            queryMock.mockResolvedValue([{
                PrimaryKey: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            }])
            await dbHandler.mergeTransact({
                query: { Key: { PrimaryKey: 'TestOne' } },
                items: [] as any,
                mergeFunction,
                transactFactory
            })
            expect(queryMock).toHaveBeenCalledTimes(1)
            expect(queryMock).toHaveBeenCalledWith({ Key: { PrimaryKey: 'TestOne' } })
            expect(batchWriteMock).toHaveBeenCalledTimes(0)
            expect(transactFactory).toHaveBeenCalledTimes(1)
            expect(transactFactory).toHaveBeenCalledWith({ key: { PrimaryKey: 'TestOne', DataCategory: 'DC1' }, action: 'delete' })
            expect(transactWriteMock).toHaveBeenCalledTimes(1)
            expect(transactWriteMock).toHaveBeenCalledWith([
                { Delete: { PrimaryKey: 'TestOne', DataCategory: 'DC1' } },
                { Delete: { PrimaryKey: 'TestOne', DataCategory: 'Meta::Test' } }
            ])
        })

        it('should associate transactions with puts', async () => {
            const transactFactory = jest.fn().mockResolvedValue([{
                Update: {
                    Key: { PrimaryKey: 'TestOne', DataCategory: 'Meta::Test' },
                    updateKeys: ['cached'],
                    updateReducer: (draft) => { draft.cached = [...draft.cached || [], 'TestOne']}
                }
            }])
            queryMock.mockResolvedValue([{
                PrimaryKey: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            }])
            mergeFunction.mockReturnValueOnce('ignore').mockReturnValueOnce({ PrimaryKey: 'TestOne', DataCategory: 'DC1', TestValue: 5 })
            await dbHandler.mergeTransact({
                query: { Key: { PrimaryKey: 'TestOne' } },
                items: [
                    { PrimaryKey: 'TestOne', DataCategory: 'DC2', TestValue: 0 },
                    { PrimaryKey: 'TestOne', DataCategory: 'DC1', TestValue: 5 }
                ] as any,
                mergeFunction,
                transactFactory
            })
            expect(queryMock).toHaveBeenCalledTimes(1)
            expect(queryMock).toHaveBeenCalledWith({ Key: { PrimaryKey: 'TestOne' } })
            expect(batchWriteMock).toHaveBeenCalledTimes(0)
            expect(transactFactory).toHaveBeenCalledTimes(1)
            expect(transactFactory).toHaveBeenCalledWith({ key: { PrimaryKey: 'TestOne', DataCategory: 'DC2' }, action: { PrimaryKey: 'TestOne', DataCategory: 'DC2', TestValue: 0 } })
            expect(transactWriteMock).toHaveBeenCalledTimes(1)
            expect(transactWriteMock).toHaveBeenCalledWith([
                { Put: { PrimaryKey: 'TestOne', DataCategory: 'DC2', TestValue: 0 } },
                { Update: { Key: { PrimaryKey: 'TestOne', DataCategory: 'Meta::Test' }, updateKeys: ['cached'], updateReducer: expect.any(Function) } }
            ])
        })

        it('should separately batchWrite non-transactional returns', async () => {
            const transactFactory = jest.fn().mockImplementation(({ action }) => {
                if (action === 'delete') {
                    return []
                }
                return [{
                    Update: {
                        Key: { PrimaryKey: 'TestOne', DataCategory: 'Meta::Test' },
                        updateKeys: ['cached'],
                        updateReducer: (draft) => { draft.cached = [...draft.cached || [], 'DC3']}
                    }
                }]
            })
            queryMock.mockResolvedValue([{
                PrimaryKey: 'TestOne',
                DataCategory: 'DC1',
                TestValue: 5
            },
            {
                PrimaryKey: 'TestOne',
                DataCategory: 'DC2',
                TestValue: 0
            }])
            mergeFunction.mockReturnValue({ PrimaryKey: 'TestOne', DataCategory: 'DC3', TestValue: 2 })
            await dbHandler.mergeTransact({
                query: { Key: { PrimaryKey: 'TestOne' } },
                items: [
                    { PrimaryKey: 'TestOne', DataCategory: 'DC3', TestValue: 3 }
                ] as any,
                mergeFunction,
                transactFactory
            })
            expect(queryMock).toHaveBeenCalledTimes(1)
            expect(queryMock).toHaveBeenCalledWith({ Key: { PrimaryKey: 'TestOne' } })
            expect(transactFactory).toHaveBeenCalledTimes(3)
            expect(transactFactory).toHaveBeenCalledWith({ key: { PrimaryKey: 'TestOne', DataCategory: 'DC1' }, action: 'delete' })
            expect(transactFactory).toHaveBeenCalledWith({ key: { PrimaryKey: 'TestOne', DataCategory: 'DC2' }, action: 'delete' })
            expect(transactFactory).toHaveBeenCalledWith({ key: { PrimaryKey: 'TestOne', DataCategory: 'DC3' }, action: { PrimaryKey: 'TestOne', DataCategory: 'DC3', TestValue: 3 } })
            expect(transactWriteMock).toHaveBeenCalledTimes(1)
            expect(transactWriteMock).toHaveBeenCalledWith([
                { Put: { PrimaryKey: 'TestOne', DataCategory: 'DC3', TestValue: 3 } },
                { Update: { Key: { PrimaryKey: 'TestOne', DataCategory: 'Meta::Test' }, updateKeys: ['cached'], updateReducer: expect.any(Function) } }
            ])
            expect(batchWriteMock).toHaveBeenCalledTimes(1)
            expect(batchWriteMock).toHaveBeenCalledWith([
                { DeleteRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC1' } },
                { DeleteRequest: { PrimaryKey: 'TestOne', DataCategory: 'DC2' } }
            ])
        })

    })

})