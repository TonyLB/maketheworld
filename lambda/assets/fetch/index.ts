import { GetObjectCommand, S3Client, SelectObjectContentCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { FetchAssetMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { MessageBus } from "../messageBus/baseClasses"
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { convertSelectDataToJson } from "../utilities/stream"

const { S3_BUCKET } = process.env;

const createFetchLink = ({ s3Client }) => async ({ PlayerName, fileName, AssetId }: { PlayerName: string; fileName?: string; AssetId?: string }) => {
    // let derivedFileName: string = `Personal/${PlayerName}/${fileName}`
    if (AssetId) {
        if (AssetId === 'ASSET#draft') {
            const assetWorkspace = new ReadOnlyAssetWorkspace({
                zone: 'Draft',
                player: PlayerName
            })
            return await assetWorkspace.presignedURL()
        }
        const DataCategory = (splitType(AssetId)[0] === 'CHARACTER') ? 'Meta::Character' : 'Meta::Asset'
        const { address } = (await assetDB.getItem<{ address: AssetWorkspaceAddress }>({
            Key: {
                AssetId,
                DataCategory
            },
            ProjectionFields: ['address']
        })) || {}
        if (address) {
            const assetWorkspace = new ReadOnlyAssetWorkspace(address)
            return await assetWorkspace.forceDefault().then(() => (assetWorkspace.presignedURL()))
        }
    }
    return undefined
    //     if (address) {
    //         const { fileName: fetchFileName, subFolder } = address || {}
    //         if (address.zone === 'Personal' && address.player === PlayerName && fetchFileName) {
    //             derivedFileName = `Personal/${PlayerName}/${subFolder ? `${subFolder}/` : ''}${fetchFileName}.wml`
    //         }
    //     }
    //         //
    //         // TODO: ISS3674: Refactor Character fetch lookups to operate off of universal AssetId rather
    //         // than ScopedId
    //         //
    //         const queryOutput = await assetDB.query({
    //             IndexName: 'ScopedIdIndex',
    //             Key: {
    //                 scopedId: splitType(AssetId)[1]
    //             },
    //             KeyConditionExpression: 'DataCategory = :dc',
    //             ExpressionAttributeValues: {
    //                 ':dc': DataCategory
    //             },
    //             ProjectionFields: ['address']
    //         })
    //         const { address } = queryOutput[0] || {}
    //         if (address) {
    //             const assetWorkspace = new ReadOnlyAssetWorkspace(address)
    //             return await assetWorkspace.presignedURL()
    //         }
    //         else {
    //             return undefined
    //         }
    //     }
    // }
    // const getCommand = new GetObjectCommand({
    //     Bucket: S3_BUCKET,
    //     Key: derivedFileName
    // })
    // const presignedOutput = await getSignedUrl(s3Client, getCommand, { expiresIn: 60 })
    // return presignedOutput
}

const fetchAssetProperties = ({ s3Client }: { s3Client: S3Client }) => async ({ AssetId }: { AssetId: string | undefined }): Promise<Record<string, { fileName: string }>> => {
    let derivedFileName: string | undefined
    if (AssetId) {
        const DataCategory = (splitType(AssetId)[0] === 'CHARACTER') ? 'Meta::Character' : 'Meta::Asset'
        const { address } = (await assetDB.getItem<{ address: AssetWorkspaceAddress; }>({
            Key: {
                AssetId,
                DataCategory
            },
            ProjectionFields: ['address']
        })) || {}
        if (address) {
            const assetWorkspace = new ReadOnlyAssetWorkspace(address)
            derivedFileName = `${assetWorkspace.fileNameBase}.json`
        }
    }
    if (!derivedFileName) {
        return {}
    }
    const params = {
        Bucket: S3_BUCKET,
        Key: derivedFileName,
        ExpressionType: 'SQL',
        Expression: `SELECT r.properties FROM s3object[*] r`,
        InputSerialization: {
            JSON: { Type: 'Document' }
        },
        OutputSerialization: {
            JSON: { RecordDelimiter: ',' }
        }
    }
    const s3SelectResponse = await s3Client.send(new SelectObjectContentCommand(params))
    //
    // TODO: Better error handling
    //
    if (s3SelectResponse.$metadata.httpStatusCode === 200 && s3SelectResponse.Payload) {
        const convertedData = await convertSelectDataToJson(s3SelectResponse.Payload)
        return convertedData.properties as Record<string, { fileName: string }>    
    }
    else {
        return {}
    }
}

export const fetchAssetMessage = async ({ payloads, messageBus }: { payloads: FetchAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (player && (s3Client !== undefined)) {
        await Promise.all(payloads.map(async (payload) => {
            const [presignedURL, properties = {}] = await Promise.all([
                createFetchLink({ s3Client })({
                    PlayerName: player,
                    fileName: payload.fileName,
                    AssetId: payload.AssetId
                }),
                fetchAssetProperties({ s3Client })({ AssetId: payload.AssetId })
            ])
            messageBus.send({
                type: 'ReturnValue',
                body: { messageType: "FetchURL", url: presignedURL, properties }
            })    
        }))
    }
}

export default fetchAssetMessage