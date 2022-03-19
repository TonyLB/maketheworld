import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"

import { assetRegistryEntries } from "../wml/index.js"
import { getTranslateFile } from "../serialize/translateFile.js"
import { dbRegister } from '../serialize/dbRegister.js'
import { getAssets, fileNameFromAssetId } from "../serialize/s3Assets.js"
import { asyncSuppressExceptions } from "/opt/utilities/errors.js"
import { importedAssetIds } from "../serialize/importedAssets.js"

const { S3_BUCKET } = process.env;

export const moveAsset = ({ s3Client }) => async ({ fromPath, fileName, toPath }) => {
    return await asyncSuppressExceptions(async () => {
        const assetWorkspace = await getAssets(s3Client, `${fromPath}${fileName}.wml`)
        const checkAsset = Object.values(assetWorkspace.normalize()).find(({ tag }) => (['Asset', 'Character', 'Story'].includes(tag)))

        if (checkAsset) {
            const [zone, ...rest] = toPath.split('/')
            const subFolder = rest.join('/')
            assetWorkspace.wmlQuery.search('')
                .prop('zone', zone)
                .prop('subFolder', subFolder)

            if (['Canon', 'Library'].includes(zone)) {
                assetWorkspace.wmlQuery.search('').removeProp('player')
            }
            if (zone === 'Personal') {
                if (rest[0]) {
                    assetWorkspace.wmlQuery.search('').prop('player', rest[0])
                }
            }

            const isScopedAsset = !checkAsset.instance
            let scopeMap = { scopeMap: {} }
            if (isScopedAsset) {
                const [foundScopeMap] = await Promise.all([
                    getTranslateFile(s3Client, { name: `${fromPath}${fileName}.translate.json` }),
                    s3Client.send(new CopyObjectCommand({
                        Bucket: S3_BUCKET,
                        CopySource: `${S3_BUCKET}/${fromPath}${fileName}.translate.json`,
                        Key: `${toPath}${fileName}.translate.json`
                    }))
                ])
                scopeMap = foundScopeMap
            }
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${toPath}${fileName}.wml`,
                Body: assetWorkspace.contents()
            }))
            const normalized = assetWorkspace.normalize()
            const importMap = Object.values(normalized)
                .filter(({ tag }) => (tag === 'Import'))
                .reduce((previous, { mapping = {}, from }) => {
                    return {
                        ...previous,
                        ...(Object.entries(mapping)
                            .reduce((previous, [key, scopedId]) => ({
                                ...previous,
                                [key]: {
                                    scopedId,
                                    asset: from
                                }
                            }), {})
                        )
                    }
                }, {})
            const { importTree } = await importedAssetIds(importMap || {})
            await dbRegister({
                fileName: `${toPath}${fileName}.wml`,
                translateFile: `${toPath}${fileName}.translate.json`,
                importTree,
                scopeMap: scopeMap.scopeMap,
                assets: normalized
            })
            await s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromPath}${fileName}.wml`,
            }))
            if (isScopedAsset) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: `${fromPath}${fileName}.translate.json`,
                }))
            }
        }

    })
}

const moveByAssetId = (toPath) => ({ s3Client }) => async (AssetId) => {
    const fullFileName = await fileNameFromAssetId(AssetId)
    const fromPath = `${fullFileName.split('/').slice(0, -1).join('/')}/`
    const fileName = (fullFileName.split('/').slice(-1)[0] || '').replace(/\.wml$/, '')
    if (fileName) {
        await moveAsset({ s3Client })({ fromPath, fileName, toPath })
    }
}

export const canonize = moveByAssetId('Canon/')

export const libraryCheckin = moveByAssetId('Library/')

export const libraryCheckout = (player) => moveByAssetId(`Personal/${player}/`)
