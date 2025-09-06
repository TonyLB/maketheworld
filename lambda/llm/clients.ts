import { SNSClient } from "@aws-sdk/client-sns"

export const snsClient = new SNSClient({ region: process.env.AWS_REGION })
