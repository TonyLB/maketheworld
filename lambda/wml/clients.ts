import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { S3Client } from "@aws-sdk/client-s3"
import { SFNClient } from "@aws-sdk/client-sfn"
import { SNSClient } from "@aws-sdk/client-sns"
import AWSXRay from 'aws-xray-sdk'

const params = { region: process.env.AWS_REGION }
export const ebClient = AWSXRay.captureAWSv3Client(new EventBridgeClient(params))
export const sfnClient = AWSXRay.captureAWSv3Client(new SFNClient(params))
export const snsClient = AWSXRay.captureAWSv3Client(new SNSClient(params))
export const s3Client = AWSXRay.captureAWSv3Client(new S3Client(params))
