import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { EventBridgeClient } from "@aws-sdk/client-eventbridge"

export const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
export const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION })
