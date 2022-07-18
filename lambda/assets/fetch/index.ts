import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index'
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { FetchAssetMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { MessageBus } from "../messageBus/baseClasses"

const { S3_BUCKET } = process.env;

const createFetchLink = ({ s3Client }) => async ({ PlayerName, fileName, AssetId }: { PlayerName: string; fileName?: string; AssetId?: string }) => {
    let derivedFileName: string = `Personal/${PlayerName}/${fileName}`
    if (AssetId) {
        const DataCategory = (splitType(AssetId)[0] === 'CHARACTER') ? 'Meta::Character' : 'Meta::Asset'
        if (DataCategory === 'Meta::Asset') {
            const { fileName: fetchFileName, zone, player } = (await assetDB.getItem<{ fileName: string; zone: string; player: string; }>({
                AssetId,
                DataCategory,
                ProjectionFields: ['fileName', '#zone', 'player'],
                ExpressionAttributeNames: {
                    '#zone': 'zone'
                }
            })) || {}
            if (zone === 'Personal' && player === PlayerName && fetchFileName) {
                derivedFileName = fetchFileName
            }    
        }
        else {
            const queryOutput = await assetDB.query({
                IndexName: 'ScopedIdIndex',
                scopedId: splitType(AssetId)[1],
                KeyConditionExpression: 'DataCategory = :dc',
                ExpressionAttributeValues: {
                    ':dc': DataCategory
                },
                ProjectionFields: ['fileName', '#zone', 'player'],
                ExpressionAttributeNames: {
                    '#zone': 'zone'
                }
            })
            const { fileName: fetchFileName, zone, player } = queryOutput[0] || {}
            if (zone === 'Personal' && player === PlayerName) {
                derivedFileName = fetchFileName
            }
        }
    }
    const getCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: derivedFileName
    })
    const presignedOutput = await getSignedUrl(s3Client, getCommand, { expiresIn: 60 })
    return presignedOutput
}

export const fetchAssetMessage = async ({ payloads, messageBus }: { payloads: FetchAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (player && (s3Client !== undefined)) {
        await Promise.all(payloads.map(async (payload) => {
            const presignedURL = await createFetchLink({ s3Client })({
                PlayerName: player,
                fileName: payload.fileName,
                AssetId: payload.AssetId
            })
            messageBus.send({
                type: 'ReturnValue',
                body: { messageType: "FetchURL", url: presignedURL }
            })    
        }))
    }
}

export default fetchAssetMessage