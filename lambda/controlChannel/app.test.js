import { jest, describe, it, expect } from '@jest/globals'

jest.mock('./validateJWT.js')
jest.mock('./lambdaClient.js')

import { registerCharacter } from './app.js'
import { assetDB, ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

describe("registerCharacter", () => {
    afterEach(() => {
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