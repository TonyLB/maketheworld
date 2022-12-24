import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { streamToString } from "./stream"

const params = { region: process.env.AWS_REGION }

const { S3_BUCKET = 'Test', UPLOAD_BUCKET = 'Test' } = process.env;

const internalS3Client = new S3Client(params)

export const s3Client = {
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