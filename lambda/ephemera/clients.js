import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { SFNClient } from "@aws-sdk/client-sfn"

export const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
