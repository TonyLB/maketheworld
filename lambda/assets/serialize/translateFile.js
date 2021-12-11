const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { streamToString } = require("../utilities/stream")

const { S3_BUCKET } = process.env

const putTranslateFile = (s3Client, { name, scopeMap, assetKey }) => {
    const contents = JSON.stringify({
        asset: assetKey,
        imports: {},
        scopeMap
    }, null, 4)
    s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: name,
        Body: contents
    }))
}

const getTranslateFile = async (s3Client, { name }) => {
    const { Body: scopeStream } = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: name
    }))
    const scopeContents = await streamToString(scopeStream)
    const scopeItem = JSON.parse(scopeContents)
    return scopeItem
}

exports.putTranslateFile = putTranslateFile
exports.getTranslateFile = getTranslateFile
