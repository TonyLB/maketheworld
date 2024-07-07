import { SNSClient } from "@aws-sdk/client-sns"
import AWSXRay from 'aws-xray-sdk'

export const snsClient = AWSXRay.captureAWSv3Client(new SNSClient({ region: process.env.AWS_REGION }))
