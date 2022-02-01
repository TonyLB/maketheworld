import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"

import { assetRegistryEntries } from "../wml/index.js"
import { getTranslateFile } from "../serialize/translateFile.js"
import { dbRegister } from '../serialize/dbRegister.js'
import { getAssets } from "../serialize/s3Assets.js"
import { asyncSuppressExceptions } from "../utilities/errors.js"

const { S3_BUCKET } = process.env;

export const moveAsset = ({ s3Client, dbClient }) => async ({ fromPath, fileName, toPath }) => {
    return await asyncSuppressExceptions(async () => {
        const assetWorkspace = await getAssets(s3Client, `${fromPath}${fileName}.wml`)
        const asset = assetWorkspace.wmlQuery('').nodes()[0]

        if (['Asset', 'Character'].includes(asset.tag)) {
            const [zone, ...rest] = toPath.split('/')
            const subFolder = rest.join('/')
            assetWorkspace.wmlQuery('')
                .prop('zone', zone)
                .prop('subFolder', subFolder)

            const [scopeMap] = await Promise.all([
                getTranslateFile(s3Client, { name: `${fromPath}${fileName}.translate.json` }),
                s3Client.send(new CopyObjectCommand({
                    Bucket: S3_BUCKET,
                    CopySource: `${S3_BUCKET}/${fromPath}${fileName}.translate.json`,
                    Key: `${toPath}${fileName}.translate.json`
                }))
            ])
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${toPath}${fileName}.wml`,
                Body: assetWorkspace.contents()
            }))
            const assetRegistryItems = assetRegistryEntries(assetWorkspace.schema())
            await dbRegister(dbClient, {
                fileName: `${toPath}${fileName}.wml`,
                translateFile: `${toPath}${fileName}.translate.json`,
                scopeMap: scopeMap.scopeMap,
                assets: assetRegistryItems
            })
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromPath}${fileName}.wml`,
            }))
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromPath}${fileName}.translate.json`,
            }))
        }

    })
}