import configJSON from './config.json'

const config = configJSON.reduce((previous, { OutputKey, OutputValue }) => ({ ...previous, [OutputKey]: OutputValue }), {})
export const WSS_ADDRESS=config.WebSocketURI
export const STORAGE_API_URI=config.StorageApiURI

export const AuthConfig = {
    aws_project_region: "us-east-1",
    aws_appsync_graphqlEndpoint: config.AppSyncURL,
    aws_appsync_region: "us-east-1",
    aws_appsync_authenticationType: "AMAZON_COGNITO_USER_POOLS",
    Auth: {
        // REQUIRED - Amazon Cognito Region
        region: 'us-east-1',

        // OPTIONAL - Amazon Cognito User Pool ID
        userPoolId: config.UserPoolId,

        // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
        userPoolWebClientId: config.UserPoolClient,

        // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
        mandatorySignIn: true,

        // OPTIONAL - Manually set the authentication flow type. Default is 'USER_SRP_AUTH'
        authenticationFlowType: 'USER_SRP_AUTH',

    }
}