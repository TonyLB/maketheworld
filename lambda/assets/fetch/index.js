import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { splitType } from '@tonylb/mtw-utilities/dist/types.js'

const { S3_BUCKET } = process.env;

export const createFetchLink = ({ s3Client }) => async ({ PlayerName, fileName, AssetId }) => {
    let derivedFileName = `Personal/${PlayerName}/${fileName}`
    if (AssetId) {
        const DataCategory = splitType(AssetId)[0] === 'CHARACTER' ? 'Meta::Character' : 'Meta::Asset'
        if (DataCategory === 'Meta::Asset') {
            const { fileName: fetchFileName, zone, player } = await assetDB.getItem({
                AssetId,
                DataCategory,
                ProjectionFields: ['fileName', '#zone', 'player'],
                ExpressionAttributeNames: {
                    '#zone': 'zone'
                }
            })
            if (zone === 'Personal' && player === PlayerName) {
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
