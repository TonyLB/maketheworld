import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"

import { assetRegistryEntries } from "../wml/index.js"
import { getTranslateFile } from "../serialize/translateFile.js"
import { dbRegister } from '../serialize/dbRegister.js'
import { getAssets, fileNameFromAssetId } from "../serialize/s3Assets.js"
import { asyncSuppressExceptions } from "../utilities/errors.js"
import { importedAssetIds } from "../serialize/importedAssets.js"

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

            if (['Canon', 'Library'].includes(zone)) {
                assetWorkspace.wmlQuery('').removeProp('player')
            }
            if (zone === 'Personal') {
                if (rest[0]) {
                    assetWorkspace.wmlQuery('').prop('player', rest[0])
                }
            }

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
            const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
            const { importTree } = await importedAssetIds({ dbClient }, asset.importMap || {})
            await dbRegister(dbClient, {
                fileName: `${toPath}${fileName}.wml`,
                translateFile: `${toPath}${fileName}.translate.json`,
                importTree,
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

const moveByAssetId = (toPath) => ({ s3Client, dbClient }) => async (AssetId) => {
    const fullFileName = await fileNameFromAssetId({ dbClient })(AssetId)
    const fromPath = `${fullFileName.split('/').slice(0, -1).join('/')}/`
    const fileName = (fullFileName.split('/').slice(-1)[0] || '').replace(/\.wml$/, '')
    if (fileName) {
        await moveAsset({ s3Client, dbClient })({ fromPath, fileName, toPath })
    }
}

export const canonize = moveByAssetId('Canon/')

export const libraryCheckin = moveByAssetId('Library/')

export const libraryCheckout = (player) => moveByAssetId(`Personal/${player}/`)
