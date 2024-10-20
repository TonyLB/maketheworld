import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import AWSXRay from 'aws-xray-sdk'
import { streamToString } from "./stream"

const params = { region: process.env.AWS_REGION }

const { S3_BUCKET = 'Test', UPLOAD_BUCKET = 'Test' } = process.env;

const internalS3Client = (params.region ? AWSXRay.captureAWSv3Client(new S3Client(params)) : { send: async () => { return { Body: undefined } } }) as S3Client

export const s3Client = {
    async check({ Key }: {
        Key: string
    }): Promise<boolean> {
        try {
            await internalS3Client.send(new HeadObjectCommand({
                Bucket: S3_BUCKET,
                Key
            }))
            return true
        }
        catch (err: any) {
            if (err && err.name === 'NotFound') {
                return false
            }
            throw err
        }
    },

    async get({ Key, upload }: {
        Key: string,
        upload?: boolean;
    }): Promise<string> {
        const { Body: contentStream } = await internalS3Client.send(new GetObjectCommand({
            Bucket: upload ? UPLOAD_BUCKET : S3_BUCKET,
            Key
        }))
        const contents = await streamToString(contentStream)
        return contents
    },

    async put({ Key, Body }: {
        Key: string;
        Body: string;
    }): Promise<void> {
        await internalS3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key,
            Body
        }))
    },

    internalClient: internalS3Client
}