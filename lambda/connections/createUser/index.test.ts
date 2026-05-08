import { AdminCreateUserCommand, AdminSetUserPasswordCommand, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider"

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    connectionDB: {
        optimisticUpdate: jest.fn()
    }
}))
jest.mock('@tonylb/mtw-utilities/ts/eventBridge', () => ({
    eventBridgeClient: {
        send: jest.fn()
    }
}))
jest.mock('../clients', () => ({
    cognitoClient: {
        send: jest.fn()
    }
}))

import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { eventBridgeClient } from "@tonylb/mtw-utilities/ts/eventBridge"
import { cognitoClient } from "../clients"
import { createCognitoUser } from "."

const connectionDBMock = jest.mocked(connectionDB)
const eventBridgeClientMock = jest.mocked(eventBridgeClient)
const cognitoClientMock = jest.mocked(cognitoClient)

describe('createCognitoUser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        connectionDBMock.optimisticUpdate.mockResolvedValue(undefined as never)
    })

    it('publishes mtw.cognito New Player after admin signup', async () => {
        cognitoClientMock.send
            .mockResolvedValueOnce({} as never)
            .mockResolvedValueOnce({} as never)
            .mockResolvedValueOnce({
                AuthenticationResult: {
                    AccessToken: 'access-token',
                    IdToken: 'id-token',
                    RefreshToken: 'refresh-token'
                }
            } as never)
        eventBridgeClientMock.send.mockResolvedValue({} as never)

        const result = await createCognitoUser({
            inviteCode: 'ABC123',
            userName: 'PlayerOne',
            password: 'Password123!'
        })

        expect(result).toEqual({
            AccessToken: 'access-token',
            IdToken: 'id-token',
            RefreshToken: 'refresh-token'
        })
        expect(cognitoClientMock.send).toHaveBeenCalledWith(expect.any(AdminCreateUserCommand))
        expect(cognitoClientMock.send).toHaveBeenCalledWith(expect.any(AdminSetUserPasswordCommand))
        expect(cognitoClientMock.send).toHaveBeenCalledWith(expect.any(InitiateAuthCommand))
        expect(eventBridgeClientMock.send).toHaveBeenCalledTimes(1)
        expect(eventBridgeClientMock.send).toHaveBeenCalledWith([{
            Source: 'mtw.cognito',
            DetailType: 'New Player',
            Detail: {
                type: 'New Player',
                player: 'PlayerOne'
            }
        }])
    })
})
