import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const { S3_BUCKET } = process.env;

export const createFetchLink = ({ s3Client }) => async ({ PlayerName, fileName }) => {
    const getCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: `drafts/${PlayerName}/${fileName}`
    })
    const presignedOutput = await getSignedUrl(s3Client, getCommand, { expiresIn: 60 })
    return presignedOutput
}
