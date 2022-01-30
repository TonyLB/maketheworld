import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"

import { streamToString } from '../utilities/stream.js'
import { wmlGrammar, validatedSchema, assetRegistryEntries } from "../wml/index.js"
import { wmlQueryFactory } from '../wml/wmlQuery/index.js'

const { TABLE_PREFIX, S3_BUCKET } = process.env;

export const moveAsset = ({ s3Client, dbClient }) => async ({ fromPath, fileName, toPath }) => {
    // try {

        //
        // TODO: Right now this is repeating a lot of s3Assets getAssets code.
        // See what can be done to reduce that repetition and abstract the right bits
        //
        const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${fromPath}${fileName}.wml`
        }))
        const contents = await streamToString(contentStream)

        const wmlQuery = wmlQueryFactory(contents)
        const asset = wmlQuery('').nodes()[0]

        if (['Asset', 'Character'].includes(asset.tag)) {
            const [zone, ...rest] = toPath.split('/')
            const subFolder = rest.join('/')
            const Body = wmlQuery('')
                .prop('zone', zone)
                .prop('subFolder', subFolder)
                .source()
            console.log(`contents: ${contents}`)
            console.log(`wmlQuery: ${JSON.stringify(wmlQuery('Character').source(), null, 4)}`)
            console.log(`Body: ${Body}`)
            console.log(`Source path: ${fromPath}${fileName}`)
            console.log(`Destination path: ${toPath}${fileName}`)

            await s3Client.send(new CopyObjectCommand({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/${fromPath}${fileName}.translate.json`,
                Key: `${toPath}${fileName}.translate.json`
            }))
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${toPath}${fileName}.wml`,
                Body
            }))
            // await s3Client.send(new DeleteObjectCommand({
            //     Bucket: S3_BUCKET,
            //     Key: `${fromPath}${fileName}.wml`,
            // }))
            // await s3Client.send(new DeleteObjectCommand({
            //     Bucket: S3_BUCKET,
            //     Key: `${fromPath}${fileName}.translate.json`,
            // }))
        }
    // }
    // catch {
    //     console.log('Error!')
    // }
}