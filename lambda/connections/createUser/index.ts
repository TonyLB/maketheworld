import { AdminCreateUserCommand, AdminSetUserPasswordCommand, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "../clients";
import { connectionDB } from "@tonylb/mtw-utilities/ts/dynamoDB";

type CreateUserRequest = {
    inviteCode: string;
    userName: string;
    password: string;
}

type CreateUserResultSuccess = {
    AccessToken?: string;
    IdToken: string;
    RefreshToken: string;
}

type CreateUserResultsFailureErrorField = 'inviteCode' | 'userName' | 'password' | 'system'
type CreateUserResultsFailure = {
    errorField: CreateUserResultsFailureErrorField;
    errorMessage: string;
}

type CreateUserResult = CreateUserResultSuccess | CreateUserResultsFailure

export const createCognitoUser = async ({ inviteCode, userName, password }: CreateUserRequest): Promise<CreateUserResult> => {
    let errorField: CreateUserResultsFailureErrorField | undefined
    let errorMessage = ''
    let inviteCodeClaimed = false
    try {
        //
        // Validate and claim inviteCode
        //
        await connectionDB.optimisticUpdate({
            Key: {
                ConnectionId: `INVITATION#${inviteCode}`,
                DataCategory: 'Meta::Invitation'
            },
            updateKeys: ['claimedBy'],
            updateReducer: (draft) => {
                if (!draft.DataCategory) {
                    errorField = 'inviteCode'
                    errorMessage = 'Invalid invitation'
                    throw new Error('Invalid invitation')
                }
                if (draft.claimedBy) {
                    errorField = 'inviteCode'
                    errorMessage = 'Invitation already claimed'
                    throw new Error('Invitation already claimed')
                }
                draft.claimedBy = userName
            },
            successCallback: () => {
                inviteCodeClaimed = true
            }
        })
        //
        // Create the user without a temporary password
        //
        const { COGNITO_USER_POOL_ID } = process.env
        const results = await cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: userName,
            MessageAction: 'SUPPRESS'
        }))
        //
        // TODO: Process results
        //

        //
        // Now set the password directly
        //
        await cognitoClient.send(new AdminSetUserPasswordCommand({
            UserPoolId: COGNITO_USER_POOL_ID,
            Username: userName,
            Password: password,
            Permanent: true
        }))
    }
    catch (err) {
        //
        // Process errors
        //
        throw err
    }
    //
    // Now sign in with the new username and password, in order to generate tokens to return in exchange for
    // the signUp request
    //
    try {
        const results = await cognitoClient.send(new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: {
                USERNAME: userName,
                PASSWORD: password
            },
            ClientId: process.env.COGNITO_USER_POOL_CLIENT
        }))
        const { AuthenticationResult } = results
        if (!(AuthenticationResult?.IdToken && AuthenticationResult.RefreshToken)) {
            throw new Error('Tokens not returned from signin')
        }
        return {
            AccessToken: AuthenticationResult?.AccessToken,
            IdToken: AuthenticationResult?.IdToken ?? '',
            RefreshToken: AuthenticationResult?.RefreshToken ?? ''
        }
    }
    catch (error: any) {
        return {
            errorField: 'system',
            errorMessage: 'Internal Error'
        }
    }
}