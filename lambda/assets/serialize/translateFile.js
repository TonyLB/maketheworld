import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { streamToString } from "@tonylb/mtw-utilities/dist/stream"

const { S3_BUCKET } = process.env

export const putTranslateFile = async (s3Client, { name, importTree, scopeMap, assetKey }) => {
    const contents = JSON.stringify({
        asset: assetKey,
        importTree,
        scopeMap
    }, null, 4)
    const newContents = JSON.stringify({
        namespaceToDB: scopeMap
    }, null, 4)
    await Promise.all([
        s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${name}.translate.json`,
            Body: contents
        })),
        s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${name}.json`,
            Body: newContents
        }))
    ])
}

export const getTranslateFile = async (s3Client, { name }) => {
    try {
        const { Body: scopeStream } = await s3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${name}.json`
        }))
        const scopeContents = await streamToString(scopeStream)
        const scopeItem = JSON.parse(scopeContents)
        return {
            importTree: {},
            scopeMap: scopeItem.namespaceToDB,
            namespaceMap: {}
        }
    }
    catch {
        return {}
    }
}
