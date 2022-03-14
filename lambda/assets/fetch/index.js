import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { assetDB } from '/opt/utilities/dynamoDB/index.js'
import { splitType } from '/opt/utilities/types.js'

const { S3_BUCKET } = process.env;

export const createFetchLink = ({ s3Client }) => async ({ PlayerName, fileName, AssetId }) => {
    let derivedFileName = `Personal/${PlayerName}/${fileName}`
    if (AssetId) {
        const { fileName: fetchFileName, zone, player } = await assetDB.getItem({
            AssetId,
            DataCategory: splitType(AssetId)[0] === 'CHARACTER' ? 'Meta::Character' : 'Meta::Asset',
            ProjectionFields: ['fileName', '#zone', 'player'],
            ExpressionAttributeNames: {
                '#zone': 'zone'
            }
        })
        if (zone === 'Personal' && player === PlayerName) {
            derivedFileName = fetchFileName
        }
    }
    const getCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: derivedFileName
    })
    const presignedOutput = await getSignedUrl(s3Client, getCommand, { expiresIn: 60 })
    return presignedOutput
}
