import { S3Client } from "@aws-sdk/client-s3"
import { SFNClient } from "@aws-sdk/client-sfn"
import { SNSClient } from "@aws-sdk/client-sns"

const params = { region: process.env.AWS_REGION }
export const sfnClient = new SFNClient(params)
export const snsClient = new SNSClient(params)
export const s3Client = new S3Client(params)
