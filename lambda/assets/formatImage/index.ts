import jimp from "jimp"
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import internalCache from "../internalCache"
import type { Readable } from "stream"
import { FormatImageMessage, MessageBus } from "../messageBus/baseClasses"

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = []
    for await (let chunk of stream) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

export const formatImageMessage = async ({ payloads, messageBus }: { payloads: FormatImageMessage[], messageBus: MessageBus }): Promise<void> => {
    //
    // TODO: Translate the Format Image eventBridge item from app.ts
    //

    //
    // TODO: Use assetWorkspace to look up the JSON file of the passed AssetId
    //

    //
    // TODO: Modify the properties value of the JSON file and pushJSON
    //
    const s3Client = await internalCache.Connection.get('s3Client')
    if (!s3Client) {
        return
    }
    await Promise.all(payloads.map(async (payload) => {
        const { fileName: fromFileName, width, height } = payload
        if (fromFileName && width && height) {
            const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
                Bucket: process.env.UPLOAD_BUCKET,
                Key: fromFileName
            }))
            const contents = await streamToBuffer(contentStream as Readable)
        
            try {
                //
                // Quick monkey-patch to get around meaningless deprecation warning delivered by the Jimp library
                //
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
    
            }
            catch {
                console.log(`ERROR`)
            }
        }
    }))
}

export default formatImageMessage
