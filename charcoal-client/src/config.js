export const WSS_ADDRESS="wss://l0chomdpg3.execute-api.us-east-1.amazonaws.com/Prod"

export const AuthConfig = {
    Auth: {
        // REQUIRED - Amazon Cognito Region
        region: 'us-east-1',

        // OPTIONAL - Amazon Cognito User Pool ID
        userPoolId: 'us-east-1_uqDUigCn6',

        // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
        userPoolWebClientId: '36s74tiuedhe3t4v4irl6o3fqv',

        // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
        mandatorySignIn: true,

        // OPTIONAL - Manually set the authentication flow type. Default is 'USER_SRP_AUTH'
        authenticationFlowType: 'USER_SRP_AUTH',

    }
}