import { EventBridgeClient } from "@aws-sdk/client-eventbridge"

export const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
