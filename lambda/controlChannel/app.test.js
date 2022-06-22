import { jest, describe, it, expect } from '@jest/globals'

jest.mock('./validateJWT.js')
jest.mock('./lambdaClient.js')

import { registerCharacter, subscribe } from './app.js'
jest.mock('@tonylb/mtw-utilities/dist/dynamoDB/index.js')
import { assetDB, ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'

describe("registerCharacter", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    xit("should update connectionID when character is in table without connection", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character'
        }})) })
        documentClient.update.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await registerCharacter({ connectionId: '123', CharacterId: 'ABC' })
        expect(documentClient.update.mock.calls.length).toBe(1)
        expect(documentClient.update.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Key: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Meta::Character'
            },
            UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
            ExpressionAttributeValues: {
                ":ConnectionId": '123',
                ":Connected": true
            }
        })
        expect(data).toEqual({
            statusCode: 200,
            body: JSON.stringify({ message: "Registered" })
        })
    })

    xit("should update connectionID when character is in table with prior connection", async () => {
        documentClient.get.mockReturnValue({ promise: () => (Promise.resolve({ Item: {
            EphemeraId: 'CHARACTERINPLAY#ABC',
            DataCategory: 'Meta::Character',
            ConnectionId: '987'
        }})) })
        documentClient.update.mockReturnValue({ promise: () => (Promise.resolve({})) })
        const data = await registerCharacter({ connectionId: '123', CharacterId: 'ABC' })
        expect(documentClient.update.mock.calls.length).toBe(1)
        expect(documentClient.update.mock.calls[0][0]).toEqual({
            TableName: 'undefined_ephemera',
            Key: {
                EphemeraId: 'CHARACTERINPLAY#ABC',
                DataCategory: 'Meta::Character'
            },
            UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
            ExpressionAttributeValues: {
                ":ConnectionId": '123',
                ":Connected": true
            }
        })
        expect(data).toEqual({
            statusCode: 200,
            body: JSON.stringify({ message: "Registered" })
        })
    })

})

describe('subscribe to library', () => {
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