import { GetObjectCommand as GetObjectCommandOriginal } from "@aws-sdk/client-s3"
import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { SFNClient } from "@aws-sdk/client-sfn"
import { SNSClient } from "@aws-sdk/client-sns"
import AWSXRay from 'aws-xray-sdk'

export const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
export const snsClient = AWSXRay.captureAWSv3Client(new SNSClient({ region: process.env.AWS_REGION }))

export class GetObjectCommand extends GetObjectCommandOriginal {}
