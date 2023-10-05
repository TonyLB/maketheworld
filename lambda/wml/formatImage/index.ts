import jimp from "jimp"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Readable } from "stream"
import { v4 as uuidv4 } from "uuid"

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = []
    for await (let chunk of stream) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

export const formatImage = (s3Client: S3Client) => async ({ fromFileName, width, height }): Promise<string | undefined> => {
    const toFileName = `IMAGE-${uuidv4()}`
    if (s3Client && fromFileName && width && height) {
        const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
            Bucket: process.env.UPLOAD_BUCKET,
            Key: fromFileName
        }))
        const contents = await streamToBuffer(contentStream as Readable)
    
        const origWarning = process.emitWarning;
        process.emitWarning = function(...args) {
            if (args[2] !== 'DEP0005') {
                // pass any other warnings through normally
                return origWarning.apply(process, args as any);
            } else {
                // do nothing, eat the warning
            }
        }
        const beforeBuffer = await jimp.read(contents)
        const afterBuffer = await beforeBuffer.resize(width, height, jimp.RESIZE_BEZIER).deflateLevel(5).getBufferAsync(jimp.MIME_PNG)
        process.emitWarning = origWarning
        await s3Client.send(new PutObjectCommand({
            Bucket: process.env.IMAGES_BUCKET,
            Key: `${toFileName}.png`,
            Body: afterBuffer,
            ContentType: 'image/png'
        }))
        return toFileName
    }
    return undefined
}
