// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

export const handler = async (event, context) => {

    // Handle EventBridge messages
    if (['mtw.coordination'].includes(event?.source || '')) {
        if (event["detail-type"] === 'Format Image') {
            if (event.detail?.fromFileName) {
                console.log(`Request to reformat: ${event.detail?.fromFileName}`)
                return JSON.stringify('Success', null, 4)
            }
            return JSON.stringify(`No fileName specified for Format Image event`)
        }
    }
}
