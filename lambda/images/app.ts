// Import required AWS SDK clients and commands for Node.js
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import jimp from "jimp"

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

const streamToBuffer = (stream): Promise<Buffer> => (
    new Promise((resolve, reject) => {
        const chunks: any = []
        stream.on("data", (chunk) => chunks.push(chunk))
        stream.on("error", reject)
        stream.on("end", () => resolve(Buffer.concat(chunks)))
    })
)
  
export const handler = async (event, context) => {

    // Handle EventBridge messages
    if (['mtw.coordination'].includes(event?.source || '')) {
        if (event["detail-type"] === 'Format Image') {
            const { fromFileName, width, height, toFileName } = event.detail
            if (fromFileName && toFileName && width && height) {
                const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
                    Bucket: process.env.UPLOAD_BUCKET,
                    Key: fromFileName
                }))
                const contents = await streamToBuffer(contentStream)
            
                console.log(`Request to reformat: ${event.detail?.fromFileName}`)
                try {
                    const beforeBuffer = await jimp.read(contents)
                    console.log(`Image read: width: ${beforeBuffer.bitmap.width}, height: ${beforeBuffer.bitmap.height}`)
                    const afterBuffer = await beforeBuffer.resize(width, height, jimp.RESIZE_BEZIER).deflateLevel(5).getBufferAsync(jimp.MIME_PNG)
                    await s3Client.send(new PutObjectCommand({
                        Bucket: process.env.IMAGES_BUCKET,
                        Key: `${toFileName}.png`,
                        Body: afterBuffer
                    }))

                }
                catch {
                    console.log(`ERROR`)
                }
                return JSON.stringify('Success', null, 4)
            }
            return JSON.stringify(`Invalid arguments specified for Format Image event`)
        }
    }
}
