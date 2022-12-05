// Import required AWS SDK clients and commands for Node.js
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import type { Readable } from "stream"
import { readdir } from 'node:fs/promises'

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)


export const handler = async (event, context) => {

    // Handle EventBridge messages
    if (event?.source === 'mtw.diagnostics') {
        if (event["detail-type"] === 'Initialize') {
            console.log(`Initializer called`)
            const dirContents = await readdir('/opt')
            console.log(`Directory contents: ${JSON.stringify(dirContents, null, 4)}`)
            // await s3Client.send(new PutObjectCommand({
            //     Bucket: process.env.CLIENT_BUCKET,
            //     Key: `Test.txt`,
            //     Body: 'test'
            // }))
            return JSON.stringify(`Success`)
        }
    }

}
