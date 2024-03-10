import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { SFNClient } from "@aws-sdk/client-sfn"
import { SNSClient } from "@aws-sdk/client-sns"
import AWSXRay from 'aws-xray-sdk'

export const ebClient = AWSXRay.captureAWSv3Client(new EventBridgeClient({ region: process.env.AWS_REGION }))
export const sfnClient = AWSXRay.captureAWSv3Client(new SFNClient({ region: process.env.AWS_REGION }))
export const snsClient = AWSXRay.captureAWSv3Client(new SNSClient({ region: process.env.AWS_REGION }))
