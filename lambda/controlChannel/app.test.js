jest.mock('./validateJWT.js')
jest.mock('./lambdaClient.js')

import { subscribe } from './app.js'
jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'

xdescribe('subscribe to library', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should add to absent subscribe', async () => {
        ephemeraDB.getItem.mockResolvedValue({})
        const output = await subscribe({
            connectionId: '123',
            RequestId: 'ABC'
        })
        expect(output).toEqual({
            statusCode: 200,
            body: JSON.stringify({ RequestId: 'ABC' })
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'Library',
            DataCategory: 'Subscriptions',
            ProjectionFields: ['ConnectionIds']
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'Library',
            DataCategory: 'Subscriptions',
            UpdateExpression: 'SET ConnectionIds = :connectionIds',
            ExpressionAttributeValues: {
                ':connectionIds': ['123']
            }
        })
    })

    it('should add to existing subscribe', async () => {
        ephemeraDB.getItem.mockResolvedValue({
            ConnectionIds: ['456']
        })
        const output = await subscribe({
            connectionId: '123',
            RequestId: 'ABC'
        })
        expect(output).toEqual({
            statusCode: 200,
            body: JSON.stringify({ RequestId: 'ABC' })
        })
        expect(ephemeraDB.getItem).toHaveBeenCalledWith({
            EphemeraId: 'Library',
            DataCategory: 'Subscriptions',
            ProjectionFields: ['ConnectionIds']
        })
        expect(ephemeraDB.update).toHaveBeenCalledWith({
            EphemeraId: 'Library',
            DataCategory: 'Subscriptions',
            UpdateExpression: 'SET ConnectionIds = :connectionIds',
            ExpressionAttributeValues: {
                ':connectionIds': ['456', '123']
            }
        })
    })
})