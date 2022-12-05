// Import required AWS SDK clients and commands for Node.js
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import type { Readable } from "stream"

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)


export const handler = async (event, context) => {

    // Handle EventBridge messages
    if (event?.source === 'mtw.diagnostics') {
        if (event["detail-type"] === 'Initialize') {
            console.log(`Initializer called`)
            return JSON.stringify(`Success`)
        }
    }

}
