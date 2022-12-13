import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { streamToString } from "./stream"

const params = { region: process.env.AWS_REGION }

const { S3_BUCKET = 'Test' } = process.env;

const internalS3Client = new S3Client(params)

export const s3Client = {
    async get({ Key }: {
        Key: string,
    }): Promise<string> {
        const { Body: contentStream } = await internalS3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
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