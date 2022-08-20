import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { dbRegister } from '../serialize/dbRegister.js'
import { getAssets, fileNameFromAssetId } from "../serialize/s3Assets"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import ScopeMap from '../serialize/scopeMap.js'
import { isNormalAsset, isNormalImport, NormalAsset, NormalCharacter } from "@tonylb/mtw-wml/dist/normalize"
import { MessageBus, MoveAssetMessage, MoveByAssetIdMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"

const { S3_BUCKET } = process.env;

export const moveAssetMessage = async ({ payloads, messageBus }: { payloads: MoveAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                const { fromPath, fileName, toPath } = payload
                await asyncSuppressExceptions(async () => {
                    const assetWorkspace = await getAssets(s3Client, `${fromPath}${fileName}.wml`)
                    if (!assetWorkspace) {
                        return
                    }
                    const checkAsset = Object.values(assetWorkspace.normalize()).find(({ tag }) => (['Asset', 'Character', 'Story'].includes(tag))) as NormalAsset | NormalCharacter
                    const incomingTag = checkAsset.tag
            
                    if (checkAsset) {
                        const [zone, ...rest] = toPath.split('/')
                        const subFolder = [...rest, incomingTag === 'Character' ? 'Characters' : 'Assets'].join('/')
                        assetWorkspace.wmlQuery.search('Asset, Character, Story')
                            .prop('zone', zone)
                            .prop('subFolder', subFolder)
            
                        if (['Canon', 'Library'].includes(zone)) {
                            assetWorkspace.wmlQuery.search('Asset, Character, Story').removeProp('player')
                        }
                        if (zone === 'Personal') {
                            if (rest[0]) {
                                assetWorkspace.wmlQuery.search('Asset, Character, Story').prop('player', rest[0])
                            }
                        }
            
                        const isScopedAsset = !(isNormalAsset(checkAsset) && checkAsset.instance)
                        const scopeMap = new ScopeMap({})
                        const finalKey = `${toPath}${incomingTag === 'Character' ? 'Characters' : 'Assets'}/${fileName}`
                        if (isScopedAsset) {
                            await Promise.all([
                                scopeMap.getTranslateFile(s3Client, { name: `${fromPath}${fileName}` }),
                                s3Client.send(new CopyObjectCommand({
                                    Bucket: S3_BUCKET,
                                    CopySource: `${S3_BUCKET}/${fromPath}${fileName}.translate.json`,
                                    Key: `${finalKey}.translate.json`
                                }))
                            ])
                        }
                        await s3Client.send(new PutObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${finalKey}.wml`,
                            Body: assetWorkspace.contents()
                        }))
                        const normalized = assetWorkspace.normalize()
                        scopeMap.translateNormalForm(normalized)
                        const importMap = Object.values(normalized)
                            .filter(isNormalImport)
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
                        const importTree = await scopeMap.importAssetIds(importMap || {})
                        await dbRegister({
                            fileName: `${finalKey}.wml`,
                            translateFile: `${finalKey}.translate.json`,
                            importTree,
                            scopeMap: scopeMap.serialize(),
                            namespaceMap: scopeMap.namespaceMap,
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
            })
        )
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Success' }
        })
    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Error' }
        })
    }
}

export const moveAssetByIdMessage = async ({ payloads, messageBus }: { payloads: MoveByAssetIdMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(
        payloads.map(async (payload) => {
            const fullFileName = await fileNameFromAssetId(payload.AssetId)
            if (fullFileName) {
                const fromPath = `${fullFileName.split('/').slice(0, -1).join('/')}/`
                const fileName = (fullFileName.split('/').slice(-1)[0] || '').replace(/\.wml$/, '')
                if (fileName) {
                    messageBus.send({
                        type: 'MoveAsset',
                        fromPath,
                        fileName,
                        toPath: payload.toPath
                    })
                }
            }
        })
    )
}
