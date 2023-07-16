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

})