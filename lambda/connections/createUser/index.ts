import { AdminCreateUserCommand, AdminSetUserPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "../clients";

type CreateUserRequest = {
    inviteCode: string;
    userName: string;
    password: string;
}

type CreateUserResultSuccess = {

}

export const createCognitoUser = async ({ inviteCode, userName, password }: CreateUserRequest) => {
    try {
        //
        // TODO: Validate inviteCode
        //

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
        // TODO: Process errors
        //
    }
}