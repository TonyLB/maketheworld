import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { streamToString } from "@tonylb/mtw-utilities/dist/stream.js"

const { S3_BUCKET } = process.env

export const putTranslateFile = (s3Client, { name, importTree, scopeMap, assetKey }) => {
    const contents = JSON.stringify({
        asset: assetKey,
        importTree,
        scopeMap
    }, null, 4)
    s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: name,
        Body: contents
    }))
}

export const getTranslateFile = async (s3Client, { name }) => {
    try {
        const { Body: scopeStream } = await s3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: name
        }))
        const scopeContents = await streamToString(scopeStream)
        const scopeItem = JSON.parse(scopeContents)
        return scopeItem    
    }
    catch {
        return {}
    }
}
