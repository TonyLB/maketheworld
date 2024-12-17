import { SFNClient } from "@aws-sdk/client-sfn"

export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
