import jimp from "jimp"
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import internalCache from "../internalCache"
import type { Readable } from "stream"
import { FormatImageMessage, MessageBus } from "../messageBus/baseClasses"
import { v4 as uuidv4 } from "uuid"
import { assetWorkspaceFromAssetId } from "../utilities/assets"

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = []
    for await (let chunk of stream) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

export const formatImage = async ({ fromFileName, width, height }): Promise<string | undefined> => {
    const toFileName = `IMAGE-${uuidv4()}`
    const s3Client = await internalCache.Connection.get('s3Client')
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

export const formatImageMessage = async ({ payloads, messageBus }: { payloads: FormatImageMessage[], messageBus: MessageBus }): Promise<void> => {

    const s3Client = await internalCache.Connection.get('s3Client')
    if (!s3Client) {
        return
    }
    await Promise.all(payloads.map(async (payload) => {
        const { fileName: fromFileName, width, height, AssetId, imageKey } = payload
        if (fromFileName && width && height && AssetId) {
            //
            // TODO: Run assetWorkspace lookups in parallel with image handling, rather
            // than sequentially.
            //
            const assetWorkspace = await assetWorkspaceFromAssetId(AssetId)
            if (!assetWorkspace) {
                return
            }

            const toFileName = await formatImage({ fromFileName, width, height })

            if (toFileName) {
                await assetWorkspace.loadJSON()
                //
                // TODO: Validate that the imageKey is in the assetWorkspace, and identifies an Image item
                //
                assetWorkspace.properties[imageKey] = { fileName: toFileName }
                await assetWorkspace.pushJSON()
            }

            //
            // TODO: Delete upload file
            //

        }
    }))
}

export default formatImageMessage
