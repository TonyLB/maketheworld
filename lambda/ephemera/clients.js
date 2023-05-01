import { EventBridgeClient } from "@aws-sdk/client-eventbridge"
import { S3Client, GetObjectCommand as GetObjectCommandOriginal } from "@aws-sdk/client-s3"

// const params = { region: process.env.AWS_REGION }

// export const s3Client = new S3Client(params)

export class GetObjectCommand extends GetObjectCommandOriginal {}

export const ebClient = new EventBridgeClient({ region: process.env.AWS_REGION })
