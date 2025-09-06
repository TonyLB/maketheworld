import { GetObjectCommand as GetObjectCommandOriginal } from "@aws-sdk/client-s3"
import { SFNClient } from "@aws-sdk/client-sfn"
import { SNSClient } from "@aws-sdk/client-sns"

export const sfnClient = new SFNClient({ region: process.env.AWS_REGION })
export const snsClient = new SNSClient({ region: process.env.AWS_REGION })

export class GetObjectCommand extends GetObjectCommandOriginal {}
