export const WSS_ADDRESS="wss://w9eoi2q3f9.execute-api.us-east-1.amazonaws.com/Prod"

export const AuthConfig = {
    aws_project_region: "us-east-1",
    aws_appsync_graphqlEndpoint: "https://ukcxnqmvt5f2hlkk6xy66zmsnu.appsync-api.us-east-1.amazonaws.com/graphql",
    aws_appsync_region: "us-east-1",
    aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
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